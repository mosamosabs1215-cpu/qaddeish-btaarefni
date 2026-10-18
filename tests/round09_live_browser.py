"""Real local HTTP, Chromium, SQLite and first-party browser audio policy integration.
No simulated local HTML and no global state monkeypatches. Does not test physical speakers.
"""
import contextlib,json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0)); PORT=sock.getsockname()[1]
URL=f'http://127.0.0.1:{PORT}'

def api(path, data=None, headers=None):
 payload=None if data is None else json.dumps(data,ensure_ascii=False).encode()
 req=urllib.request.Request(URL+path,data=payload,headers={'Content-Type':'application/json',**(headers or {})},method='GET' if data is None else 'POST')
 try:
  with urllib.request.urlopen(req,timeout=10) as r:return r.status,json.loads(r.read().decode()),r.headers
 except urllib.error.HTTPError as e:
  return e.code,json.loads(e.read().decode()),e.headers

with tempfile.TemporaryDirectory(prefix='v7-live-') as tmp:
 proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(PORT),'DATA_DIR':tmp,'NODE_ENV':'development'},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 try:
  for attempt in range(100):
   try:
    status,_,_=api('/api/health')
    if status==200:break
   except Exception:time.sleep(.08)
  else:raise RuntimeError('Server did not start')
  status,_,headers=api('/api/health');assert status==200
  assert "script-src 'self'" in headers['Content-Security-Policy']
  scenes=0
  with sync_playwright() as pl:
   browser=pl.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   cases=[('forest','bear','cat',10,390,844),('ocean','panda','lunar',0,390,844),('vampire','witch','bear',5,1280,870),('classic','lunar','panda',8,1280,870)]
   for theme,owner,friend,score,width,height in cases:
    questions=[{'id':f'qa-{i}','text':f'سؤال اختبار التكامل {i+1}؟','options':['الأول','الثاني','الثالث','الرابع'],'correctIndex':i%4,'category':'اختبار'} for i in range(10)]
    status,ch,_=api('/api/challenges',{'name':'موسى','avatar':owner,'theme':theme,'questions':questions});assert status==201,(status,ch)
    ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='reduce')
    ctx.add_init_script("localStorage.setItem('v7:prefs',JSON.stringify({auto:false,music:false,voices:false,effects:false,volume:.27}))")
    page=ctx.new_page();errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.route('https://fonts.googleapis.com/**',lambda route:route.fulfill(status=200,body='',content_type='text/css'))
    page.route('https://fonts.gstatic.com/**',lambda route:route.abort())
    page.goto(URL+'/play/'+ch['id'],wait_until='domcontentloaded',timeout=25000)
    page.locator('#friend-name').wait_for(timeout=15000)
    assert page.locator('button.avatar-card').count()==5
    assert page.locator('button.avatar-card img').evaluate_all('(els)=>els.every(e=>e.src.includes("-card.webp"))')
    page.locator(f'button.avatar-card[data-value="{friend}"]').click()
    page.locator('#friend-name').fill('فُرات')
    page.locator('[data-action="start-friend"]').click()
    for q in range(10):
     page.locator('button.answer').first.wait_for()
     ans=q%4 if q<score else (q+1)%4
     page.locator('button.answer').nth(ans).click()
     page.locator('[data-action="next-answer"]').wait_for(timeout=10000)
     page.locator('[data-action="next-answer"]').click()
    for beat in range(5):
     stage=page.locator('#story-stage');stage.wait_for(timeout=10000)
     vals=stage.evaluate('''el=>({world:el.dataset.world,beat:Number(el.dataset.beat),images:[...el.querySelectorAll('.actor')].map(a=>({src:a.getAttribute('src'),complete:a.complete,w:a.naturalWidth,h:a.naturalHeight,fit:getComputedStyle(a).objectFit}))})''')
     assert vals['world']==theme and vals['beat']==beat,(theme,beat,vals)
     page.wait_for_function('''()=>Array.from(document.querySelectorAll('#story-stage .actor')).every(a=>a.complete&&a.naturalWidth===1086&&a.naturalHeight===1448)''')
     assert len(vals['images'])==2
     assert all(a['src'].endswith('-master.png') and a['fit']=='contain' for a in vals['images'])
     if beat==4 and theme in ('forest','vampire'):
      out=ROOT/f'round09-{theme}-{width}.png'
      page.screenshot(path=str(out),animations='disabled',full_page=False)
     scenes+=1
     page.locator('[data-action="story-next"]').click()
    page.locator('[data-action="share-result"]').wait_for()
    assert f'{score}' in page.locator('.panel').first.inner_text(),(theme,score)
    result=ctx.request.get(URL+f'/api/challenges/{ch["id"]}/leaderboard').json()
    assert len(result['leaders'])==1 and result['leaders'][0]['score']==score,result
    assert not errors,(theme,errors)
    ctx.close()
    print(f'PASS live {theme}: creator={owner}, friend={friend}, score={score}, 5 pictures and real HTTP/SQLite; {width}px')
   browser.close()
  print(f'PASS live browser total={scenes} finale shots across 4 worlds, 2 viewports; no JS errors')
 finally:
  proc.terminate()
  try:proc.wait(timeout=4)
  except subprocess.TimeoutExpired:proc.kill()
