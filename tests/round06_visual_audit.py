"""Real V7 markup, styles and JS under an isolated Chromium document with mocked HTTP.
The backend itself is integration-tested separately with actual HTTP & SQLite.
"""
import pathlib,json,base64,re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]; PUB=ROOT/'public'
assets={}
for f in list((PUB/'assets/characters').glob('*-card.webp'))+list((PUB/'assets/characters').glob('*-card-384.webp'))+list((PUB/'assets/characters').glob('*-master.png'))+list((PUB/'assets/worlds').glob('*.webp'))+list((PUB/'assets/answers').glob('p-*.webp'))+list((PUB/'assets/cinematics').glob('*/*.webp'))+[PUB/'assets/official-home.png']:
 key='/'+f.relative_to(PUB).as_posix();mime='image/png' if f.suffix=='.png' else 'image/webp';assets[key]=f'data:{mime};base64,'+base64.b64encode(f.read_bytes()).decode()
js1=(PUB/'story.js').read_text().replace('export const','const').replace('export function','function')
js1=js1.replace('`/assets/characters/${id}-master.png`','window.__assets[`/assets/characters/${id}-restored.webp`]')
js1=js1.replace('`/assets/worlds/${id}.webp`','window.__assets[`/assets/worlds/${id}.webp`]')
js1=js1.replace('`/assets/cinematics/${[\'forest\',\'ocean\',\'vampire\',\'classic\'].includes(world)?world:\'forest\'}/${[\'meeting\',\'reply\',\'suspense\',\'reveal\',\'finale\'].includes(beat)?beat:\'meeting\'}.webp`', 'window.__assets[`/assets/cinematics/${[\'forest\',\'ocean\',\'vampire\',\'classic\'].includes(world)?world:\'forest\'}/${[\'meeting\',\'reply\',\'suspense\',\'reveal\',\'finale\'].includes(beat)?beat:\'meeting\'}.webp`]')
js2=(PUB/'app.js').read_text();js2=re.sub(r'^import .*?;\n','',js2,count=1)
js2=js2.replace("history.replaceState({},'', '/owner/'+r.id);",'')
js2=js2.replace('app.innerHTML=scenery()+header()+(bare?body:`<div class="container">${body}</div>`);','app.innerHTML=scenery()+header()+(bare?body:`<div class="container">${body}</div>`);window.__fixAssets?.();')
css=re.sub(r'@import url\(.*?\);','',(PUB/'styles.css').read_text())
css=css.replace("url('/assets/worlds/forest.webp')",'url('+assets['/assets/worlds/forest.webp']+')')
mock='''
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return this[k]||null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}}});
window.__assets=__ASSETS__;
window.__fixAssets=()=>{document.querySelectorAll('img').forEach(e=>{const url=e.getAttribute('src');if(url&&url.startsWith('/assets/')&&window.__assets[url]){e.removeAttribute('srcset');e.setAttribute('src',window.__assets[url]);}});};
window.__bank=__BANK__;
window.fetch=async(path,opts={})=>{const url=String(path),body=opts.body?JSON.parse(opts.body):{};
if(url==='/questions.json')return{ok:true,json:async()=>window.__bank};
if(url==='/api/challenges'&&opts.method==='POST'){window.__created={id:'R05Demo',name:body.name,avatar:body.avatar,theme:body.theme,questions:body.questions.map((q,i)=>({...q,position:i,imageUrls:q.imageData?.map(x=>x)||[]}))};return{ok:true,json:async()=>({id:'R05Demo',ownerToken:'fake-visual-preview-token',name:body.name})}}
if(url.startsWith('/api/challenges/R05Demo/my-status'))return{ok:true,json:async()=>({status:'new'})};
if(url.startsWith('/api/challenges/R05Demo'))return{ok:true,json:async()=>window.__created};
return {ok:false,status:404,json:async()=>({message:'Mocked visual QA request only'})};};
'''.replace('__ASSETS__',json.dumps(assets)).replace('__BANK__',json.dumps(json.loads((PUB/'questions.json').read_text()),ensure_ascii=False))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (390,1280):
  context=browser.new_context(viewport={'width':width,'height':844 if width==390 else 870},device_scale_factor=1,reduced_motion='reduce')
  page=context.new_page();page.set_default_timeout(15000)
  errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  page.set_content('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="app"></main><div id="toast"></div></body></html>')
  page.add_style_tag(content=css)
  page.add_script_tag(content=mock+'\n'+js1+'\n'+js2)
  page.wait_for_selector('.picker-avatar')
  (page.locator('.hero-actions [data-action=create]').first if width==390 else page.locator('.hero-bottom [data-action=create]').first).click()
  page.locator('#owner-name').fill('موسى')
  page.locator('[data-action=start-building]').click()
  page.locator('[data-action=custom]').click()
  page.locator('#custom-text').fill('شو أحلى ذكرى بتجمعني مع رفقاتي؟')
  for i,opt in enumerate(['رحلة إلى البحر','جلسة تحت المطر','لعبة جماعية','عشاء سوا']):
   page.locator('.custom-option').nth(i).fill(opt)
   # Actual file input and in-browser canvas compression
   page.locator(f'#custom-photo-{i}').set_input_files(str(PUB/'assets/answers/p-01-0.webp'))
   page.wait_for_function(f'Boolean(state.customPictures[{i}])')
  assert page.locator('.photo-upload.uploaded').count()==4
  assert page.locator('.photo-preview img').count()==4
  page.screenshot(path=str(ROOT/f'r05-upload-{width}.png'),full_page=True,animations='disabled')
  page.locator('#custom-correct').select_option('1')
  page.locator('#submit-custom').click()
  assert page.locator('.quiz-panel .answer').count()==4
  assert page.locator('.review-list').count()==0
  for i in range(9):page.locator('[data-action=choose-correct]').first.click()
  assert page.locator('.review-list').count()==1
  page.locator('[data-action=publish]').click()
  page.wait_for_selector('#share-link')
  created=page.evaluate('window.__created')
  assert len(created['questions'])==10
  assert len(created['questions'][0]['imageData'])==4
  assert all(x.startswith('data:image/') for x in created['questions'][0]['imageData'])
  page.evaluate('''() => {state.challenge=window.__created;state.challengeId='R05Demo';state.theme='ocean';state.visitorStatus='new';state.friendName='';state.friendAvatar='witch';landing()}''')
  assert page.locator('.friend-rules span').count()==4
  assert page.locator('.friend-owner-portrait img').count()==1
  # Mandatory visual gate 10: every approved master character appears in creator,
  # friend landing and story without any CSS cropping or broken image request.
  for avatar in ['bear','panda','witch','cat','lunar']:
   page.evaluate("(avatar)=>{state.challenge.avatar=avatar;state.friendAvatar=avatar;state.visitorStatus='new';landing()}",avatar)
   page.wait_for_selector('.friend-owner-portrait img')
   data=page.eval_on_selector('.friend-owner-portrait img',"(img)=>({ok:img.complete && img.naturalWidth>=700,fit:getComputedStyle(img).objectFit,src:img.currentSrc,visible:img.getBoundingClientRect().width>150})")
   assert data['ok'] and data['fit']=='contain' and data['visible'],(avatar,data)
   page.screenshot(path=str(ROOT/f'r06-friend-{avatar}-{width}.png'),full_page=True,animations='disabled')
   for world in (['forest','ocean','vampire','classic'] if width==390 else ['forest']):
    page.evaluate("([avatar,world])=>{state.theme=world;state.challenge.avatar=avatar;state.friendAvatar=avatar;state.friendName='ليلى';state.score=10;pref.auto=false;launchStory(10,{preview:true})}",[avatar,world])
    stage=page.locator('#story-stage');stage.wait_for(state='visible')
    actor_data=page.locator('.story-stage .actor').evaluate_all("imgs=>imgs.map(img=>({complete:img.complete && img.naturalWidth>=700,objectFit:getComputedStyle(img).objectFit,natural:[img.naturalWidth,img.naturalHeight],rect:img.getBoundingClientRect().toJSON()}))")
    assert len(actor_data)==2 and all(x['complete'] and x['objectFit']=='contain' for x in actor_data),(avatar,world,actor_data)
    if avatar in ('bear','witch','lunar') and world in ('forest','vampire'):
     page.screenshot(path=str(ROOT/f'r06-story-{avatar}-{world}-{width}.png'),full_page=False,animations='disabled')
  page.evaluate("() => {state.visitorStatus='new';landing()}")
  page.screenshot(path=str(ROOT/f'r05-friend-{width}.png'),full_page=True,animations='disabled')
  page.evaluate("() => {state.visitorStatus='completed';landing()}")
  assert page.locator('[data-action=start-friend]').count()==0
  assert page.locator('[data-action=resume-friend]').count()==1
  assert page.locator('.visitor-banner').count()==1
  assert not errs,errs
  print('PASS Chromium',width,'custom 4 photo upload / publish payload / friend landing / completed lock')
  context.close()
 browser.close()
