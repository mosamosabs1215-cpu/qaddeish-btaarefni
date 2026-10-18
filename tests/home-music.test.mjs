import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {activeTrack,TRACKS} from '../public/soundtrack.js';
const root=resolve(import.meta.dirname,'..');
const app=readFileSync(join(root,'public/app.js'),'utf8');
const server=readFileSync(join(root,'server.mjs'),'utf8');

test('Music 01: homepage loops its own soundtrack, world selection replaces it, Home restores it',()=>{
 assert.equal(activeTrack({screen:'home',theme:'forest',worldMusicSelected:false}),'home');
 for(const world of ['forest','ocean','vampire','classic']){
   assert.equal(activeTrack({screen:'home',theme:world,worldMusicSelected:true}),world);
   assert.equal(activeTrack({screen:'setup',theme:world,worldMusicSelected:true}),world);
   assert.equal(activeTrack({screen:'playing',theme:world,worldMusicSelected:true}),world);
   assert.equal(activeTrack({screen:'landing',theme:world,worldMusicSelected:false}),world,'friend link world is not overridden by home');
   assert.equal(activeTrack({screen:'result',theme:world,worldMusicSelected:false}),world);
 }
 assert.match(app,/case'home':history\.pushState\(\{\},'', '\/'\);state\.worldMusicSelected=false;home\(\)/);
 assert.match(app,/case'hero-world':state\.worldMusicSelected=true;state\.theme=value;home\(\)/);
 assert.match(app,/function beginCreate\(\)\{state\.worldMusicSelected=true/);
});
test('Music 01: soundtrack files exist and sound player uses one looping audio element',()=>{
 assert.deepEqual(Object.keys(TRACKS),['home','forest','ocean','vampire','classic']);
 for(const [id,url] of Object.entries(TRACKS)){
  assert.equal(existsSync(join(root,'public',url.slice(1))),true,`${id} missing: ${url}`);
 }
 const home=readFileSync(join(root,'public',TRACKS.home.slice(1)));
 assert.equal(home.subarray(4,8).toString('ascii'),'ftyp','home file is m4a/MP4 audio, not video');
 assert.equal((app.match(/new Audio\(\)/g)||[]).length,1);
 assert.match(app,/worldAudio\.loop=true/);
 assert.match(app,/worldAudio\.pause\(\);worldKey=track;worldAudio\.src=TRACKS\[track\]/);
 assert.match(server,/'\.m4a':'audio\/mp4'/);
});
test('Music 01: user can toggle audio and browser autoplay rejection is handled',()=>{
 assert.match(app,/case'toggle-music':if\(!pref\.music\)pref\.music=true/);
 assert.match(app,/if\(audioBlocked&&!audioUnlocked\)/);
 assert.match(app,/error\?\.name==='NotAllowedError'/);
 assert.match(app,/localStorage\.setItem\('v7:prefs'/);
 assert.match(app,/data-pref="music"/);
 assert.match(app,/data-pref="volume"/);
});
