import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {ambienceMarkup,SCENIC_WORLDS} from '../public/world-ambience.js';
const root=resolve(import.meta.dirname,'..');
const file=name=>readFileSync(join(root,name),'utf8');

test('R10: unique animated scene per world, with compact hero version',()=>{
  assert.deepEqual(SCENIC_WORLDS,['forest','ocean','vampire','classic']);
  const sets=[];
  for(const world of SCENIC_WORLDS){
    const full=ambienceMarkup(world),small=ambienceMarkup(world,{compact:true});
    assert.match(full,new RegExp(`data-world="${world}"`));
    assert.match(full,/ambient-full/);assert.match(small,/ambient-mini/);
    assert.equal((full.match(/class="ambient-particle"/g)||[]).length,12);
    assert.equal((small.match(/class="ambient-particle"/g)||[]).length,7);
    assert.match(full,/aria-hidden="true"/);
    sets.push(full);
  }
  assert.equal(new Set(sets).size,4);
  assert.equal(ambienceMarkup('invalid').includes('data-world="forest"'),true);
});

test('R10: copyright is exact and included on EVERY screen via shared layout',()=>{
 const js=file('public/app.js'),html=file('public/index.html');
 assert.match(js,/const COPYRIGHT='جميع الحقوق محفوظة — 𝑴𝒖𝒔𝒂 𝑨𝒍-𝑨𝒉𝒎𝒂𝒅'/);
 assert.match(js,/class="site-credit"/);
 assert.match(html,/meta name="author" content="Musa Al-Ahmad"/);
 assert.match(js,/function layout\(body/);
 assert.match(js,/\$\{COPYRIGHT\}/);
});

test('R10: controls include animation preference, screen reader safe overlays and click sounds',()=>{
 const js=file('public/app.js'),css=file('public/styles.css'),motion=file('public/world-ambience.js');
 assert.match(js,/motion:true/);
 assert.match(js,/data-pref="motion"/);
 assert.match(js,/if\(p==='motion'\)configureMotion\(pref.motion\)/);
 assert.match(js,/const cue=\[/);
 assert.match(js,/ping\(cue\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.motion-off \.world-ambience/);
 assert.match(motion,/document\.addEventListener\('pointerdown'/);
 assert.match(motion,/requestAnimationFrame/);
 assert.match(css,/\.interaction-ripple/);
});

test('R10: never touch approved image assets; world layers visually separated from portraits',()=>{
 const js=file('public/app.js'),css=file('public/styles.css');
 assert.match(js,/portraitCard\(p.id\)/);
 assert.match(js,/portrait\(state.avatar\)/);
 assert.match(js,/ambienceMarkup\(state.theme/);
 assert.match(css,/\.world-ambience\{[^}]*pointer-events:none/);
 assert.match(css,/\.story-stage \.actor\{[^}]*object-fit:contain!important/);
 assert.match(css,/\.ambient-mini\{[^}]*pointer-events:none|\.world-ambience\.ambient-mini/);
});
