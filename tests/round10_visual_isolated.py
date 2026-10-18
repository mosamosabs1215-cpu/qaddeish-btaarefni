"""Isolated visual audit: new R10 landing/selection and interactive world effects without localhost."""
import pathlib,re,json,base64
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];PUB=ROOT/'public'
assets={}
for f in list((PUB/'assets/characters').glob('*-master.png'))+list((PUB/'assets/characters').glob('*-card*.webp'))+list((PUB/'assets/worlds').glob('*.webp'))+[PUB/'assets/official-home.png']:
 key='/'+f.relative_to(PUB).as_posix();mime='image/png' if f.suffix=='.png' else 'image/webp'
 assets[key]='data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode('ascii')
js1='\n'.join((PUB/f).read_text().replace('export const','const').replace('export function','function') for f in ['story.js','soundtrack.js','voice-cues.js','world-ambience.js'])
js2=re.sub(r'^import .*?;\n','',(PUB/'app.js').read_text(),flags=re.M)
js2=js2.replace('  configureAudio();\n}\nfunction personCard(', '  window.__fixAssets?.();\n  configureAudio();\n}\nfunction personCard(')
js2+='\nwindow.__r10={state,pref,home,setup,configureMotion};'
css=re.sub(r'@import url\(.*?\);','',(PUB/'styles.css').read_text())
css=css.replace("url('/assets/worlds/forest.webp')",'url('+assets['/assets/worlds/forest.webp']+')')
mock=r'''
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return this[k]||null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}}});
window.__assets=__ASSETS__;
window.__fixAssets=()=>{
 document.querySelectorAll('img').forEach(e=>{const src=e.getAttribute('src');if(src?.startsWith('/assets/')&&window.__assets[src]){e.removeAttribute('srcset');e.src=window.__assets[src]}});
 document.querySelectorAll('[style*=background-image]').forEach(e=>{const f=e.style.backgroundImage.match(/\/assets\/[^"')]+/);if(f&&window.__assets[f[0]])e.style.backgroundImage='url("'+window.__assets[f[0]]+'")'});
};
window.fetch=async(uri)=>uri==='/questions.json'?{ok:true,json:async()=>__BANK__}:{ok:false,status:404,json:async()=>({message:'mock'})};
'''.replace('__ASSETS__',json.dumps(assets)).replace('__BANK__',(PUB/'questions.json').read_text())
with sync_playwright() as pl:
 browser=pl.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(320,760),(390,844),(768,900),(1280,900),(1440,900)]:
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='no-preference')
  page=context.new_page();page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main><div id="toast"></div></body></html>')
  page.add_style_tag(content=css);page.add_script_tag(content=mock+'\n'+js1+'\n'+js2)
  page.wait_for_function('Boolean(window.__r10)&&document.querySelector(".site-credit")')
  assert page.locator('.site-credit').inner_text().find('𝑴𝒖𝒔𝒂 𝑨𝒍-𝑨𝒉𝒎𝒂𝒅')>=0
  assert page.locator('.ambient-full[data-world="forest"]').count()==1
  assert page.locator('.ambient-full .ambient-particle').first.evaluate('el=>getComputedStyle(el).animationName')=='particle-wander'
  page.locator('.picker-world').first.dispatch_event('pointerdown',{'button':0,'clientX':140,'clientY':330})
  assert page.locator('.interaction-ripple').count()>0
  assert page.locator('.ambient-mini').count()==1
  page.screenshot(path=str(ROOT/f'v7-r10-home-{width}.png'),full_page=True,animations='disabled')
  for world in ['forest','ocean','vampire','classic']:
   page.evaluate('''w=>{let z=window.__r10;z.state.theme=w;z.state.worldMusicSelected=true;z.home()}''',world)
   assert page.locator('.ambient-full').get_attribute('data-world')==world
   assert page.locator('.site-credit').count()==1
   assert page.locator('.ambient-mini').count()==1
   assert page.locator('.picker-world[data-world="'+world+'"]').count()==1
   if world in ['ocean','vampire']:
    page.screenshot(path=str(ROOT/f'v7-r10-{world}-home-{width}.png'),full_page=True,animations='disabled')
  page.evaluate('window.__r10.setup()')
  assert page.locator('.avatar-card img').count()==5
  for img in page.locator('.avatar-card img').all():
   assert img.evaluate('el=>getComputedStyle(el).objectFit')=='contain'
  page.screenshot(path=str(ROOT/f'v7-r10-setup-{width}.png'),full_page=True,animations='disabled')
  page.evaluate('window.__r10.pref.motion=false;window.__r10.configureMotion(false)')
  assert page.evaluate('document.documentElement.classList.contains("motion-off")')
  assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'), 'horizontal page overflow'
  assert not errors,errors
  print('PASS',width, '4 themed homes, complete portrait cards, exact copyright, zero JS errors')
  context.close()
 browser.close()
