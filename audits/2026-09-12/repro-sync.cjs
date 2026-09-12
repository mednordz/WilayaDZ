const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'../../app')+'/';
const account=fs.readFileSync(root+'p4g_account.js','utf8');
const cloud=fs.readFileSync(root+'p4k_cloud.js','utf8');
function setup(){
 const c=vm.createContext({console,DAY:86400000,state:{},applyLang(){},localStorage:{setItem(){}},cloudScheduleSync(){},cloudOf:p=>p.cloud,renderAvatar(){}});
 vm.runInContext(account,c);
 vm.runInContext(cloud.slice(cloud.indexOf('  var syncInFlight'),cloud.indexOf('  function cloudScheduleSync')),c);
 vm.runInContext(`var p=createProfile('Audit',null,'fr'); p.cloud={token:'synthetic'}; loadState(); function bootProfile(){loadState();}`,c);
 c.remote={v:1,n:'Audit',p:{},x:900,k:1,bb:12,sc:4,sl:'2026-09-12'};
 c.cloudCall=async(method,path,body)=> method==='GET'?{status:200,data:{name:'Audit',version:1,data:structuredClone(c.remote)}}:{status:200,data:{version:2}};
 return c;
}
(async()=>{
 for(const silent of [false,true]){
  const c=setup();const r=await vm.runInContext(`cloudSync(p,{silent:${silent}})`,c);
  const before=vm.runInContext('({profileXP:p.data.xp,screenXP:state.xp,key:state.keyDone})',c);
  vm.runInContext('persist()',c);
  const after=vm.runInContext('p.data.xp',c);
  assert.equal(before.profileXP,900);assert.equal(before.screenXP,0);assert.equal(after,0);
  console.log('SCALAR_SYNC',JSON.stringify({silent,result:r,before,afterPersistXP:after}));
 }
 const reset=setup();reset.remote={v:1,p:{'1':[5,20740]},x:900,k:1,cr:{u1:5}};
 await vm.runInContext('cloudSync(p)',reset);vm.runInContext('state.progress={};state.crowns={};state.confusions={};state.xp=0;state.keyDone=false;state.streak={count:0,last:null};state.bestBlitz=0;persist()',reset);
 await vm.runInContext('cloudSync(p,{silent:true})',reset);
 const restored=vm.runInContext('({xp:p.data.xp,crown:p.data.crowns.u1,box:p.data.progress[1].box})',reset);
 assert.equal(restored.crown,5);console.log('RESET_RESURRECTION',JSON.stringify(restored));
 const down=setup();vm.runInContext('state.progress[1]={box:3,due:0};persist()',down);down.remote={v:1,p:{'1':[5,20740]}};
 await vm.runInContext('cloudSync(p,{silent:true})',down);assert.equal(down.state.progress[1].box,5);console.log('ERROR_DOWNGRADE_UNDONE',JSON.stringify(down.state.progress[1]));
 const bad=setup();let caught;try{vm.runInContext(`mergeInto(p,JSON.parse('{"v":1,"p":{"1":null}}'))`,bad)}catch(e){caught=e.message};assert(caught);console.log('INVALID_IMPORT_CRASH',caught);
 const proto=setup();vm.runInContext(`mergeInto(p,JSON.parse('{"v":1,"p":{"__proto__":[5,20740]}}'))`,proto);
 const polluted=vm.runInContext('({}).box',proto);assert.equal(polluted,5);console.log('IMPORT_PROTOTYPE_POLLUTION',polluted);
})();
