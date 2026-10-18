"""No-network Chromium smoke test for soundtrack choice and controls.
Uses the actual V7 client UI and deterministic HTMLAudioElement substitute.
This does NOT test physical speakers or browser media decoding.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json
ROOT=Path(__file__).resolve().parent.parent
PUB=ROOT/'public'
js_story=re.sub(r'\bexport\s+','',(PUB/'story.js').read_text())
js_routes=re.sub(r'\bexport\s+','',(PUB/'soundtrack.js').read_text())
js_voice=re.sub(r'\bexport\s+','',(PUB/'voice-cues.js').read_text())
js_app=re.sub(r'^import .*?;\n','',(PUB/'app.js').read_text(),flags=re.MULTILINE)
js_app+='\nwindow.__V7={state,pref,landing};'
js_fetch='''
window.fetch=async(uri)=>uri==='/questions.json'?{ok:true,json:async()=>__QUESTIONS__}:{ok:false,status:404,json:async()=>({message:'mocked'})};
'''.replace('__QUESTIONS__',(PUB/'questions.json').read_text())
stub='''
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return this[k]||null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}}});
window.history.pushState=()=>{};
window.__audioInstances=[];
window.Audio=function(){
  const player={paused:true,src:'',loop:false,volume:0,preload:'',load(){this.loads=(this.loads||0)+1;},
    play(){this.paused=false;this.plays=(this.plays||0)+1;return Promise.resolve();},
    pause(){this.paused=true;this.pauses=(this.pauses||0)+1;}};
  window.__audioInstances.push(player);window.__player=player;return player;
};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in (390,1280):
  context=browser.new_context(viewport={'width':width,'height':850})
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><main id="app"></main><div id="toast"></div></body></html>')
  page.add_script_tag(content=stub+js_fetch+js_story+js_routes+js_voice+js_app)
  page.wait_for_function('window.__V7 && window.__player')
  def get():return page.evaluate('''() => ({src:__player.src,paused:__player.paused,loop:__player.loop,instances:__audioInstances.length,screen:__V7.state.screen,label:document.querySelector('.sound-toggle')?.textContent,prefMusic:__V7.pref.music,pauses:__player.pauses,plays:__player.plays})''')
  assert get()['src']=='/assets/audio/home-theme.m4a',get()
  assert get()['loop'] is True and get()['instances']==1
  page.evaluate("document.querySelector('[data-action=\"hero-world\"][data-value=\"forest\"]').click()")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/forest-theme.m4a',get()
  page.evaluate("() => {window.__V7.state.challenge={theme:'forest',avatar:'bear',name:'موسى'};window.__V7.landing()}")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/forest-theme.m4a',get()
  page.evaluate("document.querySelector('[data-action=\"home\"]').click()")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/home-theme.m4a',get()
  page.evaluate("document.querySelector('[data-action=\"hero-world\"][data-value=\"ocean\"]').click()")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/ocean-theme.m4a',get()
  page.evaluate("() => {window.__V7.state.challenge={theme:'ocean',avatar:'panda',name:'موسى'};window.__V7.landing()}")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/ocean-theme.m4a',get()
  page.evaluate("document.querySelector('[data-action=\"home\"]').click()")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/home-theme.m4a',get()
  page.evaluate("document.querySelector('[data-action=\"hero-world\"][data-value=\"classic\"]').click()")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/classic-theme.m4a',get()
  page.evaluate("() => {window.__V7.state.challenge={theme:'classic',avatar:'cat',name:'موسى'};window.__V7.landing()}")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/classic-theme.m4a',get()
  page.evaluate("document.querySelector('[data-action=\"toggle-music\"]').click()")
  page.wait_for_timeout(100)
  assert get()['paused'] is True,get()
  page.evaluate("document.querySelector('[data-action=\"toggle-music\"]').click()")
  page.wait_for_timeout(100)
  assert get()['paused'] is False,get()
  page.evaluate("document.querySelector('[data-action=\"home\"]').click()")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/home-theme.m4a',get()
  page.evaluate("() => {window.__V7.state.challenge={theme:'vampire',avatar:'bear',name:'موسى'};window.__V7.landing()}")
  page.wait_for_timeout(100)
  assert get()['src']=='/assets/audio/vampire-theme.m4a',get()
  assert get()['instances']==1,get()
  assert not errors,errors
  print('PASS offline chromium',width,'home→forest→friend forest→home→ocean→friend ocean→classic→friend classic→off→on→home→friend vampire (1 persistent audio player)')
  context.close()
 browser.close()
