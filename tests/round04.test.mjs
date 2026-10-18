import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const app=readFileSync(join(root,'public/app.js'),'utf8');
const css=readFileSync(join(root,'public/styles.css'),'utf8');
const questions=JSON.parse(readFileSync(join(root,'public/questions.json'),'utf8'));
test('Round 04: real homepage selectors and audio toggles are active controls',()=>{
 assert.match(app,/data-action="hero-person"/);assert.match(app,/data-action="hero-world"/);
 assert.match(app,/picker-avatars/);assert.match(app,/picker-worlds/);
 assert.match(app,/case'toggle-music'/);assert.match(app,/function worldChime\(world\)/);
 assert.match(app,/configureAudio\(\)/);assert.match(app,/pref\.music=false|music:false/);
 assert.match(css,/\.picker-avatar\.active/);assert.match(css,/\.picker-world\.active/);
 for(const world of ['forest','ocean','vampire','classic']){
  const path=join(root,'public/assets/audio',world+'.mp3');
  assert.ok(existsSync(path)&&statSync(path).size>10000);
 }
});
test('Round 04: four visual options each, render as interactive DOM with packaged illustrations',()=>{
 assert.equal(questions.length,20);
 assert.ok(questions.every(q=>q.options.length===4));
 for(const q of questions){for(let i=0;i<4;i++){
   assert.ok(existsSync(join(root,`public/assets/answers/${q.id}-${i}.webp`)),`${q.id} option ${i}`);
 }}
 assert.match(app,/class="answer/);assert.match(app,/data-action="\$\{mode==='creator'\?'choose-correct':'answer'\}"/);
 assert.match(css,/\.cinematic-quiz \.answer:hover/);
 assert.match(css,/\.answer\.chosen \.answer-check\{display:grid\}/);
});
test('Round 04: story uses dynamic text and scores over world-specific artwork',()=>{
 assert.match(app,/cinematicImage\(state.theme,beat.id\)/);
 assert.match(app,/const next=new Image\(\)/);
 assert.match(app,/<strong>\$\{state.score\}\/10<\/strong>/);
 assert.match(app,/murmur\(beat.speaker===/);
 assert.doesNotMatch(app,/data-action="replay-story"|setTimeout\([^\n]*31000/);
});
