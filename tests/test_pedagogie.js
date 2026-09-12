/* Horloge et profils fictifs. Aucune requête vers l'application de production. */
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {chromium}=require('playwright');
const {signedInProfile}=require('./seed_profile');
const DAY=86400000;
let now=1700000000000;
const core=fs.readFileSync('app/p4a_core.js','utf8');
const ctx={state:{progress:{},confusions:{}},Date:{now:()=>now},INTERVALS:[600000,DAY,3*DAY,7*DAY,16*DAY,35*DAY],byCode:c=>Number.isInteger(c)&&c>=1&&c<=69?{c}:null};
vm.createContext(ctx);
vm.runInContext(core.slice(core.indexOf('  function rec(code)'),core.indexOf('  function poolForTier')),ctx);
const answer=(code,ok,extra={})=>ctx.recordAnswer(code,ok,12000,ok?null:2,5000,{kind:'type',...extra});
answer(1,true);assert.equal(ctx.state.progress[1].box,1,'Bonne réponse lente reconnue');
const firstDue=ctx.state.progress[1].due;
for(let i=0;i<20;i++)answer(1,true);
assert.equal(ctx.state.progress[1].box,1,'Pas de promotions immédiates répétées');
assert.equal(ctx.state.progress[1].due,firstDue,'Entraînement anticipé sans report');
now=firstDue;answer(1,true);assert.equal(ctx.state.progress[1].box,2);
now=ctx.state.progress[1].due;answer(1,true);assert.equal(ctx.state.progress[1].box,3);
answer(1,false);assert.equal(ctx.state.progress[1].box,2);assert.equal(ctx.state.progress[1].due,now+600000);
const failedDue=ctx.state.progress[1].due;
now+=700000;answer(1,true,{relearning:true});assert.equal(ctx.state.progress[1].box,2,'Une correction récente ne certifie pas le rappel différé');assert.equal(ctx.state.progress[1].due,failedDue);
answer(3,true,{kind:'mcq'});now=ctx.state.progress[3].due;answer(3,true,{kind:'mcq'});now=ctx.state.progress[3].due;answer(3,true,{kind:'mcq'});assert.equal(ctx.state.progress[3].box,2,'QCM plafonné avant les intervalles longs');
ctx.recordAnswer(3,false,1000,-1,5000,{kind:'mcq'});assert(!ctx.state.confusions[3]);
answer(4,true,{noRecord:true});assert(!ctx.state.progress[4]);
console.log('Ordonnanceur : espacement, lenteur, reprise, QCM et identifiants validés.');

(async()=>{
 const browser=await chromium.launch();
 try{
 const injection=`
 window.pedagogy={
   begin:function(){startLesson(UNITS[0]);},
   inspect:function(){return {kind:session.current.kind,code:session.current.code,relearning:!!session.current.relearning,index:session.index,total:session.queue.length,unresolved:Object.keys(session.unresolved),crowns:state.crowns,progress:state.progress,done:session.done};},
   queue:function(i){return buildLessonQueue(UNITS[i]).filter(function(e){return e.kind === "adaptive";}).map(function(e){return e.code;});},
   blitz:function(){startBlitz();},
   typed:function(){startSession({kind:"review",queue:[exType(16)]});},
   close:function(){closeSession();}
 };
 `;
 const html=fs.readFileSync('app/wilaya-v6.html','utf8').replace('\n})();\n</script>',injection+'\n})();\n</script>');
 assert(html.includes('window.pedagogy='));
 for(const [width,lang,theme] of [[390,'fr','light'],[360,'ar','dark'],[320,'bi','light']]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).pathname==='/'?r.fulfill({contentType:'text/html',body:html}):r.fulfill({status:503}));
  const profile=signedInProfile({name:'Pédagogie fictive',lang,data:{keyDone:true,photoNon:true}});
  await page.addInitScript(({profile,theme})=>{localStorage.setItem('wilaya-account-v1',JSON.stringify({profiles:[profile],activeId:profile.id}));localStorage.setItem('wilaya-preferences-v1',JSON.stringify({theme}));},{profile,theme});
  await page.goto('https://pedagogie.test/');
  for(let u=0;u<8;u++){
   const codes=await page.evaluate(i=>pedagogy.queue(i),u);
   assert.equal(new Set(codes).size,codes.length,'Couverture sans doublon');
   assert.equal(codes.length,[10,8,7,6,9,8,10,11][u]);
  }
  await page.evaluate(()=>pedagogy.begin());
  assert.equal(await page.locator('#lesson-hearts').isVisible(),false);
  const first=await page.evaluate(()=>pedagogy.inspect());
  await page.locator('.lesson-choice[data-correct="0"]').first().click();
  assert.equal((await page.evaluate(()=>pedagogy.inspect())).total,12,'Une reprise ajoutée');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  assert.deepEqual(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))),[]);
  await page.screenshot({path:'/tmp/wilayadz-pedagogie-'+lang+'.png'});
  for(let step=0;step<20;step++){
   await page.locator('#lesson-continue-btn').click();
   if(await page.locator('#result-heading').count())break;
   const current=await page.evaluate(()=>pedagogy.inspect());
   if(current.relearning){assert.equal(current.code,first.code);assert.equal(current.index,3,'Deux questions intercalées');}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(await page.locator('#chain-bank').count()){
    const codes=await page.locator('.chain-chip').evaluateAll(els=>els.map(e=>Number(e.dataset.code)).sort((a,b)=>a-b));
    for(const code of codes)await page.locator('.chain-chip[data-code="'+code+'"]').click();
   }else await page.locator('.lesson-choice[data-correct="1"]').click();
  }
  let result=await page.evaluate(()=>pedagogy.inspect());assert(result.done);assert.equal(result.crowns.u1,1);assert.equal(Object.keys(result.progress).length,10);
  assert.equal(result.progress[first.code].box,0,'La reprise ne remplace pas une preuve différée');
  await page.evaluate(()=>pedagogy.close());
  // Six erreurs ne ferment plus la séance ; la file reste bornée et le niveau reste inchangé.
  await page.evaluate(()=>pedagogy.begin());
  for(let step=0;step<25;step++){
   if(await page.locator('#chain-bank').count()){
    const codes=await page.locator('.chain-chip').evaluateAll(els=>els.map(e=>Number(e.dataset.code)).sort((a,b)=>b-a));
    for(const code of codes)await page.locator('.chain-chip[data-code="'+code+'"]').click();
   }else await page.locator('#lesson-help').click();
   await page.locator('#lesson-continue-btn').click();
   result=await page.evaluate(()=>pedagogy.inspect());
   if(step===5)assert(!result.done,'Pas de blocage après cinq erreurs');
   if(result.done)break;
  }
  assert(result.done);assert(result.total<=17);assert.equal(result.crowns.u1,1,'Pas de niveau gagné avec des difficultés non résolues');
  await page.evaluate(()=>pedagogy.close());
  const before=JSON.stringify(result.progress);
  await page.evaluate(()=>pedagogy.blitz());await page.locator('.lesson-choice[data-correct="1"]').click();
  assert.equal(JSON.stringify((await page.evaluate(()=>pedagogy.inspect())).progress),before,'Rafale isolée de la mémoire');
  await page.evaluate(()=>pedagogy.close());
  await page.evaluate(()=>pedagogy.typed());
  await page.locator('#lesson-type-input').fill('1x');await page.locator('#lesson-type-submit').click();
  assert.equal(await page.locator('#lesson-footer').count(),0,'Une saisie partiellement numérique ne doit pas être acceptée');
  await page.locator('#lesson-type-input').fill('١٦');await page.locator('#lesson-type-submit').click();
  assert.equal((await page.evaluate(()=>pedagogy.inspect())).progress[16].box,1,'Chiffres arabes reconnus');
  await page.evaluate(()=>pedagogy.close());assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('Séances : couverture, reprises, limites, niveaux et rafale validés sur mobile FR/AR/bilingue, thèmes clair/sombre.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
