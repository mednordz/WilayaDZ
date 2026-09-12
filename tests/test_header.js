/* Header interaction and responsive coverage, synthetic accounts and isolated transport. */
const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
const {signedInProfile}=require('./seed_profile');
(async()=>{
 const browser=await chromium.launch();const html=fs.readFileSync('app/wilaya-v6.html','utf8');
 fs.mkdirSync('mockups/bandeau',{recursive:true});
 for(const [lang,width,theme,size] of [['fr',500,'dark',100],['ar',360,'light',100],['bi',320,'dark',125]]){
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  const name=lang==='ar'?'نور الدين الجزائري':'Mednor-Voyageur-Algérien';
  const p=signedInProfile({name,lang,data:{keyDone:true,xp:900,photoNon:true}});
  await page.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:html}):r.fulfill({status:503}));
  await page.addInitScript(({p,size,theme})=>{
   localStorage.setItem('wilaya-account-v1',JSON.stringify({profiles:[p],activeId:p.id}));
   localStorage.setItem('wilaya-preferences-v1',JSON.stringify({size,theme,effects:false}));
   localStorage.setItem('wilaya-sound-v1','0');
   HTMLMediaElement.prototype.play=function(){return Promise.resolve()};
   HTMLMediaElement.prototype.pause=function(){};
  },{p,size,theme});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://header.test/');
  assert.equal(await page.locator('#profile-caption').innerText(),name);
  assert.equal(await page.locator('#sound-btn').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('audio').count(),0);
  await page.locator('#sound-btn').click();
  assert.equal(await page.locator('#sound-btn').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('wilaya-sound-v1')),'0','music must not change effects mute');
  await page.locator('#settings-btn').click();await page.locator('[data-settings="audio"]').click();
  assert.equal(await page.locator('[data-switch="music"]').getAttribute('aria-checked'),'true');
  await page.locator('#sound-btn').click();assert.equal(await page.locator('[data-switch="music"]').getAttribute('aria-checked'),'false');
  await page.locator('[data-switch="music"]').click();assert.equal(await page.locator('#sound-btn').getAttribute('aria-pressed'),'true');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for(const section of ['settings','info','practice','path']){
   if(section!=='settings')await page.locator('#tab-'+section).click();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),lang+' overflow');
   const boxes=await Promise.all(['#brand-home','#topstat-streak','#topstat-xp','#sound-btn','#profile-btn','#settings-btn'].map(s=>page.locator(s).boundingBox()));
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];assert(a.x+a.width<=b.x+.5||b.x+b.width<=a.x+.5||a.y+a.height<=b.y+.5||b.y+b.height<=a.y+.5,lang+' overlapping controls '+i+' '+j);
   }
   const violations=await page.evaluate(async()=>(await axe.run('.topbar',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id));assert.deepEqual(violations,[]);
   await page.screenshot({path:`mockups/bandeau/${section}-${lang}.png`,fullPage:false});
   await page.locator('#brand-home').focus();await page.keyboard.press('Enter');
   assert(await page.locator('#view-path').isVisible());assert.equal(await page.evaluate(()=>scrollY),0);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 await browser.close();console.log('Bandeau : retour accueil, pseudo long, musique indépendante, synchronisation réglages, mobile et clavier validés.');
})().catch(e=>{console.error(e);process.exit(1)});
