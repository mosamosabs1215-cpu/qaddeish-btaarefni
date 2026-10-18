import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { PEOPLE, WORLDS, FINALE_SCRIPTS, OUTCOMES, buildStory, portrait, portraitCard, cinematicImage, resultBand } from '../public/story.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
test('R08: all six endings have five distinct authored beats with no dialogue shared between endings',()=>{
 assert.equal(FINALE_SCRIPTS.length,6);
 const all=[];
 for(let i=0;i<6;i++){
  const score=[10,9,7,5,3,0][i];
  const beats=buildStory({score,ownerName:'موسى',friendName:'ليلى'});
  assert.equal(beats.length,5);
  assert.ok(beats.some(x=>x.speaker==='owner')&&beats.some(x=>x.speaker==='friend'));
  assert.equal(beats[3].text.includes(`${score} من 10`),true);
  assert.deepEqual(beats.map(x=>x.id),['meeting','reply','suspense','reveal','finale']);
  assert.deepEqual(beats.map(x=>x.shot),['wide','closer','dramatic','reveal','finale']);
  assert.ok(beats.every(x=>x.mood===OUTCOMES[i].mood&&x.caption&&x.effect));
  all.push(...beats.map(b=>b.text));
 }
 assert.equal(new Set(all).size,30);
});
test('R08: full 24 world/ending x five shots and five original source portraits remain addressable',()=>{
 for(const world of WORLDS){for(const score of [0,2,4,6,8,10]){
  const shots=buildStory({score,ownerName:'صاحب التحدي',friendName:'رفيقه'});
  for(const beat of shots){
   const img=path.join(root,'public',cinematicImage(world.id,beat.id).slice(1));
   const webp=readFileSync(img);assert.equal(webp.toString('ascii',0,4),'RIFF');
  }
  for(const creator of PEOPLE){for(const friend of PEOPLE){
   for(const p of [creator,friend]){
    const pathname=portrait(p.id);assert.match(pathname,/-master\.png$/);
    const src=readFileSync(path.join(root,'public',pathname.slice(1)));
    assert.equal(src.readUInt32BE(16),1086);assert.equal(src.readUInt32BE(20),1448);
   }
  }}
 }}
});
test('R08: user character master assets are only in the story; framed cards on selectors; no cropping',()=>{
 const app=read('public/app.js'),style=read('public/styles.css');
 assert.match(app,/function personCard\(p,selected,action\)/);
 assert.match(app,/class="actor owner" src="\$\{portrait\(owner\)\}"/);
 assert.match(app,/class="actor friend" src="\$\{portrait\(friend\)\}"/);
 assert.match(app,/data-mood="\$\{mood\}"/);assert.match(app,/data-effect="\$\{effect\}"/);
 assert.match(style,/story-stage \.actor\{[^}]*object-fit:contain!important/);
 assert.match(style,/avatar-card img\{[^}]*object-fit:contain!important/);
 assert.doesNotMatch(style,/\.round08-stage \.actor[^\n]*object-fit:\s*cover/);
 assert.ok(PEOPLE.every(p=>portraitCard(p.id).endsWith('-card.webp')));
});
test('R08: final chapter pause/resume and exit invalidate old typewriter timers',()=>{
 const app=read('public/app.js');
 assert.match(app,/state\.typeTimer=setTimeout\(step,32\)/);
 assert.match(app,/state\.lineVersion\+\+/);
 assert.match(app,/case'story-pause'.*clearTimeout\(state\.typeTimer\)/);
 assert.match(app,/function finishStory\(\)\{clearTimeout\(autoplayTimeout\);clearTimeout\(state\.typeTimer\)/);
});
