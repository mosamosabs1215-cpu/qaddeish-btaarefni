import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {randomBytes} from 'node:crypto';
const temp=mkdtempSync(join(tmpdir(),'qaddeish-test-'));
const port=32000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:temp},stdio:'ignore'});
let live=false;
for(let i=0;i<40;i++){try{const r=await fetch(base+'/');if(r.ok){live=true;break;}}catch{}await pause(100);}
if(!live){child.kill();throw new Error('Server did not start');}
const bank=JSON.parse(readFileSync('./public/questions.json','utf8'));
const headers=(secret,visitor)=>({...secret?{Authorization:'Bearer '+secret}:{},...visitor?{Cookie:'qm_visitor='+visitor}:{}});
async function api(url,method='GET',body,head={}){const r=await fetch(base+url,{method,headers:{...head,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),headers:r.headers};}
function draft(name,ix){return {name,avatar:'😎',theme:'sunny',questions:bank.slice(0,15).map((q,i)=>({...q,correctIndex:ix}))};}
let a,b;
test('bank contains at least 200 valid questions from 20 categories',()=>{
 assert.ok(bank.length>=200);assert.ok(new Set(bank.map(q=>q.category)).size>=20);
 for(const q of bank){assert.ok(q.text.length>=6);assert.equal(q.options.length,6);assert.equal(new Set(q.options).size,6);}
});
test('creates two isolated challenges with unique links',async()=>{
 const r1=await api('/api/challenges','POST',draft('موسى',0));const r2=await api('/api/challenges','POST',draft('أحمد',1));
 assert.equal(r1.status,201);assert.equal(r2.status,201);a=r1.data;b=r2.data;assert.notEqual(a.id,b.id);
 const pub1=await api('/api/challenges/'+a.id),pub2=await api('/api/challenges/'+b.id);
 assert.equal(pub1.data.name,'موسى');assert.equal(pub2.data.name,'أحمد');
 assert.equal(pub1.data.questions.length,15);assert.ok(!JSON.stringify(pub1.data).includes('correct_index'));assert.ok(!JSON.stringify(pub1.data).includes('correctIndex'));
});
test('rejects invalid length, duplicate answer and unowned private data',async()=>{
 const bad=await api('/api/challenges','POST',{...draft('اختبار',0),questions:bank.slice(0,3)});assert.equal(bad.status,400);
 const unauthorized=await api('/api/challenges/'+a.id+'/stats');assert.equal(unauthorized.status,403);
});
async function play(ch,ix,correct){const visitor=randomBytes(24).toString('base64url');const start=await api('/api/challenges/'+ch.id+'/attempts','POST',{name:correct?'صاحب العلامة الكاملة':'صديق جديد',avatar:'🤠'},headers(null,visitor));assert.equal(start.status,201);const {id,accessToken}=start.data;let last;
 for(let j=0;j<15;j++){last=await api('/api/attempts/'+id+'/answer','POST',{position:j,choice:ix},headers(accessToken,visitor));assert.equal(last.status,200);assert.equal(last.data.correct,correct);}
 assert.equal(last.data.score,correct?15:0);assert.equal(last.data.finished,true);
 const details=await api('/api/attempts/'+id,'GET',null,headers(accessToken,visitor));assert.equal(details.data.score,correct?15:0);assert.equal(details.data.currentIndex,15);
 const replay=await api('/api/attempts/'+id+'/answer','POST',{position:14,choice:ix},headers(accessToken,visitor));assert.equal(replay.status,409);
 const duplicate=await api('/api/challenges/'+ch.id+'/attempts','POST',{name:'ثانية',avatar:'😎'},headers(null,visitor));assert.equal(duplicate.status,409);
 return id;
}
test('scores a perfect 15/15 submission server-side',async()=>{await play(a,0,true);});
test('scores zero with wrong answers for another owner',async()=>{await play(b,0,false);});
test('separate leaderboards and owner statistics',async()=>{
 const lbA=await api('/api/challenges/'+a.id+'/leaderboard');const lbB=await api('/api/challenges/'+b.id+'/leaderboard');
 assert.equal(lbA.data.leaders.length,1);assert.equal(lbB.data.leaders.length,1);
 assert.equal(lbA.data.leaders[0].score,15);assert.equal(lbB.data.leaders[0].score,0);
 const sa=await api('/api/challenges/'+a.id+'/stats','GET',null,headers(a.ownerToken));
 const sb=await api('/api/challenges/'+b.id+'/stats','GET',null,headers(b.ownerToken));
 assert.equal(sa.data.stats.finished,1);assert.equal(sa.data.stats.perfect,1);assert.equal(sa.data.stats.average,15);
 assert.equal(sb.data.stats.finished,1);assert.equal(sb.data.stats.average,0);
 assert.equal(sa.data.stats.byQuestion[0].correct,1);assert.equal(sb.data.stats.byQuestion[0].correct,0);
});
test('owners can stop and delete only their own challenge',async()=>{
 const disallow=await api('/api/challenges/'+a.id,'PATCH',{active:false},headers(b.ownerToken));assert.equal(disallow.status,403);
 const pauseQuiz=await api('/api/challenges/'+a.id,'PATCH',{active:false},headers(a.ownerToken));assert.equal(pauseQuiz.status,200);
 const blocked=await api('/api/challenges/'+a.id);assert.equal(blocked.status,410);
 const restart=await api('/api/challenges/'+a.id,'PATCH',{active:true},headers(a.ownerToken));assert.equal(restart.status,200);
 const deleted=await api('/api/challenges/'+a.id,'DELETE',null,headers(a.ownerToken));assert.equal(deleted.status,200);
 const gone=await api('/api/challenges/'+a.id);assert.equal(gone.status,404);
});
after(()=>{child.kill('SIGTERM');rmSync(temp,{recursive:true,force:true});});
