/* Approved patio, real dynamic controls, synthetic accounts, no production transport. */
const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
const {signedInProfile}=require('./seed_profile');
(async()=>{
 const browser=await chromium.launch(),html=fs.readFileSync('app/wilaya-v6.html','utf8');
 fs.mkdirSync('mockups/patio-algerois/verification',{recursive:true});
 for(const [lang,width,theme,size] of [['fr',390,'dark',100],['ar',360,'light',100],['bi',320,'dark',125],['fr',520,'light',100]]){
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  const name=lang==='bi'?'Mednor-Voyageur-Algérien':'mednor';
  const p=signedInProfile({name,lang,data:{keyDone:true,xp:900,crowns:{u1:5,u2:1},streak:{count:1,last:null},photoNon:true,progress:{1:{box:5,due:9999999999999,seen:6,ok:6},2:{box:5,due:9999999999999,seen:6,ok:6},3:{box:1,due:0,seen:2,ok:1}}}});
  await page.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:html}):r.fulfill({status:503}));
  await page.addInitScript(({p,size,theme})=>{
   if(!localStorage.getItem('wilaya-account-v1'))localStorage.setItem('wilaya-account-v1',JSON.stringify({profiles:[p],activeId:p.id}));
   localStorage.setItem('wilaya-preferences-v1',JSON.stringify({size,theme,effects:false}));localStorage.setItem('wilaya-sound-v1','0');
   HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){};
  },{p,size,theme});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://patio.test/');
  assert.equal(await page.locator('#profile-caption').innerText(),name);
  assert.equal(await page.locator('.banner-text').count(),0);
  assert.equal(await page.locator('audio').count(),0);
  await page.locator('#sound-btn').click();assert.equal(await page.locator('#sound-btn').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('wilaya-sound-v1')),'0');
  const labels={fr:'FR',ar:'ع',bi:'FR / ع'},next={fr:'ar',ar:'bi',bi:'fr'};let current=lang;
  for(let i=0;i<3;i++){
   await page.locator('#language-btn').click();current=next[current];
   assert.equal(await page.locator('#language-current').innerText(),labels[current]);
   assert.equal(await page.locator('html').getAttribute('dir'),current==='ar'?'rtl':'ltr');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp),900);
  }
  await page.reload();assert.equal(await page.locator('#language-current').innerText(),labels[lang]);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for(const section of ['path','settings','info','practice']){
   if(section==='settings'){await page.locator('#settings-btn').click();await page.locator('[data-settings="audio"]').click();}
   else await page.locator('#tab-'+section).click();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),lang+' overflow '+section);
   const selectors=['#brand-home','#topstat-streak','#topstat-xp','#sound-btn','#profile-btn','#language-btn','#settings-btn'];
   const boxes=await Promise.all(selectors.map(s=>page.locator(s).boundingBox()));
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.width<=b.x+.5||b.x+b.width<=a.x+.5||a.y+a.height<=b.y+.5||b.y+b.height<=a.y+.5,lang+' overlap '+selectors[i]+selectors[j]);}
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));if(violations.length)console.log(JSON.stringify({lang,section,violations}));
   await page.screenshot({path:`mockups/patio-algerois/verification/${section}-${width}-${lang}.png`,fullPage:false});
   assert.deepEqual(violations,[],lang+section);
   await page.locator('#brand-home').focus();await page.keyboard.press('Enter');assert(await page.locator('#view-path').isVisible());assert.equal(await page.evaluate(()=>scrollY),0);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 await browser.close();console.log('Patio : composition, langues cycliques et persistantes, musique, profils, navigation, mobile/RTL et accessibilité validés.');
})().catch(e=>{console.error(e);process.exit(1)});
