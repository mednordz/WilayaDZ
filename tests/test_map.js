/* Geometry selection, keyboard, zoom, language and offline integration.
   Synthetic profiles only; no production account or network dependency. */
const {chromium}=require('playwright');
const {seedSignedIn}=require('./seed_profile');
const assert=require('assert'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch();
 const url='file://'+path.resolve(__dirname,'../app/wilaya-v6.html');
 const out=process.env.WILAYA_MAP_SHOTS||'/tmp/wilayas/map';fs.mkdirSync(out,{recursive:true});
 const axe=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
 const remap={59:59,60:69,61:63,62:61,63:60,64:68,65:62,66:67,67:64,68:65,69:66};
 const reports=[];
 try{
  for(const [lang,theme,width] of [['fr','dark',430],['ar','dark',360],['bi','dark',415],['fr','light',320],['ar','light',415],['bi','light',768]]){
   const page=await browser.newPage({viewport:{width,height:1050},colorScheme:theme,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(/^https?:/,r=>r.abort());
   const data={keyDone:true,xp:298,crowns:{u1:5,u2:3},progress:{},photoNon:true};
   await seedSignedIn(page,url,{name:'Amine',lang,data});
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data);
   await page.locator('#tab-info').click();
   assert.equal(await page.locator('#map-regions path').count(),69);
   assert.equal(await page.locator('#map-picker option').count(),69);
   for(const [source,code] of Object.entries(remap))assert.equal(await page.locator('#map-wilaya-'+String(code).padStart(2,'0')).getAttribute('data-source-code'),source);
   await page.locator('#map-landscape').evaluate(img=>img.decode());
   assert(await page.locator('#map-landscape').evaluate(img=>img.src.startsWith('data:image/webp')&&img.naturalWidth===830));
   await page.locator('#map-picker').selectOption('2');
   assert((await page.locator('#map-caption').innerText()).includes('الشلف'));
   await page.locator('#map-picker').selectOption('16');
   assert.equal(await page.locator('#map-wilaya-16').getAttribute('aria-pressed'),'true');
   const full=await page.locator('#map-svg').getAttribute('viewBox');
   assert(await page.locator('#map-regions').evaluate(group=>{
    const b=group.getBBox(),v=group.ownerSVGElement.viewBox.baseVal;
    return b.x>=v.x-1&&b.y>=v.y-1&&b.x+b.width<=v.x+v.width+1&&b.y+b.height<=v.y+v.height+1;
   }),'La vue nationale doit contenir tous les contours, sans découper le Sud.');
   await page.locator('#map-north').click();
   assert.notEqual(await page.locator('#map-svg').getAttribute('viewBox'),full);
   await page.locator('#map-picker').selectOption('11');
   // Choosing a southern wilaya while zoomed north must put it in view.
   assert(await page.locator('#map-wilaya-11').evaluate(el=>{
    const b=el.getBBox(),v=el.ownerSVGElement.viewBox.baseVal;
    return b.x>=v.x&&b.y>=v.y&&b.x+b.width<=v.x+v.width&&b.y+b.height<=v.y+v.height;
   }));
   await page.locator('#map-all').click();
   assert.equal(await page.locator('#map-svg').getAttribute('viewBox'),full);
   await page.locator('#map-wilaya-11').focus();
   await page.keyboard.press('ArrowRight');
   assert.equal(await page.locator('#map-picker').inputValue(),'12');
   await page.keyboard.press('End');assert.equal(await page.locator('#map-picker').inputValue(),'69');
   await page.keyboard.press('Home');assert.equal(await page.locator('#map-picker').inputValue(),'1');
   await page.locator('#map-picker').selectOption('16');
   await page.locator('#map-wilaya-11').click();
   assert.equal(await page.locator('#map-picker').inputValue(),'11');
   assert.equal(await page.locator('#map-regions [tabindex="0"]').count(),1);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data),before);
   await page.addScriptTag({content:axe});
   const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
   assert.deepEqual(violations,[],JSON.stringify({lang,theme,width,violations}));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
   await page.locator('#map-section').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,`${lang}-${theme}-${width}.png`),fullPage:false});
   assert.deepEqual(errors,[]);reports.push({lang,theme,width,violations});await page.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(reports,null,2));
 console.log('Carte : 6 formats/langues/thèmes, 69 tracés, sélection, clavier, zoom, données intactes, zéro violation axe.');
})().catch(e=>{console.error(e);process.exit(1)});
