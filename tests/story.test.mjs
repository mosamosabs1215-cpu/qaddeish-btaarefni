import test from 'node:test';
import assert from 'node:assert/strict';
import {PEOPLE,WORLDS,OUTCOMES,resultBand,buildStory,portrait,worldImage} from '../public/story.js';
test('V7 only has 5 approved characters and 4 approved worlds',()=>{
 assert.deepEqual(PEOPLE.map(x=>x.id),['bear','panda','witch','cat','lunar']);
 assert.deepEqual(WORLDS.map(x=>x.id),['forest','ocean','vampire','classic']);
});
test('6 ending bands partition exactly 0 to 10',()=>{
 assert.deepEqual(Array.from({length:11},(_,score)=>resultBand(score)),[5,5,4,4,3,3,2,2,1,1,0]);
 assert.equal(OUTCOMES.length,6);
});
test('all 24 result/world combinations produce five steps in the chosen world',()=>{
 for(const world of WORLDS)for(const score of [0,2,4,6,8,10]){
  assert.ok(worldImage(world.id).includes(world.id));
  const beats=buildStory({score,ownerName:'موسى',friendName:'ليلى'});
  assert.equal(beats.length,5);assert.deepEqual(beats.map(x=>x.id),['meeting','reply','suspense','reveal','finale']);
  assert.ok(beats.some(x=>x.speaker==='owner'));assert.ok(beats.some(x=>x.speaker==='friend'));
  assert.ok(beats.every(b=>typeof b.text==='string'&&b.text.length>5));
 }
});
test('all 25 ordered character pairs resolve into distinct authorized assets',()=>{
 for(const creator of PEOPLE)for(const friend of PEOPLE){
  assert.match(portrait(creator.id),/master\.png$/);
  assert.match(portrait(friend.id),/master\.png$/);
 }
});
