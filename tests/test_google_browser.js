/* Entire origin and Google page simulated; no requests reach external services. */
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs');
const {signedInProfile}=require('./seed_profile');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:415,height:950},reducedMotion:'reduce'});
 const html=fs.readFileSync('app/wilaya-v6.html','utf8'),base='https://wilaya.test/';
 const profile=signedInProfile({lang:'fr',data:{keyDone:true,xp:900,photoNon:true}});
 let prepareBody,linkCount=0,googleURL;
 const acct={email:profile.cloud.email,name:profile.name,verified:true,google_email:null};
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;let status=200,data={};
  if(u.hostname==='accounts.google.com'){googleURL=u;return route.fulfill({contentType:'text/html',body:'Google simulé'});}
  if(u.hostname!=='wilaya.test') return route.abort();
  if(p==='/')return route.fulfill({contentType:'text/html',body:html});
  if(p==='/api/config')data={google:'test-client'};
  else if(p==='/api/me') data={account:acct};
  else if(p==='/api/auth/google/prepare'){prepareBody=route.request().postDataJSON();data={challenge:'test-challenge'};}
  else if(p==='/api/auth/google/link'){
   linkCount++;const b=route.request().postDataJSON();assert.equal(b.nonce,prepareBody.nonce);assert.equal(b.challenge,'test-challenge');assert.equal(route.request().headers().authorization,'Bearer '+profile.cloud.token);
   data={account:{...acct,google_email:'different@gmail.com'}};
  }else {status=503;data={error:'test_offline'};}
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(p=>{if(!localStorage.getItem('wilaya-account-v1'))localStorage.setItem('wilaya-account-v1',JSON.stringify({activeId:p.id,profiles:[p]}));},profile);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#settings-btn').click();await page.locator('[data-settings="account"]').click();await page.locator('[data-settings="methods"]').click();await page.locator('[data-connection-action="google"]').click();
 await page.locator('#google-link-password').fill('Test-password-only');await page.locator('#google-link-start').click();
 await page.waitForURL('https://accounts.google.com/**');
 assert.equal(prepareBody.password,'Test-password-only');assert.equal(googleURL.searchParams.get('nonce'),prepareBody.nonce);
 await page.goto(base+'#state='+googleURL.searchParams.get('state')+'&id_token=simulated-token');
 await page.waitForSelector('#view-settings.active');assert.equal(linkCount,1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp),900);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('wilaya-google-v1')),null);
 // Replaying a URL without its session guard cannot trigger authentication.
 await page.goto(base+'#state=bad&id_token=replay');await page.reload();await page.waitForTimeout(150);assert.equal(linkCount,1);
 assert.equal(new URL(page.url()).hash,'');
 // Capture the real settings page with music enabled as an available web control.
 await page.locator('#settings-btn').click();await page.screenshot({path:'/tmp/wilayas/settings/home-web.png',fullPage:false});
 await page.locator('[data-settings="audio"]').click();
 await page.locator('[data-switch="music"]').click();await page.locator('#setting-volume').fill('67');
 assert.equal(await page.evaluate(()=>document.getElementById('musique').volume),.67);
 await page.locator('[data-switch="music"]').click();assert(await page.locator('#setting-volume').isDisabled());
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=>(await axe.run('#view-settings',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id));assert.deepEqual(violations,[]);
 assert.deepEqual(errors,[]);await browser.close();console.log('Association Google navigateur, retour OAuth, anti-rejeu et volume réel validés.');
})().catch(e=>{console.error(e);process.exit(1)});
