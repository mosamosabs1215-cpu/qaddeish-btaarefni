"""Round04 Chromium renderer against the actual V7 CSS/JS, with locally packaged assets and mocked HTTP.
Network navigation is blocked by this runner. This is isolated visual QA, not public hosting QA.
"""
import pathlib, json, base64, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]; PUB=ROOT/'public'
assets={}
files=list((PUB/'assets/characters').glob('*.webp'))+list((PUB/'assets/worlds').glob('*.webp'))+list((PUB/'assets/answers').glob('p-*.webp'))+list((PUB/'assets/cinematics').glob('*/*.webp'))+[PUB/'assets/official-home.png']
for f in files:
    key='/'+f.relative_to(PUB).as_posix(); mime='image/png' if f.suffix=='.png' else 'image/webp'
    assets[key]=f'data:{mime};base64,'+base64.b64encode(f.read_bytes()).decode()
js1=(PUB/'story.js').read_text().replace('export const','const').replace('export function','function')
js1=js1.replace('`/assets/characters/${id}-restored.webp`','window.__assets[`/assets/characters/${id}-restored.webp`]')
js1=js1.replace('`/assets/worlds/${id}.webp`','window.__assets[`/assets/worlds/${id}.webp`]')
js1=js1.replace('`/assets/cinematics/${[\'forest\',\'ocean\',\'vampire\',\'classic\'].includes(world)?world:\'forest\'}/${[\'meeting\',\'reply\',\'suspense\',\'reveal\',\'finale\'].includes(beat)?beat:\'meeting\'}.webp`', 'window.__assets[`/assets/cinematics/${[\'forest\',\'ocean\',\'vampire\',\'classic\'].includes(world)?world:\'forest\'}/${[\'meeting\',\'reply\',\'suspense\',\'reveal\',\'finale\'].includes(beat)?beat:\'meeting\'}.webp`]')
js2=(PUB/'app.js').read_text();js2=re.sub(r'^import .*?;\n','',js2,count=1)
js2=js2.replace("history.replaceState({},'', '/owner/'+r.id);",'')
js2=js2.replace('app.innerHTML=scenery()+header()+(bare?body:`<div class="container">${body}</div>`);','app.innerHTML=scenery()+header()+(bare?body:`<div class="container">${body}</div>`);window.__fixAssets?.();')
css=(PUB/'styles.css').read_text();css=re.sub(r"@import url\(.*?\);",'',css)
css=css.replace("url('/assets/worlds/forest.webp')",'url("'+assets['/assets/worlds/forest.webp']+'")')
mock='''
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return this[k]||null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}}});
window.__assets=__ASSETS__;
window.__fixAssets=()=>{document.querySelectorAll('img').forEach(e=>{const url=e.getAttribute('src');if(url&&url.startsWith('/assets/')&&window.__assets[url])e.setAttribute('src',window.__assets[url]);});};
window.__bank=__BANK__;
window.fetch=async(path,opts={})=>{const url=String(path),body=opts.body?JSON.parse(opts.body):{};
if(url==='/questions.json')return{ok:true,json:async()=>window.__bank};
if(url==='/api/challenges'&&opts.method==='POST'){window.__created={id:'R04Demo',name:body.name,avatar:body.avatar,theme:body.theme,questions:body.questions.map((q,i)=>({...q,position:i}))};return{ok:true,json:async()=>({id:'R04Demo',ownerToken:'fake-visual-preview-token',name:body.name})}}
if(url.startsWith('/api/challenges/R04Demo'))return{ok:true,json:async()=>window.__created};
return {ok:false,status:404,json:async()=>({message:'Mocked QA request only'})};};
'''.replace('__ASSETS__',json.dumps(assets)).replace('__BANK__',json.dumps(json.loads((PUB/'questions.json').read_text()),ensure_ascii=False))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in (390,1280):
        context=browser.new_context(viewport={'width':width,'height':844 if width==390 else 870},device_scale_factor=1, reduced_motion='reduce')
        page=context.new_page();page.set_default_timeout(15000)
        errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
        page.set_content('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="app"></main><div id="toast"></div></body></html>')
        page.add_style_tag(content=css)
        page.add_script_tag(content=mock+'\n'+js1+'\n'+js2)
        page.wait_for_selector('.home-picker .picker-avatar')
        assert page.locator('.picker-avatar').count()==5
        assert page.locator('.picker-world').count()==4
        page.locator('.picker-avatar[data-value=witch]').click();page.locator('.picker-world[data-value=ocean]').click()
        assert page.locator('.picker-world[data-value=ocean]').get_attribute('aria-pressed')=='true'
        assert page.locator('.picker-avatar[data-value=witch]').get_attribute('aria-pressed')=='true'
        # the integrated audio control modifies settings, not the static artwork
        page.locator('[data-action=toggle-music]').click(); assert page.locator('.sound-toggle').get_attribute('aria-pressed')=='true'
        page.screenshot(path=str(ROOT/f'r04-home-{width}.png'),full_page=True,animations='disabled')
        (page.locator('.hero-actions [data-action=create]').first if width==390 else page.locator('.hero-bottom [data-action=create]').first).click()
        page.locator('#owner-name').fill('موسى')
        page.locator('[data-action=start-building]').click()
        assert page.locator('.quiz-panel .answer img').count()==4
        assert page.locator('.quiz-world-stamp').count()==1
        assert 'موسى' in page.locator('.quiz-title').inner_text()
        page.screenshot(path=str(ROOT/f'r04-question-{width}.png'),full_page=True,animations='disabled')
        for i in range(10):page.locator('[data-action=choose-correct]').first.click()
        page.locator('[data-action=publish]').click();page.wait_for_selector('#share-link')
        page.evaluate('''() => {state.challenge=window.__created;state.friendName='ليلى';state.friendAvatar='cat';state.theme='ocean';pref.auto=false;launchStory(8,{preview:true})}''')
        page.wait_for_selector('.story-stage');page.screenshot(path=str(ROOT/f'r04-story-{width}.png'),full_page=True,animations='disabled')
        for i in range(3):page.locator('[data-action=story-next]').click()
        assert page.locator('.story-board strong').inner_text()=='8/10'
        assert page.locator('.actor.owner').get_attribute('alt').endswith('موسى')
        page.screenshot(path=str(ROOT/f'r04-reveal-{width}.png'),full_page=True,animations='disabled')
        assert not errs,errs
        print('PASS V7 isolated',width,'5 characters / 4 worlds / answers / score 8/10 / music toggle')
        context.close()
    browser.close()
