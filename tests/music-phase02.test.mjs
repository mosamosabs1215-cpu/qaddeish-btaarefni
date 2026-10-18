import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {TRACKS,activeTrack} from '../public/soundtrack.js';
const root=resolve(import.meta.dirname,'..');
const app=readFileSync(join(root,'public/app.js'),'utf8');
const server=readFileSync(join(root,'server.mjs'),'utf8');

test('Music 02: approved forest soundtrack replaces placeholder and uses original AAC file',()=>{
  assert.equal(TRACKS.forest,'/assets/audio/forest-theme.m4a');
  const file=join(root,'public',TRACKS.forest.slice(1));
  const buf=readFileSync(file);
  assert.equal(buf.subarray(4,8).toString('ascii'),'ftyp');
  assert.ok(statSync(file).size>2_000_000,'forest file does not match expected actual recording');
  assert.match(server,/'\.m4a':'audio\/mp4'/);
});
test('Music 02: forest on both creator and invite link, independent of home music',()=>{
 assert.equal(activeTrack({screen:'home',theme:'forest',worldMusicSelected:false}),'home');
 assert.equal(activeTrack({screen:'home',theme:'forest',worldMusicSelected:true}),'forest');
 for(const screen of ['setup','landing','playing','result','owner']){
   assert.equal(activeTrack({screen,theme:'forest',worldMusicSelected:false}),'forest');
 }
 assert.match(app,/state\.theme=value;home\(\)/);
 assert.match(app,/worldAudio\.loop=true/);
 assert.equal((app.match(/new Audio\(\)/g)||[]).length,1);
});
test('Music 02: earlier approved tracks retained as more soundtracks arrive',()=>{
  assert.equal(TRACKS.vampire,'/assets/audio/vampire-theme.m4a');
  assert.equal(TRACKS.classic,'/assets/audio/classic-theme.m4a');
  assert.match(app,/case'toggle-music':/);
  assert.match(app,/storePrefs\(\);configureAudio\(\)/);
});
