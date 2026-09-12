/* Unité pilote : preuves compactes, indépendantes par sens de rappel.
   d/r = date de découverte/reconnaissance ; n/c = [étape atteinte, preuve, échéance, mise à jour, dernier résultat].
   Aucun ancien score n'est converti en preuve. */
function pilotRec(code){
  state.learning = state.learning || {};
  return state.learning[code] || (state.learning[code]={d:0,r:0,n:[0,0,0,0,0],c:[0,0,0,0,0]});
}
function pilotLevel(){
  var codes=UNITS[0].pool.map(function(w){return w.c;});
  function every(fn){return codes.every(function(c){var p=(state.learning||{})[c];return p && fn(p);});}
  if(!every(function(p){return p.d;}))return 0;
  if(!every(function(p){return p.r;}))return 1;
  if(!every(function(p){return p.n[0]>=1;}))return 2;
  if(!every(function(p){return p.c[0]>=1;}))return 3;
  if(!every(function(p){return p.n[0]>=2&&p.c[0]>=2;}))return 4;
  return 5;
}
function pilotDue(){
  return UNITS[0].pool.filter(function(w){var p=(state.learning||{})[w.c];return p && ['n','c'].some(function(k){return p[k][3]>0&&(p[k][2]<=Date.now()||p[k][4]===0);});}).length;
}
function pilotRecord(spec,correct){
  var p=pilotRec(spec.code), now=Date.now(), k=spec.pilotSkill;
  if(k==='r'){if(correct)p.r=Math.max(p.r,now);return;}
  var rec=p[k];
  rec[3]=Math.max(now,rec[3]+1);rec[4]=correct?1:0;
  if(!correct){rec[2]=now+10*60*1000;return;}
  if(spec.relearning || (rec[2] && rec[2]>now))return;
  if(rec[0] && now-rec[1]<DAY)return;
  rec[0]=Math.min(3,rec[0]+1);rec[1]=now;rec[2]=now+[0,DAY,3*DAY,7*DAY][rec[0]];
}
function pilotNameKey(s){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670ـ]/g,'')
    .replace(/[أإآ]/g,'ا').toLowerCase().replace(/[\s'’\-]/g,'');
}
function pilotMatchesName(code,value){
  var w=byCode(code);
  return [w.n,ARABIC[code]].some(function(n){return n&&pilotNameKey(n)===pilotNameKey(value);});
}
function pilotExercise(code,skill){
  var spec;
  if(skill==='r')spec=exCode2Name(code,4,UNITS[0].pool);
  else if(skill==='n')spec=exType(code);
  else spec={kind:'type',code:code,answerMode:'name',label:'Écris le nom de la wilaya',labelAr:'اكتب اسم الولاية',
    promptHtml:"<span class='code'>"+pad(code)+"</span>",answerText:wnameL(byCode(code))};
  spec.pilotSkill=skill;spec.noRecord=true;
  return spec;
}
function pilotStep(code,skill,relearning){return {kind:'pilot-step',code:code,pilotSkill:skill,relearning:!!relearning};}
function pilotStudy(codes){
  return {kind:'tell',html:"<h2 class='pilot-heading'>"+T('Tes repères à découvrir','معالم للاكتشاف')+"</h2><p>"+T('Observe chaque nom et son code. Tu les retrouveras ensuite sans cette fiche.','تأمّل كل اسم ورمزه. ستسترجعهما بعد ذلك دون هذه البطاقة.')+"</p><div class='pilot-study'>"+
    codes.map(function(c){var w=byCode(c);return "<article class='pilot-tile'><bdi>"+pad(c)+"</bdi><strong>"+T(w.n,ARABIC[c],'bi-keep')+"</strong></article>";}).join('')+"</div>",
    cta:T('Passer aux exercices','انتقل إلى التمارين'),onContinue:function(){codes.forEach(function(c){pilotRec(c).d=Math.max(pilotRec(c).d,Date.now());});persist();}};
}
function startPilot(trigger,practice){
  var codes=UNITS[0].pool.map(function(w){return w.c;}), now=Date.now();
  var pending=codes.filter(function(c){var p=(state.learning||{})[c];return !p||!p.d||!p.r||!p.n[0]||!p.c[0];});
  // Les reprises encore en pause ne doivent pas bloquer les nouvelles découvertes.
  var selected=pending.filter(function(c){
    var p=(state.learning||{})[c];
    return !p||!p.d||!p.r||['n','c'].some(function(k){return !p[k][0]&&p[k][2]<=now;});
  }).slice(0,3), queue=[];
  if(!selected.length){
    selected=codes.filter(function(c){var p=state.learning[c];return ['n','c'].some(function(k){return p[k][2]<=now;});}).slice(0,3);
  }
  if(!selected.length && practice)selected=shuffle(codes.slice()).slice(0,3);
  if(!selected.length){
    openSheet("<button class='sheet-dismiss' id='pilot-close' aria-label='"+TL('Fermer','إغلاق')+"'>×</button><h2 id='sheet-title'>"+T('Tes prochains rappels','مراجعاتك القادمة')+"</h2><p>"+(pending.length ? T('Certaines associations ont besoin d’une pause avant une nouvelle vérification. Tu peux t’entraîner sans avancer les étapes différées.','تحتاج بعض الروابط إلى فترة راحة قبل التحقق مجددا. يمكنك التدرّب دون تقديم المراحل المتباعدة.') : pilotLevel()>=5 ? T('Les deux sens de rappel ont été confirmés. Les prochains rappels entretiendront tes acquis. Tu peux continuer le parcours.','تم تأكيد الاسترجاع في الاتجاهين. ستحافظ المراجعات القادمة على مكتسباتك. يمكنك متابعة المسار.') : T('Les premières associations sont acquises. La confirmation se fera lors des prochains rappels espacés. Tu peux continuer le parcours ou t’entraîner sans avancer ces échéances.','اكتسبت الروابط الأولى. سيتم التأكيد خلال المراجعات المتباعدة القادمة. يمكنك متابعة المسار أو التدرّب دون تقديم مواعيد المراجعة.'))+"</p><button class='btn' id='pilot-practice'>"+T('M’entraîner maintenant','أتدرّب الآن')+"</button>");
    document.getElementById('pilot-close').onclick=closeSheet;
    document.getElementById('pilot-practice').onclick=function(){closeSheet();startPilot(trigger,true);};return;
  }
  var fresh=selected.filter(function(c){return !((state.learning||{})[c]||{}).d;});
  if(fresh.length)queue.push(pilotStudy(fresh));
  selected.forEach(function(c){var p=pilotRec(c);if(!p.r)queue.push(pilotStep(c,'r'));});
  ['n','c'].forEach(function(k){selected.forEach(function(c){var p=pilotRec(c);if(p[k][2]<=now||practice)queue.push(pilotStep(c,k));});});
  // Une fiche restée ouverte peut être reprise après synchronisation ; aucun groupe vide.
  if(!queue.length){startPilot(trigger,true);return;}
  startSession({kind:'pilot',unit:UNITS[0],queue:queue,trigger:trigger,label:TL('Unité 1 · atelier de mémoire','الوحدة 1 · ورشة الذاكرة')});
}
function pilotSummary(){
  var labels=[['Découvrir','اكتشاف'],['Reconnaître','تعرّف'],['Retrouver le code','استرجاع الرمز'],['Retrouver le nom','استرجاع الاسم'],['Confirmer plus tard','تأكيد لاحق']],level=pilotLevel();
  return "<div class='pilot-summary'><p>"+T('Ton atelier · '+level+'/5 étapes','ورشتك · '+level+'/5 مراحل')+"</p><ol>"+labels.map(function(l,i){
    var count=UNITS[0].pool.filter(function(w){var p=(state.learning||{})[w.c];return p&&(i===0?p.d:i===1?p.r:i===2?p.n[0]>=1:i===3?p.c[0]>=1:p.n[0]>=2&&p.c[0]>=2);}).length;
    return "<li><span class='pilot-step-label'>"+T(l[0],l[1])+"</span><bdi>"+count+"/10</bdi></li>";
  }).join('')+"</ol><p>"+T('Les étapes acquises restent conservées. Les révisions entretiennent tes acquis.','المراحل المكتسبة تبقى محفوظة. المراجعات تحافظ على مكتسباتك.')+"</p></div>";
}

function reviewWilayaCount(){
  var pool=poolForTier(state.tier), now=Date.now();
  return pool.filter(function(w){
    var p=(state.learning||{})[w.c];
    return p ? ['n','c'].some(function(k){return p[k][3]&&p[k][2]<=now;}) : state.progress[w.c]&&isDue(w.c);
  }).length;
}
