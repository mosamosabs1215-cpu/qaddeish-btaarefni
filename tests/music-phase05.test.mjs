import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {TRACKS,activeTrack} from '../public/soundtrack.js';
const root=resolve(import.meta.dirname,'..');
const app=readFileSync(join(root,'public/app.js'),'utf8');

test('Music 05: final approved classical world audio is an AAC-only M4A',()=>{
  assert.equal(TRACKS.classic,'/assets/audio/classic-theme.m4a');
  const audio=join(root,'public',TRACKS.classic.slice(1));
  assert.ok(existsSync(audio));
  assert.equal(readFileSync(audio).subarray(4,8).toString('ascii'),'ftyp');
  assert.ok(statSync(audio).size>2_000_000);
});
test('Music 05: classical theme activates on selection and friend and owner links',()=>{
  assert.equal(activeTrack({screen:'home',theme:'classic',worldMusicSelected:false}),'home');
  for(const screen of ['home','setup','landing','playing','result','owner']){
    assert.equal(activeTrack({screen,theme:'classic',worldMusicSelected:true}),'classic');
  }
  for(const screen of ['landing','playing','result']){
    assert.equal(activeTrack({screen,theme:'classic',worldMusicSelected:false}),'classic');
  }
  assert.match(app,/worldAudio\.loop=true/);
  assert.equal((app.match(/new Audio\(\)/g)||[]).length,1);
  assert.match(app,/case'toggle-music':/);
});
test('Music 05: all five requested tracks routed to individual approved M4A files',()=>{
  const expected={home:'home-theme',forest:'forest-theme',ocean:'ocean-theme',vampire:'vampire-theme',classic:'classic-theme'};
  assert.deepEqual(Object.keys(TRACKS),Object.keys(expected));
  const paths=[];
  for(const [world,basename] of Object.entries(expected)){
    assert.equal(TRACKS[world],`/assets/audio/${basename}.m4a`);
    const file=join(root,'public',TRACKS[world].slice(1));
    assert.ok(existsSync(file),`Audio missing for ${world}`);
    paths.push(file);
  }
  assert.equal(new Set(paths).size,5);
});
