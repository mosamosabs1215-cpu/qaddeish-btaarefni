import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
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
`);

const PORT = Number(process.env.PORT || 3000);
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
  for await (const chunk of req) { size += chunk.length; ensure(size <= 150000, 413, 'البيانات أكبر من المسموح.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw err(400, 'صيغة البيانات غير صحيحة.'); }
}
function getVisitor(req, res) {
  const match = (req.headers.cookie||'').match(/(?:^|;\s*)qm_visitor=([A-Za-z0-9_-]{20,80})(?:;|$)/);
  if(match) return match[1];
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
const publicChallenge = id => {
  const ch = db.prepare('SELECT id,name,avatar,theme,created_at,active FROM challenges WHERE id=?').get(id);
  ensure(ch,404,'هذا الرابط غير موجود.');
  ensure(ch.active,410,'صاحب التحدي أوقف مشاركته مؤقتًا.');
  return { ...ch, questions:db.prepare('SELECT id,position,text,options,category FROM questions WHERE challenge_id=? ORDER BY position').all(id).map(q => ({...q,options:JSON.parse(q.options)})) };
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
  SUM(CASE WHEN completed_at IS NOT NULL AND score=15 THEN 1 ELSE 0 END) AS perfect
  FROM attempts WHERE challenge_id=?`).get(ch.id);
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
  if(req.method === 'POST' && path === '/api/challenges') {
    const data = await body(req);
    const name=clean(data.name,32),avatar=clean(data.avatar,8),theme=clean(data.theme,20);
    ensure(name.length>=2,400,'اكتب اسمًا لا يقل عن حرفين.');
    ensure(/^.{1,8}$/u.test(avatar),400,'اختر شخصية رمزية.');
    ensure(['sunny','lavender','aqua','peach'].includes(theme),400,'اللون غير متاح.');
    ensure(Array.isArray(data.questions)&&data.questions.length===15,400,'اختر 15 سؤالًا بالضبط.');
    const ids = new Set(), texts = new Set();
    const qs=data.questions.map((q,i)=>{
      const text=clean(q.text,145),category=clean(q.category,36)||'خاص';
      ensure(text.length>=6,400,`السؤال ${i+1} قصير جدًا.`);
      ensure(Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=6,400,`خيارات السؤال ${i+1} غير صالحة.`);
      const opts=q.options.map(v=>clean(v,70));
      ensure(opts.every(v=>v.length>=1) && new Set(opts).size===opts.length,400,`هناك خيارات مكررة في السؤال ${i+1}.`);
      ensure(Number.isInteger(q.correctIndex) && q.correctIndex>=0 && q.correctIndex<opts.length,400,`حدد الإجابة الصحيحة للسؤال ${i+1}.`);
      ensure(!texts.has(text.toLowerCase()),400,'لا يمكن استخدام السؤال نفسه مرتين.');
      texts.add(text.toLowerCase());
      const key=clean(q.id,60); ensure(!ids.has(key),400,'لا تكرر السؤال.'); ids.add(key);
      return {text,category,opts,correct:q.correctIndex};
    });
    let id = token(9); while(db.prepare('SELECT 1 FROM challenges WHERE id=?').get(id)) id=token(9);
    const secret = token(32);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO challenges (id,owner_hash,name,avatar,theme) VALUES(?,?,?,?,?)').run(id,hash(secret),name,avatar,theme);
      const ins=db.prepare('INSERT INTO questions(id,challenge_id,position,text,options,correct_index,category) VALUES(?,?,?,?,?,?,?)');
      qs.forEach((q,i)=>ins.run(token(12),id,i,q.text,JSON.stringify(q.opts),q.correct,q.category));
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    return json(res,201,{id,ownerToken:secret,name});
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
  if(req.method==='POST'&&parts.length===4&&parts[1]==='challenges'&&parts[3]==='attempts') {
    const ch=publicChallenge(parts[2]); const data=await body(req);
    const name=clean(data.name,32), avatar=clean(data.avatar,8);
    ensure(name.length>=2,400,'أدخل اسمًا لا يقل عن حرفين.');
    ensure(avatar.length>=1,400,'اختر صورة رمزية.');
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
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO answers(attempt_id,position,selected,correct) VALUES(?,?,?,?)').run(a.id,position,choice,correct);
      const done=position===14;
      db.prepare('UPDATE attempts SET current_index=current_index+1,score=score+?,completed_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=?')
        .run(correct,done?1:0,a.id);
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    return json(res,200,{correct:!!correct,nextIndex:position+1,finished:position===14,...(position===14?{score:a.score+correct}:{} )});
  }
  throw err(404,'العنوان المطلوب غير موجود.');
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try {
    const u=new URL(req.url,'http://localhost');
    ensure(!u.pathname.includes('..'),400,'رابط غير صالح.');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(),microphone=(),geolocation=()');
    if(u.pathname.startsWith('/api/')) return await api(req,res,u.pathname);
    ensure(req.method==='GET' || req.method==='HEAD',405,'طريقة غير مدعومة.');
    const candidate=resolve(PUBLIC,'.'+u.pathname);
    ensure(candidate.startsWith(PUBLIC),403,'طلب غير صالح.');
    const asset=existsSync(candidate)&&extname(candidate)?candidate:join(PUBLIC,'index.html');
    const content=readFileSync(asset);
    res.writeHead(200,{'Content-Type':mime[extname(asset)]||'application/octet-stream','Cache-Control':asset.endsWith('.html')?'no-cache':'public, max-age=3600'});
    return res.end(req.method==='HEAD'?undefined:content);
  }catch(e) { if(!res.headersSent) json(res,e.status||500,{message:e.status?e.message:'حدث خطأ غير متوقع في الخادم.'}); else res.end(); if(!e.status) console.error(e); }
});
server.listen(PORT,()=>console.log(`✨ قدّيش بتعرفني؟ http://localhost:${PORT}`));
