/* New information architecture: no duplicated controls or training state. */
const {chromium}=require('playwright'),assert=require('assert'),path=require('path');
const {seedSignedIn}=require('./seed_profile');
(async()=>{const browser=await chromium.launch();
 for(const [lang,width] of [['fr',390],['ar',360],['bi',320]]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await seedSignedIn(page,'file://'+path.resolve('app/wilaya-v6.html'),{lang,data:{keyDone:true,xp:900,photoNon:true}});
  assert.equal(await page.locator('.tabbar [role="tab"]').count(),2);
  assert.equal(await page.locator('#view-path #view-practice #act-free').count(),1);
  assert.equal(await page.locator('#view-info #method-section').count(),0);
  assert.equal(await page.locator('#view-path #method-section').count(),1);
  assert.equal(await page.locator('#view-settings #sync-section').count(),1);
  await page.locator('#tab-info').click();assert(await page.locator('#map-section').isVisible());assert(!(await page.locator('#act-free').isVisible()));
  await page.locator('#tab-path').click();await page.locator('#statstrip').click();
  assert(await page.locator('#learning-workshop').evaluate(e=>e.open));assert(await page.locator('#act-free').isVisible());
  assert.equal(await page.locator('#tab-path').getAttribute('aria-selected'),'true');
  await page.locator('#tab-practice').focus();await page.keyboard.press('Enter');assert(!(await page.locator('#act-free').isVisible()));
  await page.locator('#learning-guide > summary').focus();await page.keyboard.press('Enter');assert(await page.locator('#method-section').isVisible());
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[],lang);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp),900);
  await page.close();
 }await browser.close();console.log('Apprendre/Explorer : navigation, atelier intégré, guide, clavier, langues et données conservées validés.');
})().catch(e=>{console.error(e);process.exit(1)});
