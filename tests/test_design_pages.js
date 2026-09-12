const {mountMascotFixture}=require('./mascot_fixture');
/* Visual coverage for the shared Algerian design and four new mascots.
   Only synthetic local profiles; all account API requests blocked. */
const {chromium}=require('playwright');
const {seedSignedIn}=require('./seed_profile');
const fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch();
 const out='/tmp/wilayas/design-pages';fs.mkdirSync(out,{recursive:true});
 const url='file://'+path.resolve(__dirname,'../app/wilaya-v6.html');
 const axe=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
 const results=[];
 for(const [lang,theme,width] of [['fr','dark',415],['ar','dark',360],['fr','light',320]]){
  const page=await browser.newPage({viewport:{width,height:950},colorScheme:theme,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const data={keyDone:true,xp:298,crowns:{u1:5,u2:3},progress:{},photoNon:true};
  await seedSignedIn(page,url,{name:'Test',lang,data});
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  async function capture(name){
   await page.addScriptTag({content:axe});
   const issues=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
   if(issues.length) console.log(name,lang,theme,JSON.stringify(issues));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow');
   await page.screenshot({path:path.join(out,`${name}-${lang}-${theme}.png`),fullPage:false});
   results.push({name,lang,theme,width,issues});
  }
  await capture('parcours');
  for(const tab of ['practice','info']){await page.locator('#tab-'+tab).click();await capture(tab);}
  await page.locator('#profile-btn').click();await capture('profil');
  await page.locator('#prof-avatar').click();await capture('avatars');await page.keyboard.press('Escape');
  await page.locator('#tab-path').click();await page.locator('.noeud').first().click();await page.locator('#sheet-start').click();await capture('lecon');
  assert.deepEqual(errors,[]);await page.close();
 }
 // Every character must keep two nonempty, equally sized image layers.
 const page=await browser.newPage({viewport:{width:415,height:950},reducedMotion:'reduce'});
 for(const [name,crowns] of [['fennec',{}],['cigogne',{u1:1,u2:1}],['palmier',{u1:1,u2:1,u3:1,u4:1}],['chameau',{u1:1,u2:1,u3:1,u4:1,u5:1,u6:1}]]){
  await seedSignedIn(page,url,{name:'Test',lang:'fr',data:{keyDone:true,crowns,photoNon:true}});
  await mountMascotFixture(page);
  const stage=page.locator('#hero-card .mascot-stage');
  assert.equal(await stage.getAttribute('data-mascot'),name);
  await stage.locator('img').evaluateAll(async imgs=>{await Promise.all(imgs.map(i=>i.decode()));});
  const stats=await stage.locator('img').evaluateAll(imgs=>imgs.map(img=>{
   const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
   const cx=c.getContext('2d');cx.drawImage(img,0,0);
   const d=cx.getImageData(0,0,c.width,c.height).data;let visible=0,empty=0;
   for(let i=3;i<d.length;i+=4){if(d[i]>127)visible++;if(d[i]<5)empty++;}
   return {width:c.width,height:c.height,visible:visible/(c.width*c.height),empty:empty/(c.width*c.height)};
  }));
  assert.equal(stats[0].width,stats[1].width);assert.equal(stats[0].height,stats[1].height);
  for(const s of stats){assert(s.visible>.08,name+' missing image');assert(s.empty>.2,name+' background not transparent');}
  await stage.screenshot({path:path.join(out,'mascotte-'+name+'.png')});
 }
 await browser.close();assert.deepEqual(results.filter(r=>r.issues.length),[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(results.length+' écrans et 4 mascottes validés');
})().catch(e=>{console.error(e);process.exit(1)});
