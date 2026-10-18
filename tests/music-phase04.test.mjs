import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {TRACKS,activeTrack} from '../public/soundtrack.js';
const root=resolve(import.meta.dirname,'..');
const app=readFileSync(join(root,'public/app.js'),'utf8');
const server=readFileSync(join(root,'server.mjs'),'utf8');

test('Music 04: original user-supplied vampire soundtrack is the active AAC audio-only recording',()=>{
  assert.equal(TRACKS.vampire,'/assets/audio/vampire-theme.m4a');
  const file=join(root,'public',TRACKS.vampire.slice(1));
  assert.ok(existsSync(file));
  assert.equal(readFileSync(file).subarray(4,8).toString('ascii'),'ftyp');
  assert.ok(statSync(file).size>2_000_000);
  assert.match(server,/'\.m4a':'audio\/mp4'/);
});
test('Music 04: vampire soundtrack on creator, owner, and friend invitation routes',()=>{
  assert.equal(activeTrack({screen:'home',theme:'vampire',worldMusicSelected:false}),'home');
  for(const screen of ['home','setup','landing','playing','result','owner']){
    assert.equal(activeTrack({screen,theme:'vampire',worldMusicSelected:true}),'vampire');
  }
  for(const screen of ['landing','playing','result']){
    assert.equal(activeTrack({screen,theme:'vampire',worldMusicSelected:false}),'vampire');
  }
  assert.match(app,/worldAudio\.loop=true/);
  assert.equal((app.match(/new Audio\(\)/g)||[]).length,1);
  assert.match(app,/case'toggle-music':/);
});
test('Music 04: home forest ocean untouched, classic is now approved',()=>{
  assert.equal(TRACKS.home,'/assets/audio/home-theme.m4a');
  assert.equal(TRACKS.forest,'/assets/audio/forest-theme.m4a');
  assert.equal(TRACKS.ocean,'/assets/audio/ocean-theme.m4a');
  assert.equal(TRACKS.classic,'/assets/audio/classic-theme.m4a');
  for(const track of Object.values(TRACKS))assert.ok(existsSync(join(root,'public',track.slice(1))));
});
