import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dirname=path.resolve(import.meta.dirname,'..');
const dir=mkdtempSync(path.join(tmpdir(),'v7-options-'));
const port=39000+Math.floor(Math.random()*900);
const base=`http://127.0.0.1:${port}`;
const proc=spawn(process.execPath,['server.mjs'],{cwd:dirname,env:{...process.env,NODE_ENV:'development',DATA_DIR:dir,PORT:String(port)},stdio:'ignore'});
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,60))}throw Error('server did not start')}
function payload(n){return {name:'موسى',avatar:'bear',theme:'forest',questions:Array.from({length:10},(_,i)=>({id:`test-${i}`,text:`سؤال الاختبار الشخصي رقم ${i+1}؟`,options:['الخيار الأول','الخيار الثاني','الخيار الثالث','الخيار الرابع'].slice(0,n),correctIndex:0,category:'اختبار'}))}}
test('شرط الأربعة خيارات إلزامي على الخادم وليس الواجهة فقط',async t=>{
 t.after(()=>{proc.kill('SIGTERM');rmSync(dir,{recursive:true,force:true})});
 await ready();
 for(const [n,expectCode] of [[2,400],[3,400],[4,201],[5,400],[6,400]]){
  const p=payload(n);if(n>4){for(const q of p.questions){q.options.push('الخيار الخامس');if(n===6)q.options.push('الخيار السادس')}}
  const r=await fetch(base+'/api/challenges',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)});
  assert.equal(r.status,expectCode,`with ${n} options`);
  const data=await r.json();
  if(expectCode===201){const publicData=await (await fetch(base+'/api/challenges/'+data.id)).json();assert.ok(publicData.questions.every(q=>q.options.length===4))}
 }
});
