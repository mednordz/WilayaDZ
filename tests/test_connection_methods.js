/* Synthetic account states and mail transport; never use real accounts. */
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const {signedInProfile}=require('./seed_profile');
(async()=>{
 const browser=await chromium.launch(),html=fs.readFileSync('app/wilaya-v6.html','utf8');
 const out=path.resolve('mockups/reglages');fs.mkdirSync(out,{recursive:true});
 for(const [lang,width,theme] of [['fr',390,'light'],['ar',360,'dark'],['bi',320,'dark']]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:theme});
  const p=signedInProfile({lang,data:{keyDone:true,xp:900,photoNon:true}});
  let state={email:p.cloud.email,verified:true,password_configured:true,google_email:'google-demo@example.com'},response=200,mails=0;
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='wilaya.test')return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
   if(u.pathname==='/api/config')return route.fulfill({json:{google:'test-client'}});
   if(u.pathname==='/api/me')return route.fulfill({status:response,json:{account:state}});
   if(u.pathname==='/api/auth/forgot'){mails++;return route.fulfill({status:204});}
   return route.fulfill({status:503,json:{error:'test_offline'}});
  });
  await page.addInitScript(p=>localStorage.setItem('wilaya-account-v1',JSON.stringify({profiles:[p],activeId:p.id})),p);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://wilaya.test/');
  async function open(){await page.locator('#settings-btn').click();await page.locator('[data-settings="account"]').click();await page.locator('[data-settings="methods"]').click();await page.locator('#connection-methods[aria-busy="false"]').waitFor();}
  await open();assert.equal(await page.locator('.connection-card').count(),3);
  assert.equal(await page.locator('[data-connection-action="google"]').count(),0);
  assert(await page.locator('[data-connection-action="password"]').isVisible());
  assert((await page.locator('#connection-methods').innerText()).includes('google-demo@example.com'));
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  async function check(name){
   const v=await page.evaluate(async()=>(await axe.run('#view-settings',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})));
   assert.deepEqual(v,[],name+lang);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:out+'/connexion-'+name+'-'+lang+'.png',fullPage:false});
  }
  await check('associe');
  state={...state,password_configured:null,google_email:null};await open();
  assert(await page.locator('[data-connection-action="google"]').isVisible());
  assert.equal(await page.locator('[data-connection-action="password"]').count(),0);await check('ancien');
  state={...state,password_configured:false,google_email:'google-demo@example.com'};await open();
  await page.locator('[data-connection-action="recovery"]').click();assert.equal(mails,0);
  await page.locator('#connection-send-link').click();await page.locator('#connection-send-link').waitFor({state:'hidden'});assert.equal(mails,1);await page.locator('#sheet-close').click();
  response=503;await open();assert.equal(await page.locator('.connection-card').count(),0);assert(await page.locator('#connection-retry').isVisible());await check('indisponible');
  response=401;await open();assert.equal(await page.locator('.connection-card').count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp),900);assert.deepEqual(errors,[]);await page.close();
 }
 await browser.close();console.log('Fiche connexion : états confirmés/inconnus, réseau, récupération volontaire, FR/AR/bilingue, clavier et contraste validés.');
})().catch(e=>{console.error(e);process.exit(1)});
