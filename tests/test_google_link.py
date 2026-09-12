"""Google identity/link HTTP regressions. Fake Google transport; isolated SQLite only."""
import io, json, os, sys, tempfile, threading, time, unittest, urllib.request, urllib.error
from pathlib import Path
from unittest import mock
scratch=tempfile.TemporaryDirectory(prefix='wilaya-google-test-')
os.environ['WILAYA_DB']=scratch.name+'/accounts.sqlite3'
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
import app as api

class GoogleLinkTests(unittest.TestCase):
 def setUp(self):
  api.store=api.Store(scratch.name+'/'+str(time.time_ns())+'.sqlite3')
  api.GOOGLE_CLIENT_ID='test-client'
  api.limiter=api.RateLimiter()
  self.server=api.BoundedHTTPServer(('127.0.0.1',0),api.Handler)
  self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
  self.base='http://127.0.0.1:%d/api'%self.server.server_port
  self.password='Fictif-only-password-92'
  self.a,self.token=self.account('first@example.com')
  self.b,self.token_b=self.account('second@example.com')
  self.nonce='a'*48
  self.info={'aud':'test-client','iss':'https://accounts.google.com','exp':int(time.time())+300,'sub':'google-subject-one','email':'different@gmail.com','email_verified':True,'nonce':self.nonce}
  # Patch only the API's Google transport, not the client's HTTP library.
  self.original=urllib.request.urlopen
  self.patch=mock.patch.object(api.urllib.request,'urlopen',side_effect=self.transport);self.patch.start()
 def tearDown(self):
  self.patch.stop();self.server.shutdown();self.server.server_close();self.thread.join()
 def transport(self,url,*args,**kwargs):
  if isinstance(url,str) and url.startswith(api.GOOGLE_TOKENINFO):return io.BytesIO(json.dumps(self.info).encode())
  return self.original(url,*args,**kwargs)
 def account(self,email):
  salt=os.urandom(16);cur=api.store.write('INSERT INTO accounts (email,name,pw_salt,pw_hash,created,verified,data) VALUES (?,?,?,?,?,1,?)',(email,'Fictif',salt,api.hash_password(self.password,salt),int(time.time()),'{"xp":900}'))
  raw,digest=api.new_token();api.store.write('INSERT INTO sessions VALUES (?,?,?,?)',(digest,cur.lastrowid,int(time.time()),int(time.time())))
  return cur.lastrowid,raw
 def req(self,path,body,token=None):
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  req=urllib.request.Request(self.base+path,data=json.dumps(body).encode(),headers=headers,method='POST')
  try:r=urllib.request.urlopen(req)
  except urllib.error.HTTPError as e:r=e
  return r.status,json.loads(r.read() or '{}')
 def prepare(self,token=None):
  code,data=self.req('/auth/google/prepare',{'password':self.password,'nonce':self.nonce},token or self.token);self.assertEqual(code,200,data);return data['challenge']
 def link(self,challenge,token=None):return self.req('/auth/google/link',{'credential':'fake-token','nonce':self.nonce,'challenge':challenge},token or self.token)
 def test_link_and_future_login_preserve_account(self):
  challenge=self.prepare();code,data=self.link(challenge);self.assertEqual(code,200,data)
  self.assertEqual(data['account']['email'],'first@example.com');self.assertEqual(data['account']['google_email'],'different@gmail.com')
  self.assertEqual(api.store.one('SELECT data FROM accounts WHERE id=?',(self.a,))['data'],'{"xp":900}')
  self.assertEqual(self.link(challenge)[0],400,'single-use')
  self.info['email']='renamed@gmail.com'
  code,data=self.req('/auth/google',{'credential':'fake','nonce':self.nonce});self.assertEqual(code,200,data);self.assertEqual(data['account']['email'],'first@example.com')
  self.assertEqual(len(api.store.query('SELECT * FROM accounts')),2)
  self.assertEqual(self.req('/auth/login',{'email':'first@example.com','password':self.password})[0],200)
 def test_reauth_and_binding(self):
  self.assertEqual(self.req('/auth/google/prepare',{'password':'wrong','nonce':self.nonce},self.token)[0],401)
  self.assertEqual(self.req('/auth/google/prepare',{'password':self.password,'nonce':self.nonce})[0],401)
  challenge=self.prepare();self.assertEqual(self.link(challenge,self.token_b)[0],400)
  self.info['nonce']='wrong';self.assertEqual(self.link(challenge)[0],400)
  self.info['nonce']=self.nonce;api.store.write('UPDATE google_links SET expires=0');self.assertEqual(self.link(challenge)[0],400)
  self.assertEqual(len(api.store.query('SELECT * FROM google_identities')),0)
 def test_conflicts_do_not_merge(self):
  self.assertEqual(self.link(self.prepare())[0],200)
  self.assertEqual(self.link(self.prepare(self.token_b),self.token_b)[0],409)
  self.info['sub']='another-subject';self.info['email']='second@example.com'
  self.assertEqual(self.link(self.prepare())[0],409)
  self.assertEqual(len(api.store.query('SELECT * FROM accounts')),2)
 def test_token_validation(self):
  challenge=self.prepare()
  for field,value in [('aud','other-client'),('iss','evil.example'),('exp',0),('sub',''),('email_verified',False)]:
   old=self.info[field];self.info[field]=value
   self.assertEqual(self.link(challenge)[0],400,field);self.info[field]=old
  self.assertEqual(self.req('/auth/google',{'credential':'fake'})[0],400)
 def test_password_metadata(self):
  self.assertIsNone(api.store.one('SELECT password_configured FROM accounts WHERE id=?',(self.a,))['password_configured'])
  code,data=self.req('/auth/login',{'email':'first@example.com','password':self.password})
  self.assertEqual(code,200);self.assertIs(data['account']['password_configured'],True)
  code,data=self.req('/auth/google',{'credential':'fake','nonce':self.nonce})
  self.assertEqual(code,200);self.assertIs(data['account']['password_configured'],False)
  row=api.store.one('SELECT * FROM accounts WHERE email=?',('different@gmail.com',))
  raw,digest=api.new_token()
  api.store.write('INSERT INTO resets (token_hash,account_id,created,expires) VALUES (?,?,?,?)',(digest,row['id'],int(time.time()),int(time.time())+600))
  code,data=self.req('/auth/reset',{'token':raw,'password':self.password})
  self.assertEqual(code,200);self.assertIs(data['account']['password_configured'],True)
  code,data=self.req('/auth/password',{'current':self.password,'next':'Changed-test-password-92'},self.token)
  self.assertEqual(code,204)
  self.assertEqual(api.store.one('SELECT password_configured FROM accounts WHERE id=?',(self.a,))['password_configured'],1)
  self.assertEqual(self.req('/auth/register',{'email':'new-email@example.com','name':'Fictif','password':self.password})[0],202)
  self.assertEqual(api.store.one('SELECT password_configured FROM accounts WHERE email=?',('new-email@example.com',))['password_configured'],1)

 def test_pseudo_login_and_collisions(self):
  def rename(token,name):
   code,data=self.req('/auth/name',{'name':name},token)
   self.assertEqual(code,200,data)
   return data['account']
  def login(name,password=None):
   return self.req('/auth/login',{'email':name,'password':self.password if password is None else password})
  self.assertTrue(rename(self.token,'Étoile Alger')['pseudo_login_available'])
  code,data=login('  ÉTOILE   ALGER  ')
  self.assertEqual(code,200,data);self.assertEqual(data['account']['email'],'first@example.com')
  self.assertEqual(api.store.one('SELECT data FROM accounts WHERE id=?',(self.a,))['data'],'{"xp":900}')
  self.assertEqual(login('Étoile Alger','wrong')[0],401)
  self.assertEqual(login('Étoile Alger','')[0],401)
  self.assertFalse(rename(self.token_b,'ÉTOILE Alger')['pseudo_login_available'])
  self.assertEqual(login('Étoile Alger')[0],401)
  self.assertEqual(login('first@example.com')[0],200)
  api.store.write('UPDATE accounts SET verified=0 WHERE id=?',(self.b,))
  self.assertEqual(login('Étoile Alger')[0],200,'pending duplicates cannot block login')
  self.assertTrue(rename(self.token,'الجزائر')['pseudo_login_available'])
  self.assertEqual(login('الجزائر')[0],200)
  self.assertEqual(login('Étoile Alger')[0],401,'old name cannot log in')
  self.assertFalse(rename(self.token,'name@example.com')['pseudo_login_available'])
  self.assertEqual(login('first@example.com')[0],200)
  self.assertEqual(api.login_name_key(' Ａｍｉｎｅ '),'amine')
  self.assertEqual(api.login_name_key('e\u0301toile'),api.login_name_key('Étoile'))
  self.assertIsNone(api.login_name_key('x'*129))
  self.assertEqual(self.req('/auth/register',{'email':'pseudo-new@example.com','name':'Nouveau','password':self.password})[0],202)
  self.assertEqual(api.store.one('SELECT login_name FROM accounts WHERE email=?',('pseudo-new@example.com',))['login_name'],'nouveau')

 def test_migration_preserves_existing_data(self):
  with api.store._lock,api.store._db:
   api.store._db.execute('DROP TABLE google_links');api.store._db.execute('DROP TABLE google_identities');api.store._db.execute('DROP INDEX accounts_login_name');api.store._db.execute('ALTER TABLE accounts DROP COLUMN login_name');api.store._db.execute('ALTER TABLE accounts DROP COLUMN password_configured');api.store._db.execute('PRAGMA user_version=3')
   api.store._migrate()
  self.assertEqual(api.store.one('SELECT data FROM accounts WHERE id=?',(self.a,))['data'],'{"xp":900}')
  self.assertEqual(api.store.one('SELECT login_name FROM accounts WHERE id=?',(self.a,))['login_name'],'fictif')
  self.assertEqual(self.req('/auth/login',{'email':'Fictif','password':self.password})[0],401)
  self.assertEqual(self.link(self.prepare())[0],200)

if __name__=='__main__':unittest.main(verbosity=2)
