/* Real synthetic profiles; no production connection or migration. */
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs');
const {signedInProfile}=require('./seed_profile');
(async()=>{
 const browser=await chromium.launch();
 const html=fs.readFileSync('app/wilaya-v6.html','utf8').replace('\n})();\n</script>','\nwindow.auditReview=function(i){return buildReviewQueue(UNITS[i]).map(e=>e.code);};\n})();\n</script>');
 fs.mkdirSync('mockups/parcours-faience/verification',{recursive:true});
 for(const [width,lang,size] of [[390,'fr',100],[360,'ar',100],[320,'bi',125]]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:html}):r.fulfill({status:503}));
  const p=signedInProfile({name:'Audit fictif',lang,data:{keyDone:true,crowns:{u1:5,u2:1},photoNon:true,progress:{1:{box:1,due:1,seen:2,ok:1},11:{box:1,due:1,seen:2,ok:1}}}});
  await page.addInitScript(({p,size})=>{localStorage.setItem('wilaya-account-v1',JSON.stringify({profiles:[p],activeId:p.id}));localStorage.setItem('wilaya-preferences-v1',JSON.stringify({size,theme:'dark'}));},{p,size});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://parcours.test/');
  assert.equal(await page.evaluate(()=>document.documentElement.style.fontSize),size+'%');
  assert.equal(await page.locator('.etape-current').getAttribute('data-unite'),'u3');
  assert.equal(await page.locator('.noeud').count(),8);
  for(let i=0;i<8;i++){const box=await page.locator('.noeud').nth(i).boundingBox();assert(box.width>=88&&box.height>=88);}
  assert((await page.locator('.noeud').nth(0).innerText()).includes('0/5'));
  assert.equal(await page.locator('.noeud').nth(1).locator('.niveau-rose.on').count(),1);
  assert.deepEqual(await page.evaluate(()=>window.auditReview(1)),[11]);
  await page.locator('.noeud').nth(2).scrollIntoViewIfNeeded();
  await page.screenshot({path:`mockups/parcours-faience/verification/parcours-${width}-${lang}.png`});
  await page.locator('.noeud').nth(2).click();assert.equal(await page.locator('#lesson-overlay').evaluate(e=>e.classList.contains('active')),false);
  await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('#sheet-box')));
  assert(await page.locator('#view-path').evaluate(e=>e.inert));
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const v=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,why:n.failureSummary}))})));assert.deepEqual(v,[]);
  await page.screenshot({path:`mockups/parcours-faience/verification/fiche-${width}-${lang}.png`});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.dataset.i),'2');
  assert.equal(await page.locator('.noeud').nth(2).getAttribute('aria-expanded'),'false');
  await page.locator('.noeud').nth(3).click();assert.equal(await page.locator('#sheet-start').count(),0);assert.equal(await page.locator('#sheet-previous').count(),1);await page.keyboard.press('Escape');
  await page.locator('.noeud').first().click();assert.equal(await page.locator('.etape-current').getAttribute('data-unite'),'u3');await page.keyboard.press('Escape');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.noeud').nth(1).click();await page.locator('#sheet-start').click();assert(await page.locator('#lesson-overlay').evaluate(e=>e.classList.contains('active')));assert.equal(await page.locator('#view-path').evaluate(e=>e.inert),true);await page.locator('#lesson-close').click();assert.equal(await page.locator('#view-path').evaluate(e=>e.inert),false);assert.equal(await page.evaluate(()=>document.activeElement.dataset.i),'1');
  assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:html}));
 const p=signedInProfile({name:'Complet',lang:'fr',data:{keyDone:true,crowns:Object.fromEntries(Array.from({length:8},(_,i)=>['u'+(i+1),5])),photoNon:true}});
 await page.addInitScript(p=>localStorage.setItem('wilaya-account-v1',JSON.stringify({profiles:[p],activeId:p.id})),p);await page.goto('https://parcours.test/');assert.equal(await page.locator('.etape-current').count(),0);assert.equal(await page.locator('.path-complete').count(),1);assert(await page.locator('#hero-card').innerText().then(t=>t.includes('Tous les niveaux')));
 await browser.close();console.log('Parcours : niveaux, révision ciblée, verrouillage, fin, focus et mobile FR/AR/bilingue validés.');
})().catch(e=>{console.error(e);process.exit(1)});
