"""Browser-only isolated visualization when direct navigation is administrator-blocked.
Genuine packaged CSS/JS; mock network; not a complete end-to-end published site test.
"""
import pathlib,json,base64,re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
DATA={}
def uri(p):
    path=PUB/p
    mime='image/png' if path.suffix=='.png' else 'image/webp'
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
for key in ['bear','panda','witch','cat','lunar']:
    DATA['/assets/characters/'+key+'-restored.webp']=uri(pathlib.Path('assets/characters')/(key+'-restored.webp'))
    DATA['/assets/characters/'+key+'.png']=uri(pathlib.Path('assets/characters')/(key+'.png'))
for key in ['forest','ocean','vampire','classic']:
    DATA['/assets/worlds/'+key+'.webp']=uri(pathlib.Path('assets/worlds')/(key+'.webp'))
DATA['/assets/official-home.png']=uri(pathlib.Path('assets/official-home.png'))
js1=(PUB/'story.js').read_text().replace('export const','const').replace('export function','function')
js1=js1.replace('`/assets/characters/${id}-restored.webp`','window.__assets[`/assets/characters/${id}-restored.webp`]')
js1=js1.replace('`/assets/worlds/${id}.webp`','window.__assets[`/assets/worlds/${id}.webp`]')
js2=(PUB/'app.js').read_text().replace("import {PEOPLE,WORLDS,OUTCOMES,resultBand,buildStory,portrait,worldImage} from './story.js';",'')
js2=js2.replace("'/assets/official-home.png'", "window.__assets['/assets/official-home.png']")
js2=js2.replace("history.replaceState({},'', '/owner/'+r.id);","")
js2=js2.replace('src="/assets/official-home.png"','src="${window.__assets[\'/assets/official-home.png\']}"')
js2=js2.replace('src="/assets/characters/${p.id}.png"','src="${window.__assets[`/assets/characters/${p.id}.png`]}"')
css=(PUB/'styles.css').read_text();css=re.sub(r"@import url\(.*?\);",'',css)
css=css.replace("url('/assets/worlds/forest.webp')",'url("'+DATA['/assets/worlds/forest.webp']+'")')
mock='''
Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem(k){return this[k]||null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}}});
window.__assets=__ASSETS__;
window.__bank=__BANK__;
window.fetch=async (path,opts={})=>{
 const url=String(path),body=opts.body?JSON.parse(opts.body):{};
 if(url==='/questions.json')return {ok:true,json:async()=>window.__bank};
 if(url==='/api/challenges'&&opts.method==='POST'){
  window.__created={id:'TestV7Demo',name:body.name,avatar:body.avatar,theme:body.theme,questions:body.questions.map((q,i)=>({...q,position:i}))};
  return {ok:true,json:async()=>({id:'TestV7Demo',ownerToken:'fake-preview-token',name:body.name})};
 }
 if(url.startsWith('/api/challenges/TestV7Demo')&& !url.endsWith('stats')){
  if(url.endsWith('/leaderboard'))return {ok:true,json:async()=>({leaders:[]})};
  return {ok:true,json:async()=>window.__created};
 }
 return {ok:false,status:404,json:async()=>({message:'only mock'})};
}
'''.replace('__ASSETS__',json.dumps(DATA)).replace('__BANK__',json.dumps(json.loads((PUB/'questions.json').read_text()),ensure_ascii=False))
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (390,1280):
  context=b.new_context(viewport={'width':width,'height':840 if width==390 else 870},device_scale_factor=1)
  page=context.new_page();page.set_default_timeout(9000);errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  page.set_content('<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><main id="app"></main><div id="toast"></div></body></html>')
  page.add_style_tag(content=css)
  page.add_script_tag(content=mock+'\n'+js1+'\n'+js2)
  page.wait_for_selector('.hero-frame');page.screenshot(path=str(ROOT/f'preview-home-{width}.png'),full_page=True)
  print('click create',flush=True);page.locator('.hero-actions [data-action=create]').first.click() if width==390 else page.locator('.hero-action[data-action=create]').first.click(force=True)
  print('fill name',flush=True);page.locator('#owner-name').fill('موسى')
  print('witch',flush=True);page.locator('[data-action=select-person][data-value=witch]').click()
  print('ocean',flush=True);page.locator('[data-action=select-world][data-value=ocean]').click()
  assert page.locator('#owner-name').input_value()=='موسى'
  print('builder',flush=True);page.locator('[data-action=start-building]').click()
  
  for i in range(10):
   print('question',i,flush=True)
   page.locator('[data-action=choose-correct]').first.click()
  assert page.get_by_text('راجع أسئلتك العشرة').count()==1
  page.locator('[data-action=publish]').click()
  print('post publish screen:',page.locator('#app').inner_text()[-280:],flush=True);page.wait_for_selector('#share-link');page.screenshot(path=str(ROOT/f'preview-share-{width}.png'),full_page=True)
  # Local browser visual inspection of approved characters & world, no synthetic leaderboard.
  page.evaluate('''() => {
   state.challenge=window.__created;state.challengeId='TestV7Demo';state.friendName='ليلى';state.friendAvatar='cat';
   state.theme='ocean';pref.auto=false;launchStory(8,{preview:true});
  }''')
  page.wait_for_selector('.story-stage');page.screenshot(path=str(ROOT/f'preview-story-{width}.png'),full_page=True)
  for i in range(3):page.locator('[data-action=story-next]').click()
  assert page.locator('.story-board strong').inner_text()=='8/10'
  page.wait_for_timeout(850)
  page.screenshot(path=str(ROOT/f'preview-ending-{width}.png'),full_page=True)
  assert not errs,errs
  print('PASS isolated',width,'screen renders and result=8/10')
  context.close()
 b.close()
