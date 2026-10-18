import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'..');
const JS=readFileSync(path.join(ROOT,'public/app.js'),'utf8');
const SERVER=readFileSync(path.join(ROOT,'server.mjs'),'utf8');
// A minimal genuine PNG (1x1, >40 bytes) to exercise uploaded-media validation.
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y+ONlUAAAAASUVORK5CYII=';
const customPictures=[png,png,png,png];
const makeQuestions=({withImages=false,incomplete=false,invalid=false}={})=>Array.from({length:10},(_,i)=>({id:i===0?'custom-photo-test':'p-'+String(i+1).padStart(2,'0'),text:`شو السؤال الشخصي رقم ${i+1} عند صاحب التحدي؟`,options:['أحمر','أزرق','أسود','أخضر'],correctIndex:i%4,category:'شخصي',...(i===0&&withImages?{imageData:incomplete?[png,null,null,null]:invalid?[png.replace('image/png','image/svg+xml'),...customPictures.slice(1)]:customPictures}:{})}));
async function fixture(t){
 const port=38000+Math.floor(Math.random()*3000),base=`http://127.0.0.1:${port}`,dir=mkdtempSync(path.join(os.tmpdir(),'v7-r5-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:ROOT,env:{...process.env,PORT:String(port),DATA_DIR:dir,PUBLIC_ORIGIN:'https://v7.example.test'},stdio:'ignore'});
 t.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true})});
 let ready=false;for(let i=0;i<85;i++){try{ready=(await fetch(base)).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,50))}
 assert.ok(ready,'server started');
 const req=async(route,method='GET',data,token,cookie)=>{
  const r=await fetch(base+route,{method,headers:{...(data?{'content-type':'application/json'}:{}),...(token?{'authorization':'Bearer '+token}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});
  const type=r.headers.get('content-type')||'';return {status:r.status,data:type.includes('application/json')?await r.json():type.startsWith('image/')?Buffer.from(await r.arrayBuffer()):await r.text(),type,cookie:r.headers.get('set-cookie'),headers:r.headers};
 };
 return {req,base};
}
test('Round 05: four images persist and render via challenge share URL; admin still protects private answers',async t=>{
 const {req}=await fixture(t);
 const created=await req('/api/challenges','POST',{name:'موسى',avatar:'bear',theme:'ocean',questions:makeQuestions({withImages:true})});assert.equal(created.status,201,JSON.stringify(created.data));
 const {id,ownerToken}=created.data;
 const ch=await req('/api/challenges/'+id);assert.equal(ch.status,200);
 assert.equal(ch.data.questions[0].imageUrls.length,4);assert.ok(ch.data.questions[0].imageUrls.every(x=>x.startsWith('/api/images/')));
 assert.equal('correct_index' in ch.data.questions[0],false);
 for(const url of ch.data.questions[0].imageUrls){const r=await req(url);assert.equal(r.status,200);assert.equal(r.type,'image/png');assert.equal(r.data[0],137)}
 assert.equal((await req('/api/challenges/'+id+'/stats')).status,403);
 assert.equal((await req('/api/challenges/'+id+'/stats','GET',null,ownerToken)).status,200);
 const page=await req('/play/'+id);assert.match(page.data,/og:title/);assert.match(page.data,/موسى/);assert.match(page.data,/https:\/\/v7.example.test\/assets\/worlds\/ocean.webp/);
});
test('Round 05: rejects partial photo selections and active SVG payloads, without leaving challenges',async t=>{
 const {req}=await fixture(t);
 for(const style of [{withImages:true,incomplete:true},{withImages:true,invalid:true}]){
  const r=await req('/api/challenges','POST',{name:'موسى',avatar:'witch',theme:'forest',questions:makeQuestions(style)});
  assert.equal(r.status,400,JSON.stringify(r.data));
 }
});
test('Round 05: friend arrival detects completed attempts from httpOnly cookie; repeat is forbidden',async t=>{
 const {req}=await fixture(t);
 const c=await req('/api/challenges','POST',{name:'موسى',avatar:'cat',theme:'forest',questions:makeQuestions()});assert.equal(c.status,201);
 const id=c.data.id;
 assert.equal((await req(`/api/challenges/${id}/my-status`)).data.status,'new');
 const a=await req(`/api/challenges/${id}/attempts`,'POST',{name:'هلا',avatar:'panda'});assert.equal(a.status,201);
 const cookie=a.cookie.split(';')[0];
 assert.equal((await req(`/api/challenges/${id}/my-status`,'GET',null,null,cookie)).data.status,'in-progress');
 const recovered=await req(`/api/challenges/${id}/resume`,'POST',undefined,undefined,cookie);
 assert.equal(recovered.status,200);
 assert.equal(recovered.data.currentIndex,0);
 assert.equal(recovered.data.name,'هلا');
 assert.notEqual(recovered.data.accessToken,a.data.accessToken);
 assert.equal((await req(`/api/attempts/${a.data.id}`,'GET',undefined,a.data.accessToken,cookie)).status,403);
 for(let i=0;i<10;i++)assert.equal((await req(`/api/attempts/${a.data.id}/answer`,'POST',{position:i,choice:i%4},recovered.data.accessToken,cookie)).status,200);
 const status=await req(`/api/challenges/${id}/my-status`,'GET',null,null,cookie);
 assert.equal(status.data.status,'completed');assert.equal(status.data.score,10);
 const again=await req(`/api/challenges/${id}/resume`,'POST',undefined,undefined,cookie);
 assert.equal(again.status,200);assert.equal(again.data.finished,true);assert.equal(again.data.score,10);
 assert.equal((await req(`/api/challenges/${id}/attempts`,'POST',{name:'هلا',avatar:'bear'},null,cookie)).status,409);
 const board=await req(`/api/challenges/${id}/leaderboard`);assert.equal(board.data.leaders[0].name,'هلا');
});
test('Round 05: image UI and safe sounds are integrated',()=>{
 assert.match(JS,/id="custom-photo-\$\{i\}"/);assert.match(JS,/async function compressPicture\(file\)/);
 assert.match(JS,/imageUrls\?\.\[i\]/);assert.match(JS,/state.visitorStatus/);
 assert.match(JS,/const cues=\{/);assert.match(JS,/function join\(\)/);
 assert.match(SERVER,/CREATE TABLE IF NOT EXISTS question_images/);
 assert.match(SERVER,/PUBLIC_ORIGIN/);
});
