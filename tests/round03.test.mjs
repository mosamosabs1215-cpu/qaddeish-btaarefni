import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..');
const q=JSON.parse(readFileSync(path.join(root,'public/questions.json'),'utf8'));
test('V7: twenty personal prompts; academic dream replaced with fantasy world preference',()=>{
 assert.equal(q.length,20);assert.equal(new Set(q.map(x=>x.id)).size,20);
 const newQ=q.find(x=>x.id==='p-08'); assert.match(newQ.text,/مغامرة خيالية/);assert.doesNotMatch(newQ.text,/دراس|مدرس|الصف/);
 assert.deepEqual(newQ.options,['الغابة السحرية','المحيط والجزر','قلعة مصاصي الدماء','القرية الكلاسيكية']);
 for(let i=0;i<4;i++)assert.ok(existsSync(path.join(root,`public/assets/answers/p-08-${i}.webp`)));
});
test('V7: artwork wired to all five cinematic beats in all worlds, never baked score',()=>{
 for(const w of ['forest','ocean','vampire','classic'])for(const beat of ['meeting','reply','suspense','reveal','finale'])assert.ok(existsSync(path.join(root,`public/assets/cinematics/${w}/${beat}.webp`)));
 const app=readFileSync(path.join(root,'public/app.js'),'utf8');assert.match(app,/cinematicImage\(state.theme,beat.id\)/);assert.doesNotMatch(app,/data-action="replay-story"/);
 assert.match(app,/renderParticipants\(s.participants\)/);assert.match(app,/statsRefreshTimer=setInterval\(refreshStatsQuietly,12000\)/);
 assert.match(app,/function murmur\(character(?:,mood='steady')?\)/);
});
test('V7: same browser cannot open second attempt; completed participant displayed on admin stats and leaderboard',async t=>{
 const port=36700+Math.floor(Math.random()*1000), base=`http://127.0.0.1:${port}`;
 const dbDir=mkdtempSync(path.join(os.tmpdir(),'v7-round03-'));
 const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:dbDir},stdio:'ignore'});
 t.after(()=>{server.kill();rmSync(dbDir,{recursive:true,force:true})});
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,80))}
 const api=async(route,method='GET',data,token,cookie)=>{
  const r=await fetch(base+route,{method,headers:{...(data?{'content-type':'application/json'}:{}),...(token?{'authorization':'Bearer '+token}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});
  return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};
 };
 const questions=Array.from({length:10},(_,i)=>({id:'p-'+String(i+1).padStart(2,'0'),text:`شو السؤال الشخصي رقم ${i+1} لصديقي؟`,options:['أ','ب','ج','د'],correctIndex:0,category:'تفضيلات'}));
 const c=await api('/api/challenges','POST',{name:'موسى',theme:'forest',avatar:'cat',questions});assert.equal(c.status,201);
 const id=c.body.id, owner=c.body.ownerToken;
 const first=await api(`/api/challenges/${id}/attempts`,'POST',{name:'ليلى',avatar:'witch'});assert.equal(first.status,201);
 const cookie=first.cookie.split(';')[0];
 const dupe=await api(`/api/challenges/${id}/attempts`,'POST',{name:'ليلى مرة ثانية',avatar:'panda'},null,cookie);assert.equal(dupe.status,409);
 const pending=await api(`/api/challenges/${id}/stats`,'GET',null,owner);assert.equal(pending.body.stats.participants[0].name,'ليلى');assert.equal(pending.body.stats.participants[0].completed_at,null);
 let a;for(let i=0;i<10;i++){a=await api(`/api/attempts/${first.body.id}/answer`,'POST',{position:i,choice:i===9?1:0},first.body.accessToken,cookie);assert.equal(a.status,200)}
 assert.equal(a.body.score,9);
 const again=await api(`/api/attempts/${first.body.id}/answer`,'POST',{position:9,choice:0},first.body.accessToken,cookie);assert.equal(again.status,409);
 const stats=await api(`/api/challenges/${id}/stats`,'GET',null,owner); assert.equal(stats.body.stats.finished,1);assert.equal(stats.body.stats.participants[0].score,9);assert.ok(stats.body.stats.participants[0].completed_at);
 const leaderboard=await api(`/api/challenges/${id}/leaderboard`);assert.equal(leaderboard.body.leaders[0].name,'ليلى');assert.equal(leaderboard.body.leaders[0].score,9);
});
