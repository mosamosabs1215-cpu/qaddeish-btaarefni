// Route selection for the V7 sound system. New approved world tracks can replace
// their existing files without altering navigation, friends' links, or controls.
export const TRACKS=Object.freeze({
  home:'/assets/audio/home-theme.m4a',
  forest:'/assets/audio/forest-theme.m4a',
  ocean:'/assets/audio/ocean-theme.m4a',
  vampire:'/assets/audio/vampire-theme.m4a',
  classic:'/assets/audio/classic-theme.m4a'
});
export function activeTrack({screen,theme,worldMusicSelected}){
  return screen==='home'&&!worldMusicSelected?'home':Object.hasOwn(TRACKS,theme)&&theme!=='home'?theme:'forest';
}
