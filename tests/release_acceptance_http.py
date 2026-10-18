"""V7 prelaunch acceptance: real Node HTTP, real SQLite, browser-like cookies, persistent restart, verified backup/restore.
No real public HTTPS, physical device, or human listening is claimed.
"""
import concurrent.futures,contextlib,http.cookiejar,json,os,pathlib,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
def port_available():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(base,path,method='GET',data=None,secret=None,opener=None,headers=None):
 url=base+path;bs=None if data is None else json.dumps(data,ensure_ascii=False).encode()
 h={'Accept':'application/json',**(headers or {})}
 if bs is not None:h['Content-Type']='application/json'
 if secret:h['Authorization']='Bearer '+secret
 req=urllib.request.Request(url,method=method,data=bs,headers=h)
 try:
  with (opener.open(req,timeout=10) if opener else urllib.request.urlopen(req,timeout=10)) as r:
   buf=r.read();return r.status,json.loads(buf) if 'json' in r.headers.get('Content-Type','') else buf,r.headers
 except urllib.error.HTTPError as e:
  buf=e.read();return e.code,json.loads(buf) if 'json' in e.headers.get('Content-Type','') else buf,e.headers
@contextlib.contextmanager
def server(data_dir,production=False):
 port=port_available();base=f'http://127.0.0.1:{port}'
 env={**os.environ,'PORT':str(port),'DATA_DIR':str(data_dir),'NODE_ENV':'production' if production else 'development'}
 if production:env['PUBLIC_ORIGIN']='https://v7.example.test'
 proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 try:
  for attempt in range(100):
   try:
    status,*_=request(base,'/api/health');
    if status==200:break
   except (urllib.error.URLError,TimeoutError):time.sleep(.06)
  else:raise RuntimeError('V7 API did not start: '+str(proc.stderr.read()))
  yield base
 finally:
  proc.terminate()
  try:proc.wait(timeout=4)
  except subprocess.TimeoutExpired:proc.kill()

def make_questions():return [{'id':f'p-{i:02}', 'text':f'ما السؤال الشخصي رقم {i}؟', 'options':['الأول','الثاني','الثالث','الرابع'], 'correctIndex':(i-1)%4,'category':'ذكريات'} for i in range(1,11)]

def visit_full_challenge(base,cid,username,avatar,score,opener):
 status,a,h=request(base,f'/api/challenges/{cid}/attempts','POST',{'name':username,'avatar':avatar},opener=opener);assert status==201,(status,a)
 assert 'HttpOnly' in h['Set-Cookie'] and 'SameSite=Lax' in h['Set-Cookie']
 status,b,_=request(base,f'/api/challenges/{cid}/attempts','POST',{'name':username,'avatar':avatar},opener=opener)
 assert status==409 and b['code']=='ALREADY_PLAYED'
 attempt=a['id'];oldtoken=a['accessToken']
 status,b,_=request(base,f'/api/challenges/{cid}/resume','POST',{},opener=opener)
 assert status==200 and b['id']==attempt and b['accessToken']!=oldtoken
 status,_,_=request(base,f'/api/attempts/{attempt}',secret=oldtoken);assert status==403
 token=b['accessToken']
 for i in range(10):
  choice=i%4 if i<score else (i+1)%4
  status,ans,_=request(base,f'/api/attempts/{attempt}/answer','POST',{'position':i,'choice':choice},secret=token)
  assert status==200 and ans['correct']==(i<score),(status,ans,i)
  status,old,_=request(base,f'/api/attempts/{attempt}/answer','POST',{'position':i,'choice':choice},secret=token)
  assert status==409,(status,old)
 status,info,_=request(base,f'/api/attempts/{attempt}',secret=token);assert status==200 and info['score']==score and info['finished']
 status,_,_=request(base,f'/api/attempts/{attempt}/answer','POST',{'position':9,'choice':0},secret=token);assert status==409
 return attempt

with tempfile.TemporaryDirectory(prefix='v7-release-http-') as tmp:
 tmp=pathlib.Path(tmp);data=tmp/'persistent';data.mkdir()
 with server(data) as base:
  status,health,headers=request(base,'/api/health');assert status==200 and health['database']=='ok'
  assert "script-src 'self'" in headers.get('Content-Security-Policy','')
  assert headers.get('X-Frame-Options')=='DENY'
  for path in ['/', '/app.js','/styles.css','/assets/characters/bear-master.png','/assets/worlds/forest.webp']:
   status,_,_=request(base,path);assert status==200,(path,status)
  name='موسى <img onerror=alert(1)>'
  status,ch,_=request(base,'/api/challenges','POST',{'name':name,'avatar':'bear','theme':'ocean','questions':make_questions()})
  assert status==201,(status,ch);cid=ch['id'];owner=ch['ownerToken']
  status,public,_=request(base,f'/api/challenges/{cid}');assert status==200 and public['name']==name
  assert 'correctIndex' not in str(public) and 'ownerToken' not in str(public)
  assert all(len(q['options'])==4 for q in public['questions'])
  status,markup,_=request(base,f'/play/{cid}');assert status==200 and b'&lt;img' in markup and b'og:title' in markup
  status,_,_=request(base,f'/api/challenges/{cid}/stats');assert status==403
  status,_,_=request(base,f'/api/challenges/{cid}/stats',secret='badsecret');assert status==403
  visit_full_challenge(base,cid,'سارة','panda',10,client())
  visit_full_challenge(base,cid,'أحمد','cat',0,client())
  status,board,_=request(base,f'/api/challenges/{cid}/leaderboard');assert status==200 and [x['score'] for x in board['leaders']]==[10,0]
  status,stats,_=request(base,f'/api/challenges/{cid}/stats',secret=owner)
  assert status==200 and stats['stats']['finished']==2 and stats['stats']['average']==5 and stats['stats']['perfect']==1
  assert stats['stats']['started']==2
  # concurrent reading through real Node HTTP+SQLite; without false claims of heavy production load.
  def worker(i):
   return request(base,f'/api/challenges/{cid}/leaderboard')[0]
  with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
   statuses=list(pool.map(worker,range(50)))
  assert statuses==[200]*50,statuses
  status,_,_=request(base,f'/api/challenges/{cid}','PATCH',{'active':False},secret=owner);assert status==200
  status,_,_=request(base,f'/api/challenges/{cid}');assert status==410
  status,_,_=request(base,f'/api/challenges/{cid}','PATCH',{'active':True},secret=owner);assert status==200
  print('PASS real HTTP & SQLite: 2 separate browser cookie jars, scores 10/0, anti-replay, revoke/resume, owner privacy, 50 concurrent reads')
  # Hot online backup via the official backup helper, then restore into a clean independent database.
  out=tmp/'private-backups';cp=subprocess.run(['python',str(ROOT/'scripts/backup_database.py'),'--db',str(data/'knowme.sqlite'),'--out',str(out)],capture_output=True,text=True)
  assert cp.returncode==0,cp.stderr
  backup=next(out.glob('*.sqlite'))
  with sqlite3.connect(backup) as con:
   assert con.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
   assert con.execute('SELECT count(*) FROM attempts').fetchone()[0]==2
  print('PASS verified online SQLite backup before server stop')
 # persistent restart proves process restart doesn't lose attempts or passwords
 with server(data) as base:
  status,board,_=request(base,f'/api/challenges/{cid}/leaderboard');assert status==200 and len(board['leaders'])==2
  status,stats,_=request(base,f'/api/challenges/{cid}/stats',secret=owner);assert status==200 and stats['stats']['finished']==2
  print('PASS persistent SQLite restart')
 import shutil
 restored=tmp/'restored';restored.mkdir();shutil.copy2(backup,restored/'knowme.sqlite')
 with server(restored) as base:
  status,board,_=request(base,f'/api/challenges/{cid}/leaderboard');assert status==200 and sorted(i['score'] for i in board['leaders'])==[0,10]
  status,stats,_=request(base,f'/api/challenges/{cid}/stats',secret=owner);assert status==200 and stats['stats']['finished']==2
  print('PASS backup restore to independent server')
 with server(tmp/'production' if False else data, production=True) as base:
  status,_,headers=request(base,'/api/health');assert status==200
  assert 'Strict-Transport-Security' in headers
  print('PASS production headers / configured guard; no true HTTPS tested')
print('ALL HTTP ACCEPTANCE CHECKS PASSED (not production approval)')
