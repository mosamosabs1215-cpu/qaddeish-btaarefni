"""Isolated Chromium: 4 worlds x 2 representative extremes x 5 shots x 2 viewports; all six tested by Node.
No external network: embed original user-approved art as data URIs.
"""
import pathlib,re,json,base64
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
assets={}
for f in list((PUB/'assets/characters').glob('*-master.png'))+list((PUB/'assets/characters').glob('*-card*.webp'))+list((PUB/'assets/worlds').glob('*.webp'))+list((PUB/'assets/cinematics').glob('*/*.webp'))+[PUB/'assets/official-home.png']:
 key='/'+f.relative_to(PUB).as_posix()
 mime='image/png' if f.suffix=='.png' else 'image/webp'
 assets[key]='data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode('ascii')
js1='\n'.join((PUB/f).read_text().replace('export const','const').replace('export function','function') for f in ['story.js','soundtrack.js','voice-cues.js'])
js2=(PUB/'app.js').read_text()
js2=re.sub(r'^import .*?;\n','',js2,flags=re.M)
js2=js2.replace('app.innerHTML=scenery()+header()+(bare?body:`<div class="container">${body}</div>`);','app.innerHTML=scenery()+header()+(bare?body:`<div class="container">${body}</div>`);window.__fixAssets?.();')
js2+='\nwindow.__r8={state,launchStory,nextStory,renderStory,pref,home};'
css=re.sub(r'@import url\(.*?\);','',(PUB/'styles.css').read_text())
css=css.replace("url('/assets/worlds/forest.webp')",'url('+assets['/assets/worlds/forest.webp']+')')
mock=r'''
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return this[k]||null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}}});
window.__assets=__ASSETS__;
window.__fixAssets=()=>{
 document.querySelectorAll('img').forEach(e=>{
  const src=e.getAttribute('src');
  if(src?.startsWith('/assets/')&&window.__assets[src]){e.removeAttribute('srcset');e.setAttribute('src',window.__assets[src]);}
 });
 document.querySelectorAll('[style*=background-image]').forEach(e=>{
  const found=e.style.backgroundImage.match(/\/assets\/[^"')]+/);
  if(found&&window.__assets[found[0]])e.style.backgroundImage='url("'+window.__assets[found[0]]+'")';
 });
};
window.fetch=async(uri)=>uri==='/questions.json'?{ok:true,json:async()=>__BANK__}:{ok:false,status:404,json:async()=>({message:'mock'})};
'''.replace('__ASSETS__',json.dumps(assets)).replace('__BANK__',(PUB/'questions.json').read_text())
with sync_playwright() as pl:
 browser=pl.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(390,844),(1280,870)]:
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='reduce')
  page=context.new_page();page.set_default_timeout(20000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main><div id="toast"></div></body></html>')
  page.add_style_tag(content=css)
  page.add_script_tag(content=mock+'\n'+js1+'\n'+js2)
  page.wait_for_function('Boolean(window.__r8)')
  page.evaluate("""() => {let z=window.__r8;z.pref.auto=false;z.pref.voices=false;z.pref.effects=false;z.state.challenge={name:'موسى',avatar:'bear',theme:'forest'};z.state.friendAvatar='witch';z.state.friendName='ليلى';}""")
  shots=0
  for world in ['forest','ocean','vampire','classic']:
   for score in [0,10]:
    page.evaluate('''([world,score])=>{let z=window.__r8;z.state.theme=world;z.state.challenge.theme=world;z.launchStory(score,{preview:true})}''',[world,score])
    for beat in range(5):
     stage=page.locator('.round08-stage');stage.wait_for(state='visible')
     scene=stage.evaluate('''el=>({world:el.dataset.world,mood:el.dataset.mood,beat:Number(el.dataset.beat)})''')
     assert scene['world']==world and scene['beat']==beat,scene
     assert stage.locator('.story-people img').count()==2
     page.wait_for_function('Array.from(document.querySelectorAll(".round08-stage .actor")).every(x=>x.complete && x.naturalWidth>0)')
     imgs=stage.locator('.actor').evaluate_all('''els=>els.map(e=>({width:e.naturalWidth,height:e.naturalHeight,fit:getComputedStyle(e).objectFit}))''')
     assert all(i['width']==1086 and i['height']==1448 and i['fit']=='contain' for i in imgs),(world,score,beat,imgs)
     assert stage.locator('#story-line').count()==1
     if (world,score,beat) in [('forest',10,4),('ocean',0,4),('vampire',2,3),('classic',6,0),('forest',4,3)]:
      page.evaluate('''() => {const el=document.querySelector('#story-line');el.textContent=window.__r8.state.story[window.__r8.state.shotIndex].text}''');page.screenshot(path=str(ROOT/f'v7-r08-{world}-score{score}-shot{beat}-{width}.png'),animations='disabled')
     shots+=1
     if beat<4:page.evaluate('window.__r8.nextStory()')
  assert not errors,errors
  print('PASS',width,'—',shots,'scenes, both intact RGBA source portraits and no JavaScript errors')
  context.close()
 browser.close()
