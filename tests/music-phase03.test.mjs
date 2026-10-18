import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {TRACKS,activeTrack} from '../public/soundtrack.js';
const root=resolve(import.meta.dirname,'..');
const app=readFileSync(join(root,'public/app.js'),'utf8');
const srv=readFileSync(join(root,'server.mjs'),'utf8');

test('Music 03: ocean now uses approved AAC audio-only file',()=>{
  assert.equal(TRACKS.ocean,'/assets/audio/ocean-theme.m4a');
  const path=join(root,'public',TRACKS.ocean.slice(1));
  assert.equal(existsSync(path),true);
  const audio=readFileSync(path);
  assert.equal(audio.subarray(4,8).toString('ascii'),'ftyp');
  assert.ok(statSync(path).size>2_000_000);
  assert.match(srv,/'\.m4a':'audio\/mp4'/);
});
test('Music 03: home, forest, and newly approved vampire retained while classic awaits approval',()=>{
  assert.equal(TRACKS.home,'/assets/audio/home-theme.m4a');
  assert.equal(TRACKS.forest,'/assets/audio/forest-theme.m4a');
  assert.equal(TRACKS.vampire,'/assets/audio/vampire-theme.m4a');
  assert.equal(TRACKS.classic,'/assets/audio/classic-theme.m4a');
  for(const key of Object.keys(TRACKS))assert.ok(existsSync(join(root,'public',TRACKS[key].slice(1))));
});
test('Music 03: ocean theme persists on creator and friend routes, with toggle and loop',()=>{
  assert.equal(activeTrack({screen:'home',theme:'ocean',worldMusicSelected:false}),'home');
  for(const screen of ['home','setup','landing','playing','result','owner']){
    assert.equal(activeTrack({screen,theme:'ocean',worldMusicSelected:true}),'ocean');
  }
  for(const screen of ['landing','playing','result']){
    assert.equal(activeTrack({screen,theme:'ocean',worldMusicSelected:false}),'ocean');
  }
  assert.match(app,/worldAudio\.loop=true/);
  assert.equal((app.match(/new Audio\(\)/g)||[]).length,1);
  assert.match(app,/case'toggle-music':/);
  assert.match(app,/storePrefs\(\);configureAudio\(\)/);
});
