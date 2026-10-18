import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {portrait, portraitCard, PEOPLE} from '../public/story.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chars=path.join(root,'public/assets/characters');
const app=readFileSync(path.join(root,'public/app.js'),'utf8');
const style=readFileSync(path.join(root,'public/styles.css'),'utf8');
test('Rule 10: the five exact RGBA user originals are used outside character selection',()=>{
 for(const p of PEOPLE){
   const src=portrait(p.id); assert.equal(src,`/assets/characters/${p.id}-master.png`);
   const data=readFileSync(path.join(chars,`${p.id}-master.png`));
   assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');
   assert.equal(data.readUInt32BE(16),1086);assert.equal(data.readUInt32BE(20),1448);
   assert.equal(data[25],6,'must preserve full RGBA transparency');
   assert.ok(statSync(path.join(chars,`${p.id}-restored.webp`)).size>100_000);
 }
 assert.match(app,/friend-owner-portrait.*?portrait\(ch.avatar\)/s);
 assert.match(app,/class="actor owner" src="\$\{portrait\(owner\)\}"/);
 assert.match(app,/class="actor friend" src="\$\{portrait\(friend\)\}"/);
 assert.doesNotMatch(app,/cutout\.webp/);
 assert.match(style,/story-stage \.actor\{[^}]*object-fit:contain!important/);
});
test('Rule 10: only original decorated user cards are used for selection, with no forced crop',()=>{
 for(const p of PEOPLE){assert.equal(portraitCard(p.id),`/assets/characters/${p.id}-card.webp`);assert.ok(statSync(path.join(chars,`${p.id}-card-384.webp`)).size>35_000)}
 assert.match(app,/function personCard\(p,selected,action\)/);
 assert.match(app,/src="\$\{portraitCard\(p.id\)\}"/);
 assert.match(style,/avatar-card img\{[^}]*object-fit:contain!important/);
 assert.match(style,/max-width:600px\)\{\s*\.avatars\{grid-template-columns:repeat\(2/);
});
