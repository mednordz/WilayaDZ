/* Régressions de données : fonctions de production, transport isolé contrôlé. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../app');
const accountSource=fs.readFileSync(path.join(root,'p4g_account.js'),'utf8');
const cloud=fs.readFileSync(path.join(root,'p4k_cloud.js'),'utf8');
let checks=0;
function check(v,m){assert(v,m);checks++;}
function setup(){
 const queue=[], c=vm.createContext({console,DAY:86400000,state:{},applyLang(){},localStorage:{setItem(){}},cloudScheduleSync(){},cloudOf:p=>p.cloud,setTimeout(fn){queue.push(fn);return 1;},renderAvatar(){},refreshTopStats(){},refreshStats(){},renderPath(){},refreshPracticeCards(){},buildLedger(){},renderSyncPanel(){},session:{alive:false},closeSession(){c.session.alive=false;},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')});
 vm.runInContext(accountSource,c);
 vm.runInContext(cloud.slice(cloud.indexOf('  var syncInFlight'),cloud.indexOf('  /* Poussée discrète')),c);
 vm.runInContext("var p=createProfile('Audit',null,'fr');p.cloud={token:'test'};loadState();",c);
 c.remote={v:1,p:{},x:900,k:1,bb:12,sc:4,sl:'2026-09-12'};
 c.cloudCall=async(method,url,body)=>method==='GET'?{status:200,data:{name:'Audit',version:1,data:structuredClone(c.remote)}}:{status:200,data:{version:2}};
 c.run=s=>vm.runInContext(s,c);c.queue=queue;return c;
}
(async()=>{
 for(const silent of [false,true]){
  const c=setup();c.session.alive=true;const r=await c.run(`cloudSync(p,{silent:${silent}})`);
  check(r.ok&&r.changed,'scalar-only update reported');check(c.state.xp===900&&c.state.keyDone&&c.state.bestBlitz===12,'active scalars hydrated');
  c.run('persist()');check(c.run('p.data.xp')===900,'persist preserves merged XP');check(c.session.alive,'normal sync does not close lesson');
 }
 const c=setup();c.remote={v:1,sv:2,p:{'1':[5,20740,100]},x:900,k:1,cr:{u1:5}};
 await c.run('cloudSync(p)');c.run('resetProgress()');await c.run('cloudSync(p,{silent:true})');
 check(c.run('p.data.xp')===0&&Object.keys(c.state.progress).length===0,'old cloud cannot resurrect reset');
 const reset=c.run('p.data.resetAt');c.remote={v:1,sv:2,ra:reset+1,p:{}};c.session.alive=true;
 await c.run('cloudSync(p)');check(!c.session.alive&&c.state.resetAt===reset+1,'remote reset closes obsolete lesson');
 const down=setup();down.run('state.progress[1]={box:3,due:100,updatedAt:200};persist()');down.remote={v:1,sv:2,p:{'1':[5,20740,100]}};
 await down.run('cloudSync(p,{silent:true})');check(down.state.progress[1].box===3,'older best cannot undo recent error');
 down.remote.p['1']=[1,2,300];await down.run('cloudSync(p)');check(down.state.progress[1].box===1,'remote recent error applied');
 const tie=setup();tie.run('state.progress[1]={box:5,due:100,updatedAt:200};persist()');tie.remote={v:1,sv:2,p:{'1':[3,2,200]}};
 await tie.run('cloudSync(p)');check(tie.state.progress[1].box===3,'equal timestamp conservatively keeps error');
 const race=setup();let resolveGet;race.cloudCall=(method,url,body)=>method==='GET'?new Promise(r=>resolveGet=r):Promise.resolve({status:200,data:{version:2}});
 const pending=race.run('cloudSync(p)');race.run('state.xp=50;state.progress[2]={box:1,due:10,updatedAt:200};persist()');resolveGet({status:200,data:{name:'Audit',version:1,data:{v:1,p:{'1':[1,1]},x:25}}});
 await pending;check(race.state.xp===50&&race.state.progress[1]&&race.state.progress[2],'answers during GET survive');
 const conflict=setup();let puts=0;conflict.cloudCall=async(method)=>method==='GET'?{status:200,data:{version:1,data:{v:1,p:{},x:10}}}:++puts===1?{status:409,data:{version:2,data:{v:1,p:{'2':[1,1]},x:20}}}:{status:200,data:{version:3}};
 const cr=await conflict.run('cloudSync(p)');check(cr.ok&&puts===2&&conflict.state.xp===20&&conflict.state.progress[2],'409 merges without stale state');
 const putRace=setup();let resolvePut;putRace.cloudCall=(method)=>method==='GET'?Promise.resolve({status:200,data:{version:1,data:{v:1,p:{},x:0}}}):new Promise(r=>resolvePut=r);
 const sending=putRace.run('cloudSync(p)');await Promise.resolve();await Promise.resolve();putRace.run('state.xp=15;persist()');resolvePut({status:200,data:{version:2}});await sending;check(putRace.queue.length===1,'answer during PUT queues another sync');
 const bad=setup();for(const payload of [JSON.parse('{"v":1,"p":{"__proto__":[5,2]}}'),{v:1,p:{1:null}},{v:1,p:{70:[1,2]}},{v:1,p:{1:[6,2]}},{v:1,p:{},av:{k:'p',v:'https://bad.test/photo'}}]){
  bad.payload=payload;check(bad.run('mergeInto(p,payload).error')==='bad_payload','reject malformed import');
 }
 check(bad.run('({}).box')===undefined,'no prototype pollution');
 bad.remote={v:1,p:{1:null}};check(!(await bad.run('cloudSync(p)')).ok&&!bad.run('syncInFlight'),'bad cloud unlocks future sync');
 bad.remote={v:1,p:{},x:4};check((await bad.run('cloudSync(p)')).ok,'sync recovers after rejection');
 bad.run("p.avatar={k:'p',v:'data:image/jpeg;base64,AAAA'};p.avatarAt=1");
 check(bad.run('!parseCode(exportCode(p,true)).obj.av'),'compact transfer excludes photo');check(bad.run('parseCode(exportCode(p)).obj.av.v')==='data:image/jpeg;base64,AAAA','full export retains photo');
 bad.run('mergeInto(p,{v:1,p:{},av:null,avt:2})');check(bad.run('p.avatar')===null,'avatar deletion propagates');
 const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'payload_cases.json'),'utf8'));
 for(const t of cases){bad.payload=t.payload;assert.equal(bad.run('validPayload(payload)'),t.valid,t.name);checks++;}
 const storage=setup();storage.localStorage.setItem=()=>{throw Error('quota');};check(storage.run('saveAccount()')===false,'storage failure reported');storage.localStorage.setItem=()=>{};check(storage.run('saveAccount()')===true,'storage recovery');
 console.log(`${checks} régressions de synchronisation et validation : OK`);
})().catch(e=>{console.error(e);process.exitCode=1;});
