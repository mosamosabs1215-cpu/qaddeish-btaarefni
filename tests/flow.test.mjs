import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT=34500+Math.floor(Math.random()*1000);const URL=`http://127.0.0.1:${PORT}`;
const dbDir=mkdtempSync(path.join(os.tmpdir(),'v7-tests-'));
const server=spawn(process.execPath,['server.mjs'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,DATA_DIR:dbDir,PORT:String(PORT)},stdio:['ignore','pipe','pipe']});
let err='';server.stderr.on('data',b=>err+=String(b));
async function ready(){for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error('server exit '+err);try{const x=await fetch(URL);if(x.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server failed '+err)}
async function api(route,{method='GET',data,token,cookie}={}){const r=await fetch(URL+route,{method,headers:{...(data?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});const v=await r.json();return {status:r.status,body:v,cookie:r.headers.get('set-cookie')}}
const options=['الأول','الثاني','الثالث','الرابع'];
const make=(name,theme='forest',avatar='bear')=>api('/api/challenges',{method:'POST',data:{name,theme,avatar,questions:Array.from({length:10},(_,i)=>({id:`q${i}`,text:`كم بتحب السؤال رقم ${i+1} عني؟`,options,correctIndex:i%4,category:'أصدقاء'}))}});
async function finish(id,score,avatar,username){const start=await api(`/api/challenges/${id}/attempts`,{method:'POST',data:{name:username,avatar}});assert.equal(start.status,201);const t=start.body.accessToken;let incorrect=0;for(let i=0;i<10;i++){const choice=i<score?i%4:(i+1)%4;const answer=await api(`/api/attempts/${start.body.id}/answer`,{method:'POST',token:t,data:{position:i,choice}});assert.equal(answer.status,200);assert.equal(answer.body.correct,i<score);if(!answer.body.correct)incorrect++;if(i!==9)assert.equal(answer.body.score,undefined);else assert.equal(answer.body.score,score)}const a=await api(`/api/attempts/${start.body.id}`,{token:t});assert.equal(a.body.score,score);assert.equal(a.body.finished,true);return start.body}

test('V7: persistent creator/friend flows, exact scoring, isolation, owner auth, worlds',async t=>{
 await ready();t.after(()=>{server.kill('SIGTERM');rmSync(dbDir,{recursive:true,force:true})});
 const bad=await api('/api/challenges',{method:'POST',data:{name:'موسى',avatar:'bear',theme:'forest',questions:[]}});assert.equal(bad.status,400);
 const c1=await make('موسى','forest','witch');assert.equal(c1.status,201);assert.ok(c1.body.ownerToken);
 const c2=await make('فرات','vampire','lunar');assert.equal(c2.status,201);assert.notEqual(c1.body.id,c2.body.id);
 const illustrated=await api('/api/challenges',{method:'POST',data:{name:'عينة مصوّرة',avatar:'bear',theme:'ocean',questions:Array.from({length:10},(_,i)=>({id:`p-${String(i+1).padStart(2,'0')}`,text:`شو السؤال الشخصي ${i+1} عند عينة مصوّرة؟`,options,correctIndex:2,category:'ذوقي'}))}});
 assert.equal(illustrated.status,201);
 const illustratedPublic=await api(`/api/challenges/${illustrated.body.id}`);
 assert.equal(illustratedPublic.body.questions[0].artKey,'p-01');
 assert.equal(illustratedPublic.body.questions[9].artKey,'p-10');
 const picture=await fetch(URL+'/assets/answers/p-01-0.webp');
 assert.equal(picture.status,200);assert.match(picture.headers.get('content-type'),/image\/webp/);
 const public1=await api(`/api/challenges/${c1.body.id}`);assert.equal(public1.body.theme,'forest');assert.equal(public1.body.avatar,'witch');assert.equal(public1.body.questions.length,10);assert.equal(JSON.stringify(public1.body).includes('correct_index'),false);
 const public2=await api(`/api/challenges/${c2.body.id}`);assert.equal(public2.body.theme,'vampire');assert.equal(public2.body.avatar,'lunar');
 await finish(c1.body.id,10,'panda','أحمد');await finish(c1.body.id,0,'cat','سامر');await finish(c1.body.id,5,'bear','سارة');
 await finish(c2.body.id,8,'witch','صديق آخر');
 const board=await api(`/api/challenges/${c1.body.id}/leaderboard`);assert.deepEqual(board.body.leaders.map(x=>x.score),[10,5,0]);assert.equal(board.body.leaders.length,3);
 const board2=await api(`/api/challenges/${c2.body.id}/leaderboard`);assert.deepEqual(board2.body.leaders.map(x=>x.score),[8]);
 const noStats=await api(`/api/challenges/${c1.body.id}/stats`);assert.equal(noStats.status,403);
 const stats=await api(`/api/challenges/${c1.body.id}/stats`,{token:c1.body.ownerToken});assert.equal(stats.status,200);assert.equal(stats.body.stats.finished,3);assert.equal(stats.body.stats.average,5);
 const close=await api(`/api/challenges/${c1.body.id}`,{method:'PATCH',token:c1.body.ownerToken,data:{active:false}});assert.equal(close.status,200);
 const disabled=await api(`/api/challenges/${c1.body.id}`);assert.equal(disabled.status,410);
 const stillOpen=await api(`/api/challenges/${c2.body.id}`);assert.equal(stillOpen.status,200);
 const reenable=await api(`/api/challenges/${c1.body.id}`,{method:'PATCH',token:c1.body.ownerToken,data:{active:true}});assert.equal(reenable.status,200);
 const bytes=await fetch(URL+'/assets/official-home.png');assert.equal(bytes.status,200);assert.match(bytes.headers.get('content-type'),/image\/png/);
 const app=await fetch(URL+'/app.js');assert.equal(app.status,200);assert.match(await app.text(),/launchStory/);
});
