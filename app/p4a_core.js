
  /* ============================================================
     LA CLÉ — structure alphabétique vérifiée des codes 01–31
     Les 31 wilayas de la division de 1974 sont numérotées dans
     l'ordre alphabétique arabe. Vérifié en triant les 31 noms
     arabes : l'ordre obtenu redonne exactement les codes 01–31.
     Le 02 s'appelait الأصنام (El Asnam) à l'époque.
     ============================================================ */
  var ARABIC = {
    1:"أدرار",2:"الأصنام",3:"الأغواط",4:"أم البواقي",5:"باتنة",6:"بجاية",7:"بسكرة",
    8:"بشار",9:"البليدة",10:"البويرة",11:"تمنراست",12:"تبسة",13:"تلمسان",14:"تيارت",
    15:"تيزي وزو",16:"الجزائر",17:"الجلفة",18:"جيجل",19:"سطيف",20:"سعيدة",21:"سكيكدة",
    22:"سيدي بلعباس",23:"عنابة",24:"قالمة",25:"قسنطينة",26:"المدية",27:"مستغانم",
    28:"المسيلة",29:"معسكر",30:"ورقلة",31:"وهران",32:"البيض",33:"إليزي",
    34:"برج بوعريريج",35:"بومرداس",36:"الطارف",37:"تندوف",38:"تيسمسيلت",39:"الوادي",
    40:"خنشلة",41:"سوق أهراس",42:"تيبازة",43:"ميلة",44:"عين الدفلى",45:"النعامة",
    46:"عين تموشنت",47:"غرداية",48:"غليزان",
    49:"تيميمون",50:"برج باجي مختار",51:"أولاد جلال",52:"بني عباس",53:"عين صالح",
    54:"عين قزام",55:"تقرت",56:"جانت",57:"المغير",58:"المنيعة",
    59:"أفلو",60:"بريكة",61:"القنطرة",62:"بئر العاتر",63:"العريشة",64:"قصر الشلالة",
    65:"عين وسارة",66:"مسعد",67:"قصر البخاري",68:"بوسعادة",69:"الأبيض سيدي الشيخ"
  };

  var BLOCKS = [
    {lo:1,  hi:4,  ar:"ا", tr:"Alif", note:"Adrar · Chlef (El Asnam) · Laghouat · Oum El Bouaghi",
     noteAr:"أدرار · الأصنام (الشلف) · الأغواط · أم البواقي"},
    {lo:5,  hi:10, ar:"ب", tr:"Bâ",   note:"Batna · Béjaïa · Biskra · Béchar · Blida · Bouira",
     noteAr:"باتنة · بجاية · بسكرة · بشار · البليدة · البويرة"},
    {lo:11, hi:15, ar:"ت", tr:"Tâ",   note:"Tamanrasset · Tébessa · Tlemcen · Tiaret · Tizi Ouzou",
     noteAr:"تمنراست · تبسة · تلمسان · تيارت · تيزي وزو"},
    {lo:16, hi:18, ar:"ج", tr:"Djîm", note:"Alger (El Djazaïr) · Djelfa · Jijel",
     noteAr:"الجزائر · الجلفة · جيجل"},
    {lo:19, hi:22, ar:"س", tr:"Sîn",  note:"Sétif · Saïda · Skikda · Sidi Bel Abbès",
     noteAr:"سطيف · سعيدة · سكيكدة · سيدي بلعباس"},
    {lo:23, hi:23, ar:"ع", tr:"Aïn",  note:"Annaba", noteAr:"عنابة"},
    {lo:24, hi:25, ar:"ق", tr:"Qâf",  note:"Guelma (Qalma) · Constantine (Qusantina)",
     noteAr:"قالمة · قسنطينة"},
    {lo:26, hi:29, ar:"م", tr:"Mîm",  note:"Médéa · Mostaganem · M'Sila · Mascara",
     noteAr:"المدية · مستغانم · المسيلة · معسكر"},
    {lo:30, hi:31, ar:"و", tr:"Wâw",  note:"Ouargla · Oran (Wahran)",
     noteAr:"ورقلة · وهران"}
  ];
  function blockOf(code){
    for(var i=0;i<BLOCKS.length;i++){ if(code>=BLOCKS[i].lo && code<=BLOCKS[i].hi) return BLOCKS[i]; }
    return null;
  }
  function blockLabel(b){ return b.lo === b.hi ? pad(b.lo) : (pad(b.lo) + "–" + pad(b.hi)); }

  /* Points d'ancrage : les codes à connaître par cœur pour compter à partir d'eux */
  var ANCHORS = [1,9,16,25,31,40,48,58];

  var UNITS = [
    {id:"u1", label:"01–10", title:"Adrar → Bouira",            lo:1,  hi:10, tier:1},
    {id:"u2", label:"11–18", title:"Tamanrasset → Jijel",       lo:11, hi:18, tier:1},
    {id:"u3", label:"19–25", title:"Sétif → Constantine",       lo:19, hi:25, tier:1},
    {id:"u4", label:"26–31", title:"Médéa → Oran",              lo:26, hi:31, tier:1},
    {id:"u5", label:"32–40", title:"El Bayadh → Khenchela",     lo:32, hi:40, tier:1},
    {id:"u6", label:"41–48", title:"Souk Ahras → Relizane",     lo:41, hi:48, tier:1},
    {id:"u7", label:"49–58", title:"Les wilayas du Sud (2019)", lo:49, hi:58, tier:2},
    {id:"u8", label:"59–69", title:"Les plus récentes (2025)",  lo:59, hi:69, tier:3}
  ];
  UNITS.forEach(function(u){
    u.pool = DATA.filter(function(w){ return w.c>=u.lo && w.c<=u.hi; });
  });

  /* ---------------- Stockage & état ---------------- */
  var STORE_KEY = "wilaya-progress-v4";
  var DAY = 86400000;
  var INTERVALS = [10*60*1000, 1*DAY, 3*DAY, 7*DAY, 16*DAY, 35*DAY];
  var FAST_MCQ = 5000, FAST_TYPE = 9000;

  var state = {
    progress: {},      /* code -> {box, due, seen, ok, best} */
    confusions: {},    /* code -> {wrongCode: n} */
    crowns: {}, xp: 0, streak: {count:0, last:null},
    keyDone: false, bestBlitz: 0,
    tier: 1, mode: "code2name", pool: [], current: null, currentAnswer: null,
    sessionCorrect: 0, sessionTotal: 0, locked: false
  };

  function pad(n){ return String(n).padStart(2,"0"); }
  function byCode(c){ for(var i=0;i<DATA.length;i++){ if(DATA[i].c===c) return DATA[i]; } return null; }
  function shuffle(a){
    for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
    return a;
  }
  function todayStr(d){
    d = d || new Date();
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  }
  function bumpStreak(){
    var today = todayStr();
    if(state.streak.last === today) return false;
    var y = new Date(); y.setDate(y.getDate()-1);
    state.streak.count = (state.streak.last === todayStr(y)) ? (state.streak.count||0)+1 : 1;
    state.streak.last = today;
    return true;
  }

  /* ---------------- Ordonnanceur : Leitner + fluence ---------------- */
  function rec(code){
    var p = state.progress[code];
    if(!p){ p = {box:0, due:0, seen:0, ok:0, best:0}; state.progress[code] = p; }
    if(p.seen === undefined) p.seen = 0;
    if(p.ok === undefined) p.ok = 0;
    if(p.best === undefined) p.best = 0;
    return p;
  }
  function getBox(code){ var p = state.progress[code]; return p ? (p.box||0) : 0; }
  function isDue(code){ var p = state.progress[code]; if(!p) return true; return (p.due||0) <= Date.now(); }

  /* Une bonne réponse lente ne fait PAS monter la boîte : savoir n'est pas
     su tant que ce n'est pas rapide. Une erreur fait redescendre de deux crans. */
  function recordAnswer(code, correct, ms, wrongCode, fastLimit){
    var p = rec(code);
    p.seen++;
    if(correct){
      p.ok++;
      var fast = !ms || ms <= (fastLimit || FAST_MCQ);
      if(fast) p.box = Math.min((p.box||0)+1, 5);
      if(ms && (!p.best || ms < p.best)) p.best = ms;
    }else{
      p.box = Math.max((p.box||0)-2, 0);
      if(wrongCode && wrongCode !== code){
        if(!state.confusions[code]) state.confusions[code] = {};
        state.confusions[code][wrongCode] = (state.confusions[code][wrongCode]||0) + 1;
      }
    }
    p.due = Date.now() + INTERVALS[p.box];
  }

  function poolForTier(tier){ return DATA.filter(function(w){ return w.t <= tier; }); }
  function dueCodes(pool){
    return pool.filter(function(w){ return state.progress[w.c] && isDue(w.c); })
               .sort(function(a,b){ return (state.progress[a.c].due||0) - (state.progress[b.c].due||0); });
  }
  function confusionPairs(){
    var out = [];
    Object.keys(state.confusions).forEach(function(k){
      var m = state.confusions[k];
      Object.keys(m).forEach(function(w){
        if(m[w] >= 2) out.push({a:parseInt(k,10), b:parseInt(w,10), n:m[w]});
      });
    });
    return out.sort(function(x,y){ return y.n - x.n; });
  }

  /* ---------------- Échelle de rappel ---------------- */
  /* Plus une wilaya est solide, plus l'épreuve est exigeante. */
  function ladderFor(code){
    var b = getBox(code);
    if(b <= 0) return "mcq4";
    if(b === 1) return "mcq4";
    if(b === 2) return "mcq6";
    if(b === 3) return "mcq6";
    return "type";
  }

  /* ---------------- Icônes ---------------- */
  var HEART_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7-4.3-9.5-8.4C.7 8.6 2.6 5.2 6 5.2c2 0 3.4 1 4 2.4.6-1.4 2-2.4 4-2.4 3.4 0 5.3 3.4 3.5 7.4C19 16.7 12 21 12 21z"/></svg>';
  var HEART_ICON_LOST = '<svg class="icon lost" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s-7-4.3-9.5-8.4C.7 8.6 2.6 5.2 6 5.2c2 0 3.4 1 4 2.4.6-1.4 2-2.4 4-2.4 3.4 0 5.3 3.4 3.5 7.4C19 16.7 12 21 12 21z"/></svg>';
  var CHECK_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
  var CROSS_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var PLAY_ICON  = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
  var LOCK_ICON  = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  /* Repris des icones du kit graphique. */
  var REVISION_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9a8 8 0 1 1 0 6"/><path d="M7 9V4"/><path d="M7 9h5"/></svg>';
  var CHEVRON_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var CROWN_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z"/></svg>';
  var INFO_ICON  = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/></svg>';
  var FLAME_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c-1 3-4 4-4 8a4 4 0 008 0c0-1.5-.5-2.2-1-3.2.9.6 2 2.1 2 4.2a5 5 0 01-10 0c0-4.5 3.3-6.6 5-9z"/></svg>';
  var SND_ON_ICON  = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8a5 5 0 010 8"/><path d="M19.5 5.5a9 9 0 010 13"/></svg>';
  var SND_OFF_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>';

  /* ============================================================
     SON — synthétisé, pas de fichier externe (l'APK est hors ligne).
     Un ton simple par événement, comme le "ding"/"buzz" de Duolingo.
     ============================================================ */
  var SOUND_KEY = "wilaya-sound-v1";
  function soundEnabled(){
    try{ var v = localStorage.getItem(SOUND_KEY); return v === null ? true : v === "1"; }catch(e){ return true; }
  }
  function setSoundEnabled(v){
    try{ localStorage.setItem(SOUND_KEY, v ? "1" : "0"); }catch(e){}
  }
  var audioCtx = null;
  function getAudioCtx(){
    if(audioCtx) return audioCtx;
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return null;
      audioCtx = new Ctx();
    }catch(e){ return null; }
    return audioCtx;
  }
  function tone(freq, start, dur, type, peak){
    var ctx = getAudioCtx();
    if(!ctx) return;
    if(ctx.state === "suspended"){ ctx.resume().catch(function(){}); }
    var t0 = ctx.currentTime + start;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak === undefined ? 0.11 : peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function trySound(fn){
    if(!soundEnabled()) return;
    try{ fn(); }catch(e){}
  }
  function sndCorrect(){ trySound(function(){ tone(587,0,.11,"sine",.1); tone(880,.08,.16,"sine",.1); }); }
  function sndWrong(){ trySound(function(){ tone(196,0,.22,"sawtooth",.06); }); }
  function sndCombo(){ trySound(function(){ tone(660,0,.09,"triangle",.09); tone(880,.07,.09,"triangle",.09); tone(1174,.14,.14,"triangle",.09); }); }
  function sndComplete(){ trySound(function(){ tone(523,0,.14,"sine",.1); tone(659,.11,.14,"sine",.1); tone(784,.22,.22,"sine",.1); }); }
  function sndPerfect(){ trySound(function(){ tone(523,0,.11,"sine",.1); tone(659,.09,.11,"sine",.1); tone(784,.18,.11,"sine",.1); tone(1047,.27,.28,"sine",.11); }); }
  function sndFail(){ trySound(function(){ tone(311,0,.18,"sawtooth",.07); tone(233,.16,.26,"sawtooth",.07); }); }
  function sndUnlock(){ trySound(function(){ tone(440,0,.09,"square",.05); tone(659,.09,.15,"square",.06); }); }

  /* ============================================================
     COMPAGNON — quatre personnages dessinés (voir MASCOTS).
     Les illustrations sont fixes et souriantes ; l'humeur est
     rendue par le CSS (inclinaison, saturation, rebond) plutôt
     que par une variante d'image par émotion, ce qui aurait
     quadruplé le poids du fichier pour un gain marginal.
     ============================================================ */
  var MASCOT_NAMES = ["fennec", "chameau", "cigogne", "palmier"];

  /* Chaque étape du parcours a son personnage : le Sud a le
     chameau, les oasis le palmier, l'Est la cigogne. Le fennec
     ouvre et ferme, c'est lui l'emblème. */
  var UNIT_MASCOT = {
    u1:"fennec", u2:"cigogne", u3:"cigogne", u4:"fennec",
    u5:"palmier", u6:"cigogne", u7:"chameau", u8:"palmier"
  };

  /* ------------------------------------------------------------
     « Vivant » — ce qui sépare une vignette d'un personnage.

     Les images sont fixes : la vie vient entièrement du mouvement.
     Trois couches, empruntées à l'animation traditionnelle :

       1. une respiration continue, en écrasement/étirement, pivot au
          sol — c'est elle qui empêche la pose figée ;
       2. des micro-gestes déclenchés au hasard (petit saut, coup
          d'œil, dandinement) toutes les quelques secondes, pour que
          rien ne soit jamais prévisible ;
       3. une ombre portée qui s'écrase quand le personnage retombe,
          ce qui lui donne du poids et l'ancre au sol.

     Chaque instance reçoit un décalage propre : deux mascottes à
     l'écran ne doivent jamais respirer à l'unisson, sinon l'illusion
     s'effondre et on revoit deux images.
     ------------------------------------------------------------ */
  var mascotSeq = 0;

  function mascotHtml(character, size, mood){
    var name = MASCOTS[character] ? character : "fennec";
    var m = MASCOTS[name];
    var s = size || 48;
    var w = Math.round(s * m.w / m.h);
    var id = "mascot-" + (++mascotSeq);
    /* Décalages irréguliers : une valeur ronde se resynchroniserait,
       et deux mascottes qui respirent à l'unisson redeviennent deux
       images. */
    var delay = (mascotSeq * 0.37) % 2.3;
    var period = 3.1 + ((mascotSeq * 0.53) % 1.4);
    var headDelay = (mascotSeq * 0.61) % 3.1;
    var headPeriod = 5.2 + ((mascotSeq * 0.71) % 2.2);

    /* Quatre couches, et il en faut quatre :
         .mascot-stage   immobile — c'est le sol, l'ombre s'y accroche
         .mascot-breathe la respiration du corps, en boucle
         .mascot-rig     les gestes du corps entier et l'humeur
         .rig-head       la tête, articulée sur son axe au cou
       Empiler deux animations sur un même élément ne marche pas : la
       propriété animation de la seconde remplace la première, et le
       personnage se fige dès sa première réaction. */
    return "<span class='mascot-stage' id='" + id + "' data-mascot='" + name + "'" +
             " style='height:" + s + "px;width:" + w + "px;'>" +
             "<span class='mascot-shadow' aria-hidden='true'></span>" +
             "<span class='mascot-breathe' style='animation-delay:" + delay.toFixed(2) + "s;" +
               "animation-duration:" + period.toFixed(2) + "s;'>" +
               "<span class='mascot-rig mascot mascot-" + (mood || "happy") + "'" +
                 " style='width:" + w + "px;height:" + s + "px;'>" +
                 "<img class='rig-body' src='" + m.body + "' alt='' aria-hidden='true' />" +
                 "<img class='rig-head' src='" + m.head + "' alt='' aria-hidden='true'" +
                   " style='transform-origin:" + (m.px*100).toFixed(1) + "% " + (m.py*100).toFixed(1) + "%;" +
                     "animation-delay:" + headDelay.toFixed(2) + "s;" +
                     "animation-duration:" + headPeriod.toFixed(2) + "s;' />" +
               "</span>" +
             "</span>" +
           "</span>";
  }
  /* Signature historique conservée : le fennec est le compagnon par défaut. */
  function mascotSvg(mood, size){ return mascotHtml("fennec", size, mood); }

  /* Micro-gestes : on en déclenche un sur une mascotte visible, au
     hasard, à intervalle irrégulier. Un intervalle fixe se remarque
     immédiatement et retombe dans le mécanique. */
  /* Deux familles de gestes, sur deux pièces différentes.
     La tête bouge souvent — c'est elle qui porte l'expression ;
     le corps entier bouge rarement, sinon le personnage gigote. */
  var HEAD_BEATS = ["beat-look", "beat-nod", "beat-tilt", "beat-perk"];
  var BODY_BEATS = ["beat-hop", "beat-wiggle"];
  var mascotTimer = null;

  function prefersReducedMotion(){
    try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch(e){ return false; }
  }

  function mascotBeat(){
    var stages = Array.prototype.filter.call(
      document.querySelectorAll(".mascot-stage"),
      function(el){ return el.offsetParent !== null; });
    if(stages.length){
      var st = stages[Math.floor(Math.random()*stages.length)];
      /* Trois gestes de tête pour un geste de corps : c'est le regard
         qui donne la vie, pas l'agitation. */
      var head = Math.random() < 0.75;
      var el = st.querySelector(head ? ".rig-head" : ".mascot-rig");
      var list = head ? HEAD_BEATS : BODY_BEATS;
      if(el && !el.dataset.beating){
        var beat = list[Math.floor(Math.random()*list.length)];
        el.dataset.beating = "1";
        el.classList.add(beat);
        window.setTimeout(function(){
          el.classList.remove(beat);
          delete el.dataset.beating;
        }, 1100);
      }
    }
    mascotTimer = window.setTimeout(mascotBeat, 1500 + Math.random()*2800);
  }
  if(!prefersReducedMotion()){
    mascotTimer = window.setTimeout(mascotBeat, 1200);
  }
  var MASCOT_LINES = {
    greet: [
      ["Prêt à apprendre ?","مستعد للتعلّم؟"],
      ["On continue ?","نواصل؟"],
      ["C'est parti.","لنبدأ."]
    ],
    correct: [
      ["Voilà !","هكذا!"], ["Exactement.","بالضبط."], ["Nickel.","ممتاز."], ["C'est ça.","هذا هو."]
    ],
    wrong: [
      ["Presque.","تقريبا."], ["Ça arrive.","يحدث هذا."], ["On la retiendra.","سنحفظها."]
    ],
    perfect: [
      ["Sans faute !","بلا خطأ!"], ["Parfait.","مثالي."], ["Impeccable.","لا تشوبه شائبة."]
    ],
    success: [
      ["Bien joué.","أحسنت."], ["Belle étape.","مرحلة جميلة."], ["Ça avance.","نتقدّم."]
    ],
    fail: [
      ["Réessaie, tu vas y arriver.","أعد المحاولة، ستنجح."], ["La prochaine est la bonne.","المرة القادمة أفضل."]
    ],
    streak: [
      ["Ta série tient bon.","سلسلتك صامدة."], ["Jour après jour.","يوما بعد يوم."]
    ]
  };
  function pickLine(kind){
    var arr = MASCOT_LINES[kind] || MASCOT_LINES.greet;
    var pick = arr[Math.floor(Math.random()*arr.length)];
    return T(pick[0], pick[1]);
  }

  function tryVibrate(pattern){
    try{ if(navigator && typeof navigator.vibrate === "function") navigator.vibrate(pattern); }catch(e){}
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg){
    var root = document.getElementById("toast-root");
    root.innerHTML = "<div class='toast'>" + msg + "</div>";
    if(toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function(){ root.innerHTML = ""; }, 2600);
  }

  /* ---------------- Dialogue de confirmation accessible ----------------
     Remplace window.confirm(), qui ne s'affiche pas dans la WebView Android. */
  function confirmDialog(message, confirmLabel){
    return new Promise(function(resolve){
      var previousFocus = document.activeElement;
      var root = document.getElementById("confirm-root");
      root.innerHTML =
        "<div class='confirm-backdrop'>" +
          "<div class='confirm-box' role='alertdialog' aria-modal='true' aria-labelledby='confirm-msg'>" +
            "<p id='confirm-msg'>" + message + "</p>" +
            "<div class='confirm-actions'>" +
              "<button class='btn ghost' id='confirm-cancel'>Annuler</button>" +
              "<button class='btn' id='confirm-ok'>" + confirmLabel + "</button>" +
            "</div>" +
          "</div>" +
        "</div>";
      var cancelBtn = document.getElementById("confirm-cancel");
      var okBtn = document.getElementById("confirm-ok");
      function finish(result){
        root.innerHTML = "";
        document.removeEventListener("keydown", onKey, true);
        if(previousFocus && previousFocus.focus) previousFocus.focus();
        resolve(result);
      }
      function onKey(e){
        if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); finish(false); }
        else if(e.key === "Tab"){
          var f = [cancelBtn, okBtn];
          var i = f.indexOf(document.activeElement);
          e.preventDefault(); e.stopPropagation();
          f[e.shiftKey ? (i<=0?1:0) : (i>=1?0:1)].focus();
        }
      }
      cancelBtn.addEventListener("click", function(){ finish(false); });
      okBtn.addEventListener("click", function(){ finish(true); });
      document.addEventListener("keydown", onKey, true);
      cancelBtn.focus();
    });
  }

  /* ---------------- Feuille de détail accessible ---------------- */
  var sheetPrevFocus = null;
  function openSheet(html){
    sheetPrevFocus = document.activeElement;
    var root = document.getElementById("sheet-root");
    root.innerHTML =
      "<div class='sheet-backdrop' id='sheet-backdrop'>" +
        "<div class='sheet' role='dialog' aria-modal='true' aria-labelledby='sheet-title' tabindex='-1' id='sheet-box'>" +
          html +
        "</div>" +
      "</div>";
    var box = document.getElementById("sheet-box");
    document.getElementById("sheet-backdrop").addEventListener("click", function(e){
      if(e.target.id === "sheet-backdrop") closeSheet();
    });
    document.addEventListener("keydown", sheetKey, true);
    box.focus();
  }
  function sheetKey(e){
    if(!document.getElementById("sheet-box")) return;
    if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
    if(e.key === "Tab"){
      var box = document.getElementById("sheet-box");
      var f = Array.prototype.filter.call(box.querySelectorAll("button,[href],input,[tabindex]:not([tabindex='-1'])"),
        function(el){ return el.offsetParent !== null; });
      if(!f.length) return;
      var first = f[0], last = f[f.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }
  function closeSheet(){
    document.getElementById("sheet-root").innerHTML = "";
    document.removeEventListener("keydown", sheetKey, true);
    if(sheetPrevFocus && sheetPrevFocus.focus) sheetPrevFocus.focus();
    sheetPrevFocus = null;
  }

  /* ---------------- Onglets ---------------- */
  function switchTab(name){
    Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function(b){
      var active = b.getAttribute("data-tab") === name;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    var target = null;
    Array.prototype.forEach.call(document.querySelectorAll(".view"), function(v){
      var active = v.id === "view-" + name;
      v.classList.toggle("active", active);
      if(active) target = v;
    });
    if(target) target.focus({preventScroll:false});
    if(name === "practice") refreshPracticeCards();
    if(name === "info") renderSyncPanel();
  }
  Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function(btn){
    btn.addEventListener("click", function(){ switchTab(btn.getAttribute("data-tab")); });
  });

  function refreshTopStats(){
    document.getElementById("stat-streak").textContent = state.streak.count || 0;
    document.getElementById("stat-xp").textContent = state.xp || 0;
  }

  function openStreakSheet(){
    var n = state.streak.count || 0;
    var practicedToday = state.streak.last === todayStr(new Date());
    openSheet(
      "<div class='streak-sheet'>" +
        "<h2 id='sheet-title' class='sr-only'>" + T("Ta série","سلسلتك") + "</h2>" +
        "<div class='streak-sheet-top'>" +
          "<span class='streak-big'>" + n + "</span>" +
          mascotHtml("fennec", 64, "happy") +
        "</div>" +
        "<p class='streak-unit'>" + T(n > 1 ? "jours d'affilée" : "jour d'affilée", "أيام متتالية") + "</p>" +
        "<p class='sub'>" + pickLine("streak") + "</p>" +
        "<div class='streak-tip'>" +
          "<svg class='icon' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M12 2c-1 3-4 4-4 8a4 4 0 008 0c0-1.5-.5-2.2-1-3.2.9.6 2 2.1 2 4.2a5 5 0 01-10 0c0-4.5 3.3-6.6 5-9z'/></svg>" +
          "<span>" + (practicedToday
            ? TS("Bien joué, aujourd'hui compte déjà.", "أحسنت، اليوم محسوب بالفعل.")
            : TS("Termine une leçon aujourd'hui pour la faire durer.", "أنهِ درسا اليوم لتستمر السلسلة.")) +
          "</span>" +
        "</div>" +
        "<button class='btn ghost' id='streak-sheet-close' style='margin-top:18px;'>" + T("Fermer","إغلاق") + "</button>" +
      "</div>"
    );
    document.getElementById("streak-sheet-close").addEventListener("click", closeSheet);
  }
  var topstatStreakEl = document.getElementById("topstat-streak");
  if(topstatStreakEl) topstatStreakEl.addEventListener("click", openStreakSheet);

  function renderSoundBtn(){
    var btn = document.getElementById("sound-btn");
    if(!btn) return;
    var on = soundEnabled();
    btn.innerHTML = on ? SND_ON_ICON : SND_OFF_ICON;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", TL(on ? "Son activé, couper le son" : "Son coupé, activer le son",
                                      on ? "الصوت مفعّل، أوقفه" : "الصوت متوقف، فعّله"));
  }
  var soundBtnEl = document.getElementById("sound-btn");
  if(soundBtnEl){
    soundBtnEl.addEventListener("click", function(){
      var next = !soundEnabled();
      setSoundEnabled(next);
      renderSoundBtn();
      if(next) trySound(function(){ tone(660,0,.08,"sine",.09); });
    });
  }
  renderSoundBtn();
