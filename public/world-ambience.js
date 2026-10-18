/** V7 round 10: lightweight scenic layers. No portrait pixels are ever modified. */
export const SCENIC_WORLDS = Object.freeze(['forest','ocean','vampire','classic']);
const ICONS = {
  forest: ['🍃','✦','🍂','✧','🍃','✦','🍃','✧','🍂','✦','🍃','✧'],
  ocean: ['○','◌','◯','○','◌','◯','○','◌','◯','○','◌','◯'],
  vampire: ['🦇','✦','✧','🦇','✦','✧','🦇','✦','✧','🦇','✦','✧'],
  classic: ['✦','✧','❈','✦','✧','❈','✦','✧','❈','✦','✧','❈']
};
// Deterministic particle positioning avoids a distracting reshuffle when the user changes steps.
export function ambienceMarkup(world,{compact=false}={}) {
  const key=SCENIC_WORLDS.includes(world)?world:'forest';
  const count=compact?7:12;
  const particles=Array.from({length:count},(_,i)=>{
    const x=(17+i*41)%93+3,y=(11+i*27)%78+6;
    const size=compact?(.65+(i%3)*.2):(0.78+(i%4)*.27);
    return `<span class="ambient-particle" style="--x:${x}%;--y:${y}%;--size:${size};--delay:${-(i*1.9).toFixed(2)}s;--duration:${12+i%5*3}s" aria-hidden="true">${ICONS[key][i]}</span>`;
  }).join('');
  return `<div class="world-ambience ${compact?'ambient-mini':'ambient-full'}" data-world="${key}" aria-hidden="true"><div class="ambient-parallax"><span class="ambient-haze"></span><span class="ambient-ribbon ambient-ribbon-one"></span><span class="ambient-ribbon ambient-ribbon-two"></span><span class="ambient-stars">${particles}</span></div></div>`;
}

let initialized=false,scheduled=false,rx=0,ry=0;
export function initializeWorldInteractions() {
  if(initialized)return;
  initialized=true;
  document.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'||document.documentElement.classList.contains('motion-off'))return;
    rx=(e.clientX/Math.max(1,window.innerWidth)-.5)*2;
    ry=(e.clientY/Math.max(1,window.innerHeight)-.5)*2;
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      const app=document.getElementById('app');
      if(app){app.style.setProperty('--cursor-x',`${(rx*13).toFixed(2)}px`);app.style.setProperty('--cursor-y',`${(ry*9).toFixed(2)}px`)}
    });
  },{passive:true});
  document.addEventListener('pointerdown',e=>{
    if(e.button!==0||document.documentElement.classList.contains('motion-off')||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const target=e.target.closest('.world-card,.picker-world,.hero-frame,.btn,.avatar-card,.picker-avatar,.answer');
    if(!target||target.disabled)return;
    const r=target.getBoundingClientRect();
    const size=Math.max(70,Math.min(290,Math.max(r.width,r.height)*1.5));
    const ripple=document.createElement('span');
    ripple.className='interaction-ripple';
    ripple.style.setProperty('--tap-x',`${e.clientX-r.left}px`);
    ripple.style.setProperty('--tap-y',`${e.clientY-r.top}px`);
    ripple.style.setProperty('--tap-size',`${size}px`);
    target.append(ripple);
    ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  },{passive:true});
  document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('world-hidden',document.hidden));
}
export function configureMotion(enabled){
  document.documentElement.classList.toggle('motion-off',!enabled);
}
