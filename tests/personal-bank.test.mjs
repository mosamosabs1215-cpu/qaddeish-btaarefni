import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const bank=JSON.parse(readFileSync(path.join(root,'public','questions.json'),'utf8'));
test('V7: only twenty intimate personal preference questions, four distinct options each',()=>{
 assert.equal(bank.length,20);
 assert.equal(new Set(bank.map(q=>q.id)).size,20);
 for(const q of bank){
  assert.match(q.id,/^p-\d\d$/);
  assert.ok(q.text.includes('{name}'),q.text);
  assert.equal(q.options.length,4,q.text);
  assert.equal(new Set(q.options).size,4,q.text);
  for(let i=0;i<4;i++)assert.ok(existsSync(path.join(root,'public','assets','answers',`${q.id}-${i}.webp`)));
 }
});
test('V7: creator-side owner-name materialization and image selection are wired',()=>{
 const script=readFileSync(path.join(root,'public','app.js'),'utf8');
 assert.match(script,/function questionLabel\(q\)/);
 assert.match(script,/text:questionLabel\(q\),correctIndex:i/);
 assert.match(script,/const artKey=q.artKey\|\|q.id/);
 assert.match(script,/\/\^\(p-\|v2-\)\//);
});
