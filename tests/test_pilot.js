const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {chromium}=require('playwright');
const {signedInProfile}=require('./seed_profile');
const DAY=86400000;
let now=1700000000000;
const c={state:{learning:{}},Date:{now:()=>now},DAY,UNITS:[{pool:Array.from({length:10},(_,i)=>({c:i+1}))}]};
vm.createContext(c);vm.runInContext(fs.readFileSync('app/pilot.js','utf8'),c);
c.pilotRecord({code:1,pilotSkill:'n'},true);
assert.equal(c.state.learning[1].n[0],1);assert.equal(c.state.learning[1].c[0],0,'Chaque direction est indépendante');
for(let i=0;i<8;i++)c.pilotRecord({code:1,pilotSkill:'n'},true);
assert.equal(c.state.learning[1].n[0],1,'Pas de confirmation immédiate');
now+=DAY;c.pilotRecord({code:1,pilotSkill:'n',relearning:true},true);assert.equal(c.state.learning[1].n[0],1);
c.pilotRecord({code:1,pilotSkill:'n'},true);assert.equal(c.state.learning[1].n[0],2);
c.pilotRecord({code:1,pilotSkill:'n'},false);assert.equal(c.state.learning[1].n[0],2,'Étape atteinte conservée');assert.equal(c.state.learning[1].n[4],0);assert.equal(c.pilotDue(),1);
c.T=c.TL=s=>s;c.pad=n=>String(n).padStart(2,'0');c.ARABIC={};c.byCode=code=>({c:code,n:'Wilaya '+code});
let planned;c.startSession=cfg=>{planned=cfg;};
c.state.learning={};
for(let code=1;code<=3;code++)c.state.learning[code]={d:now,r:now,n:[0,0,now+600000,now,0],c:[1,now,now+DAY,now,1]};
c.startPilot();
assert.deepEqual(Array.from(new Set(planned.queue.filter(s=>s.kind==='pilot-step').map(s=>s.code))),[4,5,6],'Les reprises en pause ne bloquent pas les nouvelles wilayas');
console.log('Pilote : directions, espacement, nouvelles découvertes et entretien indépendant validés.');
(async()=>{
 const browser=await chromium.launch();
 try{
 const hooks=`window.pilotAudit={start:function(){startLesson(UNITS[0]);},close:closeSession,
 read:function(){return {spec:session.current,done:session.done,learning:state.learning,level:pilotLevel(),due:pilotDue(),crowns:state.crowns,queue:(session.queue||[]).length};},
 answerName:function(c){return byCode(c).n;},summary:pilotSummary,review:function(){return buildReviewQueue().map(function(s){return [s.code,s.pilotSkill];});},
 pack:function(){return packProfile(activeProfile());},merge:function(o){var p=activeProfile();mergeInto(p,o);applyProgressState(p.data);persist(true);},
 jump:function(ms){window.pilotNow+=ms;},set:function(o){state.learning=o;persist(true);}};`;
 const html=fs.readFileSync('app/wilaya-v6.html','utf8').replace('\n})();\n</script>',hooks+'\n})();\n</script>');
 for(const [lang,width,theme] of [['fr',390,'light'],['ar',360,'dark'],['bi',320,'light']]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:html}):r.fulfill({status:503}));
  const p=signedInProfile({name:'Pilote fictif',lang,data:{keyDone:true,crowns:{u1:5},photoNon:true}});
  await page.addInitScript(({p,theme})=>{if(!localStorage.getItem('wilaya-account-v1'))localStorage.setItem('wilaya-account-v1',JSON.stringify({profiles:[p],activeId:p.id}));localStorage.setItem('wilaya-preferences-v1',JSON.stringify({theme}));window.pilotNow=1700000000000;Date.now=()=>window.pilotNow;},{p,theme});
  await page.goto('https://pilot.test/');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  let firstCapture=true;
  async function complete(){
   for(let i=0;i<30;i++){
    const status=await page.evaluate(()=>pilotAudit.read());if(status.done){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));return;}
    const spec=status.spec;
    if(spec.kind==='tell'){
     assert(await page.locator('.pilot-tile').count()<=3);
     if(firstCapture){
      assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))),[]);
      await page.screenshot({path:'/tmp/pilot-discovery-'+lang+'.png'});firstCapture=false;}
     await page.locator('#tell-next').click();continue;
    }
    if(spec.kind==='mcq')await page.locator('.lesson-choice[data-correct="1"]').click();
    else{
     let value=spec.answerMode==='name'?await page.evaluate(c=>pilotAudit.answerName(c),spec.code):String(spec.code);
     // L'arabe est autorisé même si l'interface française est choisie ; les accents sont facultatifs.
     if(spec.answerMode==='name')value=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
     await page.locator('#lesson-type-input').fill(value);await page.locator('#lesson-type-submit').click();
    }
    await page.locator('#lesson-continue-btn').click();
   }
   throw new Error('Séance non bornée');
  }
  for(let group=0;group<4;group++){await page.evaluate(()=>pilotAudit.start());await complete();await page.evaluate(()=>pilotAudit.close());}
  let state=await page.evaluate(()=>pilotAudit.read());
  assert.equal(Object.keys(state.learning).length,10);assert.equal(state.level,4,'La confirmation attend un autre jour');assert.equal(state.crowns.u1,5,'Anciens niveaux conservés');
  await page.locator('.noeud').first().click();assert.equal(await page.locator('#sheet-box .pilot-summary li').count(),5);
  const startBox=await page.locator('#sheet-start').boundingBox();assert(startBox.y+startBox.height<950,'Action accessible avant de faire défiler les étapes');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const issues=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  assert.deepEqual(issues,[]);await page.screenshot({path:'/tmp/pilot-progress-'+lang+'.png'});await page.keyboard.press('Escape');
  // Le prochain appui annonce l'attente et propose un entraînement anticipé explicite.
  await page.evaluate(()=>pilotAudit.start());assert.equal(await page.locator('#pilot-practice').count(),1);await page.locator('#pilot-practice').click();await complete();await page.evaluate(()=>pilotAudit.close());assert.equal((await page.evaluate(()=>pilotAudit.read())).level,4);
  await page.evaluate(ms=>pilotAudit.jump(ms),DAY+1);
  assert.equal((await page.evaluate(()=>pilotAudit.review())).length,15,'Les rappels du pilote rejoignent la révision du jour, avec une limite');
  for(let group=0;group<4;group++){await page.evaluate(()=>pilotAudit.start());await complete();await page.evaluate(()=>pilotAudit.close());}
  state=await page.evaluate(()=>pilotAudit.read());assert.equal(state.level,5);
  const saved=await page.evaluate(()=>pilotAudit.pack());assert.equal(saved.sv,3);assert.equal(saved.lr[1].n[0],2);
  await page.reload();assert.equal((await page.evaluate(()=>pilotAudit.read())).level,5,'Persistance après rechargement');
  // Export/import idempotent, ancienne sauvegarde et directions concurrentes.
  await page.evaluate(o=>pilotAudit.merge(o),saved);await page.evaluate(o=>pilotAudit.merge(o),saved);
  assert.deepEqual((await page.evaluate(()=>pilotAudit.pack())).lr,saved.lr);
  await page.evaluate(()=>pilotAudit.merge({v:1,p:{},cr:{u1:5}}));assert.equal((await page.evaluate(()=>pilotAudit.read())).level,5);
  assert.deepEqual(errors,[]);await page.close();
 }
 }finally{await browser.close();}
 console.log('Unité pilote complète : quatre groupes, deux directions, lendemain, persistance, import et mobile FR/AR/bilingue validés.');
})().catch(e=>{console.error(e);process.exit(1);});
