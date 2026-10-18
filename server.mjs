import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
// Production release gate: no accidental public deployment with a throwaway database
// or broken HTTPS sharing links. Persistence must be provisioned by the operator.
if (process.env.NODE_ENV === 'production') {
  if (!/^https:\/\/[^/]+/.test(process.env.PUBLIC_ORIGIN || ''))
    throw new Error('Production requires a public HTTPS PUBLIC_ORIGIN.');
  if (!process.env.DATA_DIR || !isAbsolute(process.env.DATA_DIR))
    throw new Error('Production requires an absolute DATA_DIR on a persistent volume.');
}
const PUBLIC = join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, 'knowme.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT NOT NULL,
  theme TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, active INTEGER NOT NULL DEFAULT 1,
  views INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, text TEXT NOT NULL, options TEXT NOT NULL,
  correct_index INTEGER NOT NULL, category TEXT NOT NULL, UNIQUE(challenge_id,position)
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL, access_hash TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, score INTEGER NOT NULL DEFAULT 0,
  current_index INTEGER NOT NULL DEFAULT 0, UNIQUE(challenge_id,visitor_id)
);
CREATE TABLE IF NOT EXISTS answers (
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, selected INTEGER NOT NULL, correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(attempt_id,position)
);
CREATE INDEX IF NOT EXISTS idx_attempt_challenge ON attempts(challenge_id,completed_at);
CREATE TABLE IF NOT EXISTS question_images (
  id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  mime TEXT NOT NULL, content BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_question_image_challenge ON question_images(challenge_id);
`);
// Upgrade existing V7 databases without deleting challenges or past answers.
if(!db.prepare('PRAGMA table_info(questions)').all().some(c=>c.name==='art_key')) {
  db.exec("ALTER TABLE questions ADD COLUMN art_key TEXT NOT NULL DEFAULT ''");
}
if(!db.prepare('PRAGMA table_info(questions)').all().some(c=>c.name==='option_images')) {
  db.exec("ALTER TABLE questions ADD COLUMN option_images TEXT NOT NULL DEFAULT '[]'");
}

const PORT = Number(process.env.PORT || 3000);
const CSP = [
  "default-src 'self'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'",
  "script-src 'self'", "connect-src 'self'", "img-src 'self' data: blob:", "media-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com"
].join('; ');
const token = (n = 24) => randomBytes(n).toString('base64url');
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const equalHash = (a, b) => { try { return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); } catch { return false; } };
const clean = (v, max = 100) => typeof v === 'string' ? v.trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max) : '';
const json = (res, status, data, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers });
  res.end(JSON.stringify(data));
};
const err = (status, message) => Object.assign(new Error(message), { status });
const ensure = (ok, status, message) => { if(!ok) throw err(status, message); };
const auth = req => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const limit = new Map();
function rateLimit(req) {
  const key = req.socket.remoteAddress || 'local';
  const now = Date.now();
  let value = limit.get(key);
  if (!value || now - value.start > 60000) { value = {start:now, count:0}; limit.set(key,value); }
  ++value.count;
  ensure(value.count <= 240, 429, 'طلبات كثيرة خلال وقت قصير. حاول مرة ثانية بعد قليل.');
  if (limit.size > 10000) for (const [k,v] of limit) if(now-v.start>60000) limit.delete(k);
}
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; ensure(size <= 8_000_000, 413, 'بيانات الصور كبيرة جدًا. قلّل حجم الصور.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw err(400, 'صيغة البيانات غير صحيحة.'); }
}
function existingVisitor(req) {
  return (req.headers.cookie||'').match(/(?:^|;\s*)qm_visitor=([A-Za-z0-9_-]{20,80})(?:;|$)/)?.[1]||null;
}
function getVisitor(req, res) {
  const known = existingVisitor(req);
  if(known) return known;
  const id = token(24);
  // The cookie binds one official submission per browser on a given challenge, not a verified human identity.
  res.setHeader('Set-Cookie', `qm_visitor=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${process.env.NODE_ENV==='production' ? '; Secure' : ''}`);
  return id;
}
function ownerChallenge(req, id) {
  const challenge = db.prepare('SELECT * FROM challenges WHERE id=?').get(id);
  ensure(challenge, 404, 'التحدي غير موجود.');
  ensure(equalHash(hash(auth(req)), challenge.owner_hash), 403, 'رابط الإدارة أو مفتاح الاستعادة غير صحيح.');
  return challenge;
}
function authorizedAttempt(req,id) {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(id);
  ensure(attempt, 404, 'المحاولة غير موجودة.');
  ensure(equalHash(hash(auth(req)), attempt.access_hash), 403, 'لا تملك صلاحية هذه المحاولة.');
  return attempt;
}
// Accept only small, non-executable raster images; the browser resizes and strips metadata.
function decodeOptionImage(raw) {
  ensure(typeof raw==='string',400,'صيغة الصورة غير صحيحة.');
  const match=/^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);
  ensure(match,400,'الصور المدعومة WebP وPNG وJPEG فقط.');
  const bytes=Buffer.from(match[2],'base64');
  ensure(bytes.length>=40&&bytes.length<=180_000,413,'حجم كل صورة يجب ألا يتجاوز 180KB بعد الضغط.');
  const kind=match[1];
  const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR';
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
  ensure((kind==='webp'&&webp)||(kind==='png'&&png)||(kind==='jpeg'&&jpg),400,'ملف الصورة تالف أو لا يطابق امتداده.');
  if(png){const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);ensure(w>0&&h>0&&w<=2500&&h<=2500,400,'أبعاد الصورة غير مقبولة.');}
  return {mime:'image/'+kind,bytes};
}
const publicChallenge = id => {
  const ch = db.prepare('SELECT id,name,avatar,theme,created_at,active FROM challenges WHERE id=?').get(id);
  ensure(ch,404,'هذا الرابط غير موجود.');
  ensure(ch.active,410,'صاحب التحدي أوقف مشاركته مؤقتًا.');
  return { ...ch, questions:db.prepare('SELECT id,position,text,options,category,art_key AS artKey, option_images FROM questions WHERE challenge_id=? ORDER BY position').all(id).map(({option_images,...q}) => ({...q,options:JSON.parse(q.options),imageUrls:JSON.parse(option_images).map(id=>'/api/images/'+id)})) };
};
function getLeaderboard(id) {
  ensure(db.prepare('SELECT id FROM challenges WHERE id=?').get(id),404,'التحدي غير موجود.');
  const rows = db.prepare('SELECT id,name,avatar,score,completed_at FROM attempts WHERE challenge_id=? AND completed_at IS NOT NULL ORDER BY score DESC,completed_at ASC,id ASC LIMIT 100').all(id);
  return rows.map((r,i)=>({...r,rank:i+1}));
}
function getStats(ch) {
  const metrics = db.prepare(`SELECT COUNT(*) AS started, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS finished,
  MAX(CASE WHEN completed_at IS NOT NULL THEN score END) AS best,
  ROUND(AVG(CASE WHEN completed_at IS NOT NULL THEN score END),2) AS average,
  SUM(CASE WHEN completed_at IS NOT NULL AND score=(SELECT COUNT(*) FROM questions WHERE challenge_id=?) THEN 1 ELSE 0 END) AS perfect
  FROM attempts WHERE challenge_id=?`).get(ch.id,ch.id);
  const byQuestion = db.prepare(`SELECT q.position,q.text,COUNT(a.position) AS total,COALESCE(SUM(a.correct),0) AS correct
    FROM questions q LEFT JOIN answers a ON a.position=q.position AND a.attempt_id IN (SELECT id FROM attempts WHERE challenge_id=?)
    WHERE q.challenge_id=? GROUP BY q.position ORDER BY q.position`).all(ch.id,ch.id);
  const distribution = db.prepare('SELECT score,COUNT(*) AS count FROM attempts WHERE challenge_id=? AND completed_at IS NOT NULL GROUP BY score').all(ch.id);
  const full = db.prepare('SELECT id,name,avatar,score,started_at,completed_at,current_index FROM attempts WHERE challenge_id=? ORDER BY completed_at DESC LIMIT 300').all(ch.id);
  return { views:ch.views,started:metrics.started||0,finished:metrics.finished||0,best:metrics.best||0,average:metrics.average||0,perfect:metrics.perfect||0, byQuestion,distribution,participants:full,active:!!ch.active };
}
async function api(req,res,path) {
  rateLimit(req);
  const parts = path.split('/').filter(Boolean);
  const activeAvatars=new Set(['bear','panda','witch','cat','lunar']);
  if(req.method==='GET' && path==='/api/health') {
    const result=db.prepare('PRAGMA quick_check').get();
    ensure(result?.quick_check==='ok',503,'فشل فحص قاعدة البيانات.');
    return json(res,200,{status:'ok',database:'ok'});
  }
  if(req.method === 'POST' && path === '/api/challenges') {
    const data = await body(req);
    const name=clean(data.name,32),avatar=clean(data.avatar,24),theme=clean(data.theme,24);
    ensure(name.length>=2,400,'اكتب اسمًا لا يقل عن حرفين.');
    ensure(activeAvatars.has(avatar),400,'اختر واحدة من الشخصيات الخمس المعتمدة.');
    ensure(['forest','ocean','vampire','classic'].includes(theme),400,'اختر واحدًا من العوالم الأربعة المعتمدة.');
    ensure(Array.isArray(data.questions)&&data.questions.length===10,400,'يجب اختيار 10 أسئلة للتحدي الجديد.');
    const ids = new Set(), texts = new Set();
    const qs=data.questions.map((q,i)=>{
      const text=clean(q.text,145),category=clean(q.category,36)||'خاص';
      ensure(text.length>=6,400,`السؤال ${i+1} قصير جدًا.`);
      ensure(Array.isArray(q.options)&&q.options.length===4,400,`يجب أن يتضمن السؤال ${i+1} أربعة خيارات بالضبط.`);
      const opts=q.options.map(v=>clean(v,70));
      ensure(opts.every(v=>v.length>=1) && new Set(opts).size===opts.length,400,`هناك خيارات مكررة في السؤال ${i+1}.`);
      ensure(Number.isInteger(q.correctIndex) && q.correctIndex>=0 && q.correctIndex<opts.length,400,`حدد الإجابة الصحيحة للسؤال ${i+1}.`);
      ensure(!texts.has(text.toLowerCase()),400,'لا يمكن استخدام السؤال نفسه مرتين.');
      texts.add(text.toLowerCase());
      const key=clean(q.id,60); ensure(!ids.has(key),400,'لا تكرر السؤال.'); ids.add(key);
      let pictures=[];
      if(q.imageData!==undefined&&q.imageData!==null){
        ensure(key.startsWith('custom-'),400,'رفع الصور مخصص للأسئلة الشخصية.');
        ensure(Array.isArray(q.imageData)&&q.imageData.length===4,400,'يجب رفع أربع صور مختلفة للسؤال الشخصي.');
        pictures=q.imageData.map(decodeOptionImage);
      }
      return {text,category,opts,correct:q.correctIndex,artKey:/^p-\d{2}$/.test(key)?key:'',pictures};
    });
    let id = token(9); while(db.prepare('SELECT 1 FROM challenges WHERE id=?').get(id)) id=token(9);
    const secret = token(32);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO challenges (id,owner_hash,name,avatar,theme) VALUES(?,?,?,?,?)').run(id,hash(secret),name,avatar,theme);
      const ins=db.prepare('INSERT INTO questions(id,challenge_id,position,text,options,correct_index,category,art_key,option_images) VALUES(?,?,?,?,?,?,?,?,?)');
      const insImage=db.prepare('INSERT INTO question_images(id,challenge_id,mime,content) VALUES(?,?,?,?)');
      qs.forEach((q,i)=>{
        const ids=q.pictures.map(pic=>{const imageId=token(18);insImage.run(imageId,id,pic.mime,pic.bytes);return imageId});
        ins.run(token(12),id,i,q.text,JSON.stringify(q.opts),q.correct,q.category,q.artKey,JSON.stringify(ids));
      });
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    return json(res,201,{id,ownerToken:secret,name});
  }
  if(req.method==='GET'&&parts.length===3&&parts[1]==='images') {
    const row=db.prepare('SELECT mime,content FROM question_images WHERE id=?').get(parts[2]);
    ensure(row,404,'الصورة غير موجودة.');
    res.writeHead(200,{'Content-Type':row.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=86400','Content-Length':row.content.length});
    return res.end(row.content);
  }
  if(req.method==='GET'&&parts.length===4&&parts[1]==='challenges'&&parts[3]==='my-status') {
    publicChallenge(parts[2]);
    const visitor=existingVisitor(req);
    const current=visitor&&db.prepare('SELECT completed_at,score,current_index FROM attempts WHERE challenge_id=? AND visitor_id=?').get(parts[2],visitor);
    return json(res,200,{status:!current?'new':current.completed_at?'completed':'in-progress', ...(current?.completed_at?{score:current.score}:{})});
  }
  if(req.method === 'GET' && parts.length===3 && parts[1]==='challenges') {
    const ch=publicChallenge(parts[2]);
    db.prepare('UPDATE challenges SET views=views+1 WHERE id=?').run(parts[2]);
    return json(res,200,ch);
  }
  if(req.method==='GET'&&parts.length===4&&parts[1]==='challenges'&&parts[3]==='leaderboard') return json(res,200,{leaders:getLeaderboard(parts[2])});
  if(req.method==='GET'&&parts.length===4&&parts[1]==='challenges'&&parts[3]==='stats') return json(res,200,{stats:getStats(ownerChallenge(req,parts[2]))});
  if(req.method==='PATCH'&&parts.length===3&&parts[1]==='challenges') {
    ownerChallenge(req,parts[2]); const data=await body(req);
    ensure(typeof data.active==='boolean',400,'حدد حالة التحدي.');
    db.prepare('UPDATE challenges SET active=? WHERE id=?').run(data.active?1:0,parts[2]);
    return json(res,200,{active:data.active});
  }
  if(req.method==='DELETE'&&parts.length===3&&parts[1]==='challenges') {
    ownerChallenge(req,parts[2]); db.prepare('DELETE FROM challenges WHERE id=?').run(parts[2]);
    return json(res,200,{deleted:true});
  }
  if(req.method==='POST'&&parts.length===4&&parts[1]==='challenges'&&parts[3]==='resume') {
    publicChallenge(parts[2]);
    const visitor=existingVisitor(req);
    ensure(visitor,404,'لا توجد محاولة محفوظة بهذا المتصفح.');
    const attempt=db.prepare('SELECT * FROM attempts WHERE challenge_id=? AND visitor_id=?').get(parts[2],visitor);
    ensure(attempt,404,'لا توجد محاولة محفوظة بهذا المتصفح.');
    // Issue a fresh bearer token to the same HttpOnly-cookie visitor. The score/answers are never editable.
    const newSecret=token(24);
    db.prepare('UPDATE attempts SET access_hash=? WHERE id=?').run(hash(newSecret),attempt.id);
    return json(res,200,{id:attempt.id,accessToken:newSecret,name:attempt.name,avatar:attempt.avatar,currentIndex:attempt.current_index,score:attempt.score,finished:!!attempt.completed_at});
  }
  if(req.method==='POST'&&parts.length===4&&parts[1]==='challenges'&&parts[3]==='attempts') {
    const ch=publicChallenge(parts[2]); const data=await body(req);
    const name=clean(data.name,32), avatar=clean(data.avatar,8);
    ensure(name.length>=2,400,'أدخل اسمًا لا يقل عن حرفين.');
    ensure(activeAvatars.has(avatar),400,'اختر واحدة من الشخصيات الخمس المعتمدة.');
    const visitor=getVisitor(req,res);
    const existing=db.prepare('SELECT id FROM attempts WHERE challenge_id=? AND visitor_id=?').get(ch.id,visitor);
    if(existing) return json(res,409,{message:'لديك محاولة رسمية سابقة على هذا الجهاز. أكمل محاولتك السابقة، أو شاهد النتائج.', code:'ALREADY_PLAYED'});
    const id=token(12),secret=token(24);
    db.prepare('INSERT INTO attempts(id,challenge_id,visitor_id,access_hash,name,avatar) VALUES(?,?,?,?,?,?)').run(id,ch.id,visitor,hash(secret),name,avatar);
    return json(res,201,{id,accessToken:secret,currentIndex:0,score:0});
  }
  if(req.method==='GET'&&parts.length===3&&parts[1]==='attempts') {
    const a=authorizedAttempt(req,parts[2]);
    return json(res,200,{id:a.id,challengeId:a.challenge_id,name:a.name,avatar:a.avatar,currentIndex:a.current_index,score:a.score,finished:!!a.completed_at});
  }
  if(req.method==='POST'&&parts.length===4&&parts[1]==='attempts'&&parts[3]==='answer') {
    const a=authorizedAttempt(req,parts[2]);
    ensure(!a.completed_at,409,'أكملت التحدي بالفعل.');
    const data=await body(req),position=data.position,choice=data.choice;
    ensure(Number.isInteger(position)&&position===a.current_index,409,'ترتيب السؤال غير صحيح. يرجى تحديث المحاولة.');
    const q=db.prepare('SELECT options,correct_index FROM questions WHERE challenge_id=? AND position=?').get(a.challenge_id,position);
    ensure(q,400,'السؤال غير موجود.');
    ensure(Number.isInteger(choice)&&choice>=0&&choice<JSON.parse(q.options).length,400,'الاختيار غير صحيح.');
    const correct=Number(choice===q.correct_index);
    const total=db.prepare('SELECT COUNT(*) AS n FROM questions WHERE challenge_id=?').get(a.challenge_id).n;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO answers(attempt_id,position,selected,correct) VALUES(?,?,?,?)').run(a.id,position,choice,correct);
      const done=position===total-1;
      db.prepare('UPDATE attempts SET current_index=current_index+1,score=score+?,completed_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=?')
        .run(correct,done?1:0,a.id);
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    return json(res,200,{correct:!!correct,correctIndex:q.correct_index,nextIndex:position+1,finished:position===total-1,...(position===total-1?{score:a.score+correct}:{} )});
  }
  throw err(404,'العنوان المطلوب غير موجود.');
}
const escapeMeta = t => String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.mp3':'audio/mpeg','.m4a':'audio/mp4','.glb':'model/gltf-binary','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  try {
    const u=new URL(req.url,'http://localhost');
    ensure(!u.pathname.includes('..'),400,'رابط غير صالح.');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(),microphone=(),geolocation=()');
    res.setHeader('Content-Security-Policy',CSP);
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    if(u.pathname.startsWith('/api/')) return await api(req,res,u.pathname);
    ensure(req.method==='GET' || req.method==='HEAD',405,'طريقة غير مدعومة.');
    const candidate=resolve(PUBLIC,'.'+u.pathname);
    ensure(candidate===PUBLIC || candidate.startsWith(PUBLIC+'/'),403,'طلب غير صالح.');
    const asset=existsSync(candidate)&&extname(candidate)?candidate:join(PUBLIC,'index.html');
    let content=readFileSync(asset);
    // Rich previews for friend links. Use only trusted deployment origin, never raw Host headers.
    const match=u.pathname.match(/^\/play\/([A-Za-z0-9_-]{6,40})\/?$/);
    if(match && asset.endsWith('index.html')) {
      const ch=db.prepare('SELECT name,theme FROM challenges WHERE id=? AND active=1').get(match[1]);
      if(ch){
        const realm={forest:'الغابة السحرية',ocean:'المحيط',vampire:'قلعة مصاصي الدماء',classic:'القرية الكلاسيكية'}[ch.theme];
        const title=escapeMeta(`قدّيش بتعرف ${ch.name}؟ | V7`);
        const description=escapeMeta(`${ch.name} يتحداك: 10 أسئلة شخصية، عالم ${realm}، ومحاولة واحدة!`);
        const origin=(process.env.PUBLIC_ORIGIN||'').replace(/\/$/,'');
        const meta=`<meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}">${/^https?:\/\//.test(origin)?`<meta property="og:image" content="${escapeMeta(origin)}/assets/worlds/${ch.theme}.webp"><meta property="og:url" content="${escapeMeta(origin)}/play/${match[1]}">`:''}<meta name="twitter:card" content="summary_large_image">`;
        content=Buffer.from(content.toString('utf8').replace('</head>',meta+'</head>').replace('<title>قدّيش بتعرفني؟ V7</title>',`<title>${title}</title>`));
      }
    }
    res.writeHead(200,{'Content-Type':mime[extname(asset)]||'application/octet-stream','Cache-Control':asset.endsWith('.html')?'no-cache':'public, max-age=3600'});
    return res.end(req.method==='HEAD'?undefined:content);
  }catch(e) { if(!res.headersSent) json(res,e.status||500,{message:e.status?e.message:'حدث خطأ غير متوقع في الخادم.'}); else res.end(); if(!e.status) console.error(e); }
});
server.listen(PORT,()=>console.log(`✨ قدّيش بتعرفني؟ http://localhost:${PORT}`));
