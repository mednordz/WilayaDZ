/* Regression coverage for internal clipping, bilingual large text and pilot totals.
   Both Chromium and WebKit are required: npx playwright install chromium webkit. */
const {chromium,webkit}=require('playwright'),assert=require('assert'),path=require('path');
const {seedSignedIn}=require('./seed_profile');
(async()=>{for(const engine of [chromium,webkit]){const browser=await engine.launch();
 for(const lang of ['bi','ar','fr']){
  const page=await browser.newPage({viewport:{width:320,height:740},colorScheme:'dark',reducedMotion:'no-preference'});
  const now=Date.now(),rec=(stage,result=1)=>[stage,now-86400000,now+86400000,now,result];
  const learning={1:{d:now,r:0,n:[0,0,0,0,0],c:[0,0,0,0,0]},2:{d:now,r:now,n:[0,0,0,0,0],c:[0,0,0,0,0]},3:{d:now,r:now,n:rec(1),c:rec(1)},4:{d:now,r:now,n:rec(2),c:rec(2)},5:{d:now,r:now,n:rec(2,0),c:rec(2)}};
  await seedSignedIn(page,'file://'+path.resolve('app/wilaya-v6.html'),{lang,data:{keyDone:true,crowns:{u1:1},photoNon:true,xp:900,learning,progress:{11:{box:5,due:now+86400000,seen:8,ok:8}}}});
  await page.evaluate(()=>document.documentElement.style.fontSize='125%');await page.evaluate(()=>document.fonts.ready);
  const hero=await page.locator('#hero-card').evaluate(e=>{const copy=e.querySelector('.hero-corps').getBoundingClientRect(),cta=e.querySelector('.hero-go').getBoundingClientRect();return {separate:copy.bottom<=cta.top,clip:e.querySelector('.hero-corps').scrollWidth>e.querySelector('.hero-corps').clientWidth+1}});
  assert(hero.separate&&!hero.clip,engine.name()+lang+' hero collision');
  await page.locator('#tab-practice').click();
  assert.deepEqual(await page.locator('#forecast-rows .v').allTextContents(),['42','3','1','2']);
  assert.equal(await page.locator('#stat-mastered').textContent(),'2');
  await page.locator('#forecast').scrollIntoViewIfNeeded();
  assert(await page.locator('.forecast-bar').first().evaluate(e=>e.getBoundingClientRect().width>100),'Memory bars must stay legible');
  await page.locator('#tab-path').focus();await page.keyboard.press('End');assert(await page.locator('#view-info').isVisible());assert.equal(await page.locator('#tab-info').getAttribute('tabindex'),'0');
  await page.keyboard.press('Home');assert(await page.locator('#view-path').isVisible());
  await page.locator('.noeud').first().click();
  assert(await page.locator('.pilot-step-label').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),engine.name()+lang+' clipped mastery label');
  await page.keyboard.press('Escape');await page.locator('#settings-btn').click();assert.equal(await page.locator('.tab-btn[tabindex="0"]').count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(lang==='fr'){
    await page.locator('#tab-path').click();await page.locator('#act-free').click();
    await page.locator('#choice-area [data-correct="1"]').click();await page.locator('#skip-btn').click();
    const prompt=await page.locator('#prompt-text').innerHTML();
    // Observe beyond the old 650 ms auto-advance, after an explicit skip.
    await page.waitForTimeout(900);assert.equal(await page.locator('#prompt-text').innerHTML(),prompt,'A stale timer must not skip another question');
    await page.locator('[data-mode="typein"]').click();const score=await page.locator('#stat-session').textContent();
    await page.locator('#typein-input').fill('1a');await page.locator('#typein-submit').click();assert.equal(await page.locator('#stat-session').textContent(),score);assert(await page.locator('#typein-input').isEnabled());
    for(const digits of ['١٦','۱۶']){await page.locator('#skip-btn').click();const before=Number((await page.locator('#stat-session').textContent()).split('/')[1]);await page.locator('#typein-input').fill(digits);await page.locator('#typein-submit').click();assert.equal(Number((await page.locator('#stat-session').textContent()).split('/')[1]),before+1);}
    await page.setViewportSize({width:390,height:360});await page.locator('#skip-btn').click();await page.locator('#typein-input').fill('16');await page.locator('#typein-submit').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const r=document.querySelector('#typein-submit').getBoundingClientRect(),n=document.querySelector('.tabbar').getBoundingClientRect();return r.top>=0&&r.bottom<=n.top;},{},{timeout:3000});
    const control=await page.locator('#typein-submit').evaluate(e=>({button:e.getBoundingClientRect().toJSON(),nav:document.querySelector('.tabbar').getBoundingClientRect().toJSON()}));
    assert(control.button.top>=0&&control.button.bottom<=control.nav.top,engine.name()+' fixed navigation covers validation: '+JSON.stringify(control));


  }
  await page.close();
 }await browser.close();}console.log('Chromium/WebKit : texte 125 %, FR/AR/bilingue, cartes, maîtrise, mémoire pilote et navigation clavier validés.');
})().catch(e=>{console.error(e);process.exit(1)});
