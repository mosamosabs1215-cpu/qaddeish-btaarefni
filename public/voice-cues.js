/** V7 R09: thirty deterministic NONVERBAL voice cues: five approved characters x six ending moods.
 * This is not spoken dialogue; no altered character art or artificial speech samples.
 * Pure scheduling data so it can be tested without a browser or sound card.
 */
export const VOICE_PROFILES=Object.freeze({
  bear: Object.freeze({base:205,wave:'sine',body:0.82}),
  panda:Object.freeze({base:320,wave:'sine',body:0.68}),
  witch:Object.freeze({base:485,wave:'sine',body:0.64}),
  cat:Object.freeze({base:390,wave:'triangle',body:0.60}),
  lunar:Object.freeze({base:260,wave:'triangle',body:0.72})
});
export const MOOD_PHRASES=Object.freeze({
  legend: Object.freeze({intervals:[0,4,7,12],duration:0.15,spacing:0.105,energy:0.78}),
  gold: Object.freeze({intervals:[0,4,7,4],duration:0.14,spacing:0.11,energy:0.70}),
  steady: Object.freeze({intervals:[0,2,4,2],duration:0.16,spacing:0.13,energy:0.48}),
  review: Object.freeze({intervals:[0,-2,1,-2],duration:0.18,spacing:0.17,energy:0.52}),
  detective: Object.freeze({intervals:[0,-3,2,-1],duration:0.135,spacing:0.14,energy:0.60}),
  alarm: Object.freeze({intervals:[-5,0,-7,-5],duration:0.19,spacing:0.19,energy:0.37})
});
export function voiceCue(character,mood='steady'){
 const profile=VOICE_PROFILES[character]||VOICE_PROFILES.bear;
 const phrase=MOOD_PHRASES[mood]||MOOD_PHRASES.steady;
 const notes=phrase.intervals.map((step,index)=>({
  start:Number((index*phrase.spacing).toFixed(3)),
  duration:phrase.duration,
  from:Math.round(profile.base*Math.pow(2,step/12)),
  to:Math.round(profile.base*Math.pow(2,(step+(index%2?0.35:-0.28))/12)),
  wave:profile.wave,
  loudness:Number((phrase.energy*profile.body).toFixed(3))
 }));
 return {character,mood,notes,length:notes.at(-1).start+notes.at(-1).duration};
}
