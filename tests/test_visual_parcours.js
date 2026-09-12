/* UI regression: real five-level data, responsive layouts, RTL and header actions.
   API calls are blocked by seedSignedIn; no production account is involved. */
const {chromium}=require('playwright');
const {seedSignedIn}=require('./seed_profile');
const assert=require('assert');
const path=require('path');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch();
 const output=process.env.WILAYA_VISUAL_OUT||'/tmp/wilayas/visual';fs.mkdirSync(output,{recursive:true});
 const url='file://'+path.resolve(__dirname,'../app/wilaya-v6.html');
 const axe=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
 const summary=[];
 for(const [width,lang,theme] of [[320,'fr','dark'],[360,'ar','dark'],[415,'fr','dark'],[415,'bi','dark'],[415,'ar','light'],[768,'fr','dark']]){
  const page=await browser.newPage({viewport:{width,height:950},colorScheme:theme,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const data={keyDone:true,xp:298,crowns:{u1:5,u2:3},streak:{count:1,last:null},progress:{},photoNon:true};
  for(let c=1;c<=18;c++) data.progress[c]={box:c<=10?5:3,due:Date.now()+86400000,seen:9,ok:8,best:1};
  await seedSignedIn(page,url,{name:'Med',lang,data});
  await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
  const rows=page.locator('.etape');assert.equal(await rows.count(),8);
  for(let i=0;i<3;i++)assert.equal(await rows.nth(i).locator('.niveau-rose').count(),5);
  for(let i=3;i<8;i++)assert.equal(await rows.nth(i).locator('.node-lock').count(),1);
  assert.equal(await rows.nth(0).locator('.niveau-rose.on').count(),0);
  assert.equal(await rows.nth(1).locator('.niveau-rose.on').count(),3);
  assert.equal(await rows.nth(2).locator('.niveau-rose.on').count(),0);
  assert.equal(await page.locator('.topbar-orn').count(),0,'One arch only, embedded in the banner');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  assert.equal(await page.locator('.topbar.patio').count(),1);
  assert.equal(await page.locator('.banner-text').count(),0,'Landscape remains free of text');
  const profile=await page.locator('#profile-btn').boundingBox();
  const sound=await page.locator('#sound-btn').boundingBox();
  assert(profile.x+profile.width<=sound.x||sound.x+sound.width<=profile.x,'Header controls do not overlap');
  await page.addScriptTag({content:axe});
  const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  await page.screenshot({path:path.join(output,`parcours-${width}-${lang}-${theme}.png`),fullPage:true});
  await page.screenshot({path:path.join(output,`ecran-${width}-${lang}-${theme}.png`),fullPage:false});
  assert.deepEqual(violations,[],JSON.stringify(violations));
  await page.locator('#topstat-xp').click();await page.locator('.xp-sheet').waitFor();
  assert((await page.locator('.xp-total').innerText()).includes('298'));
  await page.keyboard.press('Escape');assert.equal(await page.locator('#topstat-xp').evaluate(e=>document.activeElement===e),true);
  for(const tab of ['practice','info','path']){
   await page.locator('#tab-'+tab).click();assert.equal(await page.locator('#tab-'+tab).getAttribute('aria-selected'),'true');
  }
  assert.deepEqual(errors,[]);
  summary.push({width,lang,theme,violations:0});await page.close();
 }
 await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e);process.exit(1)});
