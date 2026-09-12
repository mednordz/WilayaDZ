const {chromium}=require('playwright'),{seedSignedIn}=require('./seed_profile');
const assert=require('assert'),path=require('path'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch();
 const url='file://'+path.resolve(__dirname,'../app/wilaya-v6.html');
 const page=await browser.newPage({viewport:{width:415,height:950}});
 const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/rive\.app|unpkg|jsdelivr|\.wasm/.test(r.url()))remote.push(r.url())});
 await page.addInitScript(()=>{
  let namespace;window.riveTests=[];
  Object.defineProperty(window,'rive',{configurable:true,get:()=>namespace,set:v=>{
   const Original=v.Rive;
   const Wrapped=function(opts){
    const entry={states:[],cleaned:false,stops:0};window.riveTests.push(entry);
    const originalState=opts.onStateChange;
    opts.onStateChange=e=>{entry.states.push(...e.data);if(originalState)originalState(e)};
    const instance=new Original(opts);entry.player=instance;
    const cleanup=instance.cleanup.bind(instance),stop=instance.stopRendering.bind(instance);
    instance.cleanup=()=>{entry.cleaned=true;cleanup()};instance.stopRendering=()=>{entry.stops++;stop()};
    return instance;
   }; namespace=new Proxy(v,{get:(target,key)=>key==='Rive'?Wrapped:target[key]});
  }});
 });
 await seedSignedIn(page,url,{lang:'fr',data:{keyDone:true,crowns:{},photoNon:true}});
 const hero=page.locator('#hero-card .mascot-stage');
 await hero.locator('canvas').waitFor();await page.waitForFunction(()=>document.querySelector('#hero-card .rive-ready'));
 const canvas=hero.locator('canvas');
 async function pixels(){return canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));}
 const first=await pixels();assert(first.filter((x,i)=>i%4===3&&x>128).length>1000,'real image rendered');
 await page.waitForTimeout(350);assert.notDeepEqual(await pixels(),first,'idle is animated');
 await hero.dispatchEvent('pointerdown');
 await page.waitForFunction(()=>riveTests.some(r=>r.states.includes('Curious')));
 await page.waitForFunction(()=>riveTests.some(r=>r.states.filter(s=>s==='Idle').length>=2));
 // The real lesson footer markup selects the correct state at mounting.
 for(const [mood,state] of [['happy','Celebrate'],['sad','Encourage']]){
  await hero.evaluate((el,m)=>{
   let f=document.querySelector('#rive-test-footer');if(f)f.remove();
   f=document.createElement('div');f.id='rive-test-footer';f.className='lesson-footer-mascot';
   const clone=el.cloneNode(true);clone.removeAttribute('id');clone.classList.remove('rive-ready');clone.querySelector('canvas').remove();
   clone.querySelector('.mascot-rig').className='mascot-rig mascot mascot-'+m;
   f.style='position:fixed;top:10px;left:10px;z-index:9999';f.appendChild(clone);document.body.appendChild(f);
  },mood);
  await page.waitForFunction(s=>riveTests.some(r=>r.states.includes(s)),state);
 }
 await page.evaluate(()=>document.querySelector('#rive-test-footer').remove());
 await page.waitForTimeout(100);assert(await page.evaluate(()=>riveTests.some(r=>r.cleaned)),'removed instances cleaned');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.mascot-rive-canvas'));
 assert(await hero.locator('.mascot-breathe').isVisible(),'reduced motion preserves artwork');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('#hero-card .rive-ready'));
 await page.locator('#tab-info').click();await page.waitForTimeout(150);
 assert(await page.evaluate(()=>riveTests.some(r=>r.stops>0)),'hidden rendering suspended');
 assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
 await page.close();
 // Deliberate engine failure must leave the accepted image visible, without a retry loop.
 const fallback=await browser.newPage();
 await fallback.addInitScript(()=>{let n;Object.defineProperty(window,'rive',{get:()=>n,set:v=>{n=new Proxy(v,{get:(t,k)=>k==='Rive'?function(){throw Error('test failure')}:t[k]})}})});
 await seedSignedIn(fallback,url,{lang:'fr',data:{keyDone:true,photoNon:true}});
 await fallback.waitForTimeout(200);
 assert.equal(await fallback.locator('.mascot-rive-canvas').count(),0);
 assert(await fallback.locator('#hero-card .mascot-breathe').isVisible());
 await browser.close();console.log('Rive: actual rendering, motion, three reactions, cleanup, reduced motion, hidden pause, offline assets and fallback passed.');
})().catch(e=>{console.error(e);process.exit(1)});
