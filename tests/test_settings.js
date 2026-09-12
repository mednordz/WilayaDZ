const {chromium}=require('playwright');
const {seedSignedIn}=require('./seed_profile');
const assert=require('assert'),path=require('path'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch();const out='/tmp/wilayas/settings';fs.mkdirSync(out,{recursive:true});
 for(const [lang,width,theme] of [['fr',415,'light'],['ar',360,'dark'],['bi',320,'dark']]){
  const page=await browser.newPage({viewport:{width,height:950},colorScheme:theme,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seedSignedIn(page,'file://'+path.resolve('app/wilaya-v6.html'),{lang,data:{keyDone:true,xp:900,photoNon:true}});
  await page.locator('#settings-btn').click();
  assert(await page.locator('#view-settings').isVisible());
  assert.equal(await page.locator('#view-info #sync-section').count(),0);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  async function check(name){
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow '+width);
   const issues=await page.evaluate(async()=> (await axe.run('#view-settings',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
   assert.deepEqual(issues,[],name+' '+lang);await page.screenshot({path:`${out}/${name}-${lang}.png`,fullPage:true});
  }
  await check('home');
  for(const category of ['language','account','about']){await page.locator('[data-settings="'+category+'"]').click();await check(category);await page.locator('[data-settings="home"]').click();}
  await page.locator('[data-settings="audio"]').click();
  await page.locator('[data-switch="effects"]').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('[data-switch="effects"]').getAttribute('aria-checked'),'false');
  await check('audio');
  await page.locator('[data-settings="home"]').click();await page.locator('[data-settings="display"]').click();
  await page.locator('#setting-font').selectOption('system');await page.locator('#setting-size').selectOption('125');await page.locator('#setting-theme').selectOption('dark');
  await page.locator('[data-switch="motion"]').click();await check('display-large');
  await page.reload();await page.locator('#settings-btn').click();
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'20px');
  assert.equal(await page.locator('[data-switch="effects"]').getAttribute('aria-checked'),'false');
  await page.locator('[data-settings="backup"]').click();await page.locator('#settings-transfer summary').click();
  assert((await page.locator('#sync-code').inputValue()).startsWith('WLY1.'));await check('backup');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')));
  assert.equal(stored.profiles[0].data.xp,900);assert(!('volume' in stored.profiles[0].data));
  await page.locator('[data-settings="home"]').click();await page.locator('[data-settings="display"]').click();await page.locator('#settings-reset').click();
  // Confirm through the existing dialog.
  await page.locator('#confirm-ok').click();
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).fontSize==='16px');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'16px');
  assert.deepEqual(errors,[]);await page.close();
 }
 await browser.close();console.log('Réglages FR/AR/bilingue : persistance, progression, clavier, accessibilité et mobile validés.');
})().catch(e=>{console.error(e);process.exit(1)});
