/* Deux appareils, reset, transfert photo, sauvegarde fichier et PWA hors ligne. */
const {chromium}=require('playwright'),assert=require('assert');
const {seedAccount,signedInProfile}=require('./seed_profile');
const BASE=process.env.BASE||'http://127.0.0.1:8390/';
if(!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(BASE))throw Error('Serveur local obligatoire');
(async()=>{
 const browser=await chromium.launch();
 try{
  let remote={v:1,sv:2,ra:0,p:{'1':[5,20740,100]},x:900,k:1,cr:{u1:5}},version=1;
  const contexts=[],pages=[];
  for(let i=0;i<2;i++){
   const context=await browser.newContext({viewport:{width:415,height:950},reducedMotion:'reduce',acceptDownloads:true});contexts.push(context);
   const page=await context.newPage();pages.push(page);
   await seedAccount(page,BASE,{profiles:[signedInProfile({name:'Audit',lang:'fr',data:{photoNon:true}})],activeId:'pseed1'});
   await page.route('**/api/sync',async route=>{
    const request=route.request();let status=200,body;
    if(request.method()==='GET')body={version,name:'Audit',data:remote};
    else {const sent=request.postDataJSON();if(sent.base_version!==version){status=409;body={version,data:remote,error:'conflict'};}else{remote=sent.data;body={version:++version};}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   });
   await page.reload();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp===900);
   assert((await page.locator('#topstat-xp').innerText()).includes('900'));
  }
  const [a,b]=pages;
  await a.locator('#tab-practice').click();await a.locator('#reset-progress').click();await a.locator('#confirm-ok').click();
  await a.waitForFunction(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp===0);
  await a.waitForTimeout(11000);
  assert(remote.ra>0&&remote.x===0&&Object.keys(remote.p).length===0,'reset pushed to shared account');
  await b.reload();await b.waitForFunction(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp===0);
  await a.reload();await a.waitForFunction(()=>JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.xp===0);
  assert(Object.keys(remote.p).length===0,'second device cannot resurrect progress');
  const photo=await browser.newPage({viewport:{width:415,height:950},reducedMotion:'reduce',acceptDownloads:true});
  const p=signedInProfile({lang:'fr',data:{photoNon:true}});
  await photo.goto(BASE);
  p.avatar={k:'p',v:await photo.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');for(let i=0;i<160;i++)for(let j=0;j<160;j++){x.fillStyle=`rgb(${(i*43+j*17)%256},${(i*3+j*47)%256},${(i*31+j*5)%256})`;x.fillRect(i,j,1,1)}return c.toDataURL('image/jpeg',.7)})};p.avatarAt=Date.now();
  await seedAccount(photo,BASE,{profiles:[p],activeId:p.id});
  await photo.locator('#tab-info').click();assert((await photo.locator('#sync-code').inputValue()).length>20000);
  await photo.locator('#sync-qr-toggle').click();assert.equal(await photo.locator('#sync-qr-box svg').count(),1,'photo does not overflow QR');
  const downloaded=photo.waitForEvent('download');await photo.locator('#sync-save').click();const file=await downloaded;
  const content=require('fs').readFileSync(await file.path(),'utf8');const payload=JSON.parse(Buffer.from(content.split('.')[1],'base64url').toString('utf8'));
  assert.equal(payload.av.v,p.avatar.v,'file contains full photo');
  await photo.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await photo.reload();await photo.evaluate(async()=>{const c=await caches.open('wilaya-shell-v3');if(!await c.match(location.origin+'/'))throw Error('shell missing');});
  await photo.context().setOffline(true);await photo.reload();await photo.locator('#tab-info').click();assert.equal(await photo.locator('#map-regions path').count(),69);
  await photo.locator('#map-landscape').evaluate(img=>img.decode());
  console.log('Deux appareils/reset, QR avec photo, export complet et carte hors ligne : OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
