
  /* ============================================================
     « LA CLÉ » — la leçon-découverte, bilingue
     ============================================================ */
  function blockStripHtml(){
    return "<div class='block-strip' id='key-strip'>" + BLOCKS.map(function(b, i){
      return "<div class='block-row' data-i='" + i + "'>" +
               "<div class='block-ar' dir='rtl' lang='ar'>" + b.ar + "</div>" +
               "<div class='block-range'>" + blockLabel(b) + "</div>" +
               "<div class='block-names'>" + TS(b.note, b.noteAr) + "</div>" +
             "</div>";
    }).join("") + "</div>";
  }
  function revealStrip(){
    var rows = document.querySelectorAll("#key-strip .block-row");
    Array.prototype.forEach.call(rows, function(r, i){
      window.setTimeout(function(){ r.classList.add("on"); }, 180 + i*170);
    });
  }
  function anchorRow(code, fr, ar){
    return "<div class='block-row on'><div class='block-range'>" + pad(code) + "</div>" +
           "<div class='block-names'>" + TS(fr, ar) + "</div></div>";
  }

  function buildKeyQueue(){
    var pool = poolForTier(1);
    return [
      {kind:"tell", code:0, noRecord:true, cta:T("Montre-moi","أرني"),
       html:"<h2>" + T("Tu n'as pas 31 codes à apprendre","ليس عليك حفظ 31 رمزا") + "</h2>" +
            "<div class='key-big'>31 → 9</div>" +
            "<p>" + TS("Les codes <b>01 à 31</b> ne sont pas tombés au hasard : ils suivent l'<b>ordre alphabétique arabe</b> des noms de wilayas.",
                       "الرموز من <b>01 إلى 31</b> ليست عشوائية: إنها تتبع <b>الترتيب الأبجدي العربي</b> لأسماء الولايات.") + "</p>" +
            "<p>" + TS("Au lieu de 31 faits isolés, tu as neuf blocs de lettres. C'est la seule chose à retenir ici.",
                       "بدل 31 معلومة منفصلة، لديك تسع كتل من الحروف. هذا كل ما يجب حفظه هنا.") + "</p>"},

      {kind:"tell", code:0, noRecord:true, cta:T("C'est clair","واضح"), after:function(){ revealStrip(); },
       html:"<h2>" + T("Les neuf blocs","الكتل التسع") + "</h2>" +
            "<p>" + TS("Chaque lettre occupe une plage de codes, dans l'ordre de l'alphabet arabe.",
                       "كل حرف يشغل مجالا من الرموز، حسب ترتيب الأبجدية العربية.") + "</p>" +
            blockStripHtml() +
            "<p style='margin-top:14px;'>" + TS("Six wilayas d'affilée en <span dir='rtl' lang='ar'>ب</span> (05–10). Cinq en <span dir='rtl' lang='ar'>ت</span> (11–15). Une seule en <span dir='rtl' lang='ar'>ع</span> : Annaba, 23.",
                                                "ست ولايات متتالية بحرف ب (05–10). وخمس بحرف ت (11–15). وواحدة فقط بحرف ع: عنابة، 23.") + "</p>"},

      exBlock(5),

      {kind:"tell", code:0, noRecord:true, cta:T("Malin","ذكيّ"),
       html:"<h2>" + T("Le seul vrai piège : le 02","الفخ الوحيد: الرقم 02") + "</h2>" +
            "<p>" + TS("<b>Chlef</b> porte le 02, coincé entre Adrar et Laghouat. Or <span dir='rtl' lang='ar'>الشلف</span> commence par <span dir='rtl' lang='ar'>ش</span> — ça ne colle pas du tout.",
                       "<b>الشلف</b> تحمل الرقم 02، بين أدرار والأغواط. لكنها تبدأ بحرف ش — وهذا لا يستقيم أبدا.") + "</p>" +
            "<div class='key-arrow'>↓</div>" +
            "<p>" + TS("Parce qu'en 1974 cette wilaya s'appelait <b>El Asnam</b> — <span dir='rtl' lang='ar'>الأصنام</span>, avec un <span dir='rtl' lang='ar'>أ</span>. Elle n'a été renommée qu'après le séisme de 1980. Le code est resté, le nom a changé.",
                       "لأن هذه الولاية كانت تسمى سنة 1974 <b>الأصنام</b>، بحرف أ. ولم تُسمَّ الشلف إلا بعد زلزال 1980. بقي الرمز وتغيّر الاسم.") + "</p>"},

      exBlock(2),

      {kind:"tell", code:0, noRecord:true, cta:T("Continuer","تابع"),
       html:"<h2>" + T("Tes points d'ancrage","نقاط ارتكازك") + "</h2>" +
            "<p>" + TS("Retiens d'abord ces quatre-là. Tout le reste se compte à partir d'eux.",
                       "احفظ هذه الأربعة أولا. وكل الباقي يُحسب انطلاقا منها.") + "</p>" +
            "<div class='block-strip'>" +
              anchorRow(1,  "<b>Adrar</b> — premier de tout, ouvre le <span dir='rtl' lang='ar'>ا</span>.", "<b>أدرار</b> — الأول في كل شيء، يفتح حرف ا.") +
              anchorRow(16, "<b>Alger</b> — <span dir='rtl' lang='ar'>الجزائر</span>, ouvre le <span dir='rtl' lang='ar'>ج</span>. La capitale au milieu.", "<b>الجزائر</b> — تفتح حرف ج. العاصمة في الوسط.") +
              anchorRow(23, "<b>Annaba</b> — seule wilaya en <span dir='rtl' lang='ar'>ع</span>, donc code unique.", "<b>عنابة</b> — الولاية الوحيدة بحرف ع، إذن رمز منفرد.") +
              anchorRow(31, "<b>Oran</b> — <span dir='rtl' lang='ar'>وهران</span>, dernière lettre, dernier code de 1974.", "<b>وهران</b> — آخر حرف، وآخر رمز لسنة 1974.") +
            "</div>"},

      exName2Code(16, 4, pool),

      {kind:"tell", code:0, noRecord:true, cta:T("Commencer le parcours","ابدأ المسار"),
       html:"<h2>" + T("Et après 31 ?","وماذا بعد 31؟") + "</h2>" +
            "<p>" + TS("Le fil alphabétique s'arrête là. <b>32–48</b> sont l'extension de 1984, <b>49–58</b> le Sud de 2019, <b>59–69</b> les onze de novembre 2025.",
                       "ينقطع الخيط الأبجدي هنا. <b>32–48</b> توسعة 1984، و<b>49–58</b> الجنوب سنة 2019، و<b>59–69</b> الإحدى عشرة لنوفمبر 2025.") + "</p>" +
            "<p>" + TS("Pour celles-là, pas de règle : le parcours te donnera des images et des voisins. Mais tu viens de faire tomber les deux tiers du travail.",
                       "لا قاعدة لها: سيعطيك المسار صورا وجيرانا بدلها. لكنك أسقطت للتو ثلثي العمل.") + "</p>"}
    ].filter(Boolean);
  }

  function startKey(trigger){
    startSession({kind:"key", queue:buildKeyQueue(), hearts:0,
                  label:TL("La Clé — leçon de découverte","المفتاح — درس الاكتشاف"), trigger:trigger});
  }

  /* ============================================================
     PARCOURS — un tap = une leçon
     ============================================================ */
  function unitUnlocked(u, i){
    if(i === 0) return true;
    return (state.crowns[UNITS[i-1].id] || 0) >= 1;
  }
  function unitStrength(u){
    if(!u.pool.length) return 0;
    var sum = u.pool.reduce(function(a, w){ return a + getBox(w.c); }, 0);
    return Math.round((sum / (u.pool.length*5)) * 100);
  }
  function unitDue(u){
    if(u.id === "u1")return pilotDue();
    return u.pool.filter(function(w){ return state.progress[w.c] && isDue(w.c); }).length;
  }
  function unitNeedsReview(u){
    return unitDue(u) >= Math.ceil(u.pool.length*0.4);
  }
  function nextUnit(){
    for(var i=0;i<UNITS.length;i++){
      if(unitUnlocked(UNITS[i], i) && (state.crowns[UNITS[i].id]||0) < 1) return UNITS[i];
    }
    for(var j=0;j<UNITS.length;j++){
      if(unitUnlocked(UNITS[j], j) && (state.crowns[UNITS[j].id]||0) < 5) return UNITS[j];
    }
    return null;
  }

  /* Les repères du kit : la lettre arabe qui commande une tranche de
     codes, et la tranche qu'elle couvre à l'intérieur de cette unité.
     Au-delà de 31 le fil alphabétique s'arrête — il n'y a alors rien à
     montrer, et mieux vaut ne rien montrer qu'inventer un repère. */
  function reperesHtml(u){
    var bs = BLOCKS.filter(function(b){ return b.lo <= u.hi && b.hi >= u.lo; });
    if(!bs.length) return "";
    return "<div class='reperes'>" + bs.map(function(b){
      var lo = Math.max(b.lo, u.lo), hi = Math.min(b.hi, u.hi);
      return "<span class='repere'>" +
        "<span class='repere-ar' lang='ar' dir='rtl'>" + b.ar + "</span>" +
        "<span class='repere-n' dir='ltr'>" + (lo === hi ? pad(lo) : pad(lo) + "–" + pad(hi)) + "</span>" +
      "</span>";
    }).join("") + "</div>";
  }

  /* Un seul gabarit pour les trois cartes possibles. Elles disent des
     choses différentes mais ont la même anatomie — celle du kit : une
     accroche et un badge sur la même ligne, un titre, une précision,
     éventuellement des repères, puis un bouton pleine largeur. */
  function heroCarte(o){
    var hero = document.getElementById("hero-card");
    /* `ui1` est reposé à chaque rendu : la carte est habillage, pas
       contenu, et réécrire className l'effacerait sinon. */
    hero.className = "hero patio-card ui1" + (o.classe ? " " + o.classe : "");
    hero.innerHTML =
      "<div class='hero-haut'>" +
        "<p class='hero-kicker'>" + o.kicker + "</p>" +
        (o.badge ? "<span class='hero-unite'>" + o.badge + "</span>" : "") +
      "</div>" +
      "<div class='hero-corps'>" +
        "<p class='hero-title'>" + o.titre + "</p>" +
        (o.sous ? "<p class='hero-sub'>" + o.sous + "</p>" : "") +
        (o.reperes || "") +
        (o.meta ? "<p class='hero-meta'>" + o.meta + "</p>" : "") +
      "</div>" +
      "<template class='hero-mascot-template'>" + o.mascotte + "</template>" +
      "<span class='hero-go'>" + PLAY_ICON + " " + o.cta + "</span>";
    hero.setAttribute("aria-label", o.aria);
    hero.onclick = o.action;
  }

  function renderHero(){
    var due = reviewWilayaCount();

    if(!state.keyDone){
      heroCarte({
        classe:"key",
        kicker:T("Commence ici","ابدأ هنا"),
        badge:T("2 min","دقيقتان"),
        titre:T("La Clé","المفتاح"),
        sous:TS("Les codes 01–31 suivent une règle. Comprends-la d’abord.","الرموز 01–31 تتبع قاعدة. افهمها أولا."),
        mascotte:mascotHtml("fennec", 96, "excited"),
        cta:T("Découvrir","اكتشف"),
        aria:TL("La Clé, leçon de découverte de deux minutes","المفتاح، درس اكتشاف في دقيقتين"),
        action:function(){ startKey(document.getElementById("hero-card")); }
      });
      return;
    }

    var anyDone = UNITS.some(function(x){ return (state.crowns[x.id]||0) >= 1; });
    if(due > 0 && anyDone){
      heroCarte({
        classe:"review",
        kicker:T("Le bon moment","الوقت المناسب"),
        titre:T("Prêt pour une révision ?","هل أنت مستعد للمراجعة؟"),
        sous:T("Consolide tes connaissances sur les wilayas.","رسّخ معرفتك بالولايات."),
        mascotte:mascotHtml("cigogne", 96, "happy"),
        cta:T("Réviser","راجع"),
        aria:TL(due + " wilayas à réviser", due + " ولاية للمراجعة"),
        action:function(){ startReview(document.getElementById("hero-card")); }
      });
      return;
    }

    var u = nextUnit();
    if(!u){
      heroCarte({classe:"complete",kicker:T("Parcours exploré","تم استكشاف المسار"),
        titre:T("Tous les niveaux sont acquis","اكتملت كل المستويات"),
        sous:T("Entretiens tes connaissances à ton rythme.","حافظ على معرفتك وفق وتيرتك."),
        mascotte:mascotHtml("fennec",96,"happy"),cta:T("S’entraîner","تدرّب"),
        aria:TL("Tous les niveaux acquis. Ouvrir l’entraînement.","اكتملت المستويات. افتح التدريب."),
        action:function(){switchTab("practice");}});
      return;
    }
    var i = UNITS.indexOf(u);
    var crown = state.crowns[u.id] || 0;
    heroCarte({
      classe:"next",
      kicker:T("Prochaine étape","المرحلة التالية"),
      badge:T("Unité " + (i+1), "الوحدة " + (i+1)),
      titre:T("Codes " + num(u.label), "الرموز " + num(u.label)),
      sous:T(u.title, UNIT_AR[u.id] || u.title),
      reperes:reperesHtml(u),
      meta:crown === 0
        ? T("10 questions · 5 cœurs", "10 أسئلة · 5 قلوب")
        : T("Niveau " + crown + "/5 · une couronne à gagner", "المستوى " + crown + "/5 · تاج يُكسب"),
      mascotte:mascotHtml(UNIT_MASCOT[u.id], 96, "happy"),
      cta:crown === 0 ? T("Commencer","ابدأ") : T("Continuer","تابع"),
      aria:TL("Prochaine étape, unité " + (i+1) + ", codes " + u.label + ", " + u.title,
              "المرحلة التالية، الوحدة " + (i+1) + "، الرموز " + u.label),
      action:function(){ startLesson(u, document.getElementById("hero-card")); }
    });
  }

  /* One unit button, one persistent earned level; review debt is independent. */
  function niveauxHtml(crown, unlocked){
    var n=Math.max(0,Math.min(5,crown)), chips="";
    for(var k=0;k<5;k++)chips+="<span class='niveau-rose"+(k<n?" on":"")+"'></span>";
    return unlocked?"<span class='node-level'><span class='sr-only'>"+T("Niveau acquis","المستوى المكتسب")+"</span><bdi>"+n+"/5</bdi></span>"+
      "<span class='niveau-rosettes' aria-hidden='true'>"+chips+"</span>":"<span class='node-lock' aria-hidden='true'>"+LOCK_ICON+"</span>";
  }
  function etapeHtml(u,i,unlocked,suivante){
    var n=Math.max(0,Math.min(5,state.crowns[u.id]||0)),due=unlocked?unitDue(u):0;
    if(u.id === "u1")n=pilotLevel();
    var current=!!(unlocked&&suivante&&u.id===suivante.id);
    var label=!unlocked?T("À débloquer","للفتح"):n===5?T("Niveaux acquis","المستويات مكتسبة"):n?T("À consolider","للتعزيز"):T("À découvrir","للاكتشاف");
    if(u.id === "u1")label=T("Atelier de mémoire","ورشة الذاكرة");
    return "<div class='etape"+(current?" etape-current":"")+"' data-unite='"+u.id+"'>"+
      (i<UNITS.length-1?"<svg class='step-link' viewBox='0 0 100 100' preserveAspectRatio='none' aria-hidden='true'><path d='"+(i%2?"M78 0 C78 50 22 50 22 100":"M22 0 C22 50 78 50 78 100")+"'/></svg>":"")+
      "<div class='etape-noeud'>"+(current?"<span class='step-recommendation'>"+T("Prochaine étape","الخطوة التالية")+"</span>":"")+
      "<button class='noeud"+(!unlocked?" node-locked":"")+"' type='button' data-i='"+i+"' aria-haspopup='dialog' aria-expanded='false' aria-controls='sheet-root'>"+
      "<span class='noeud-surface' aria-hidden='true'></span><span class='noeud-content'><bdi class='node-codes'>"+u.label+"</bdi>"+niveauxHtml(n,unlocked)+"</span></button></div>"+
      "<div class='etape-corps'><h3>"+T("Unité "+(i+1),"الوحدة "+(i+1))+"</h3><p class='etape-etat'>"+label+"</p>"+
      (due?"<p class='step-review'>"+REVISION_ICON+T(num(due)+" à revoir",num(due)+" للمراجعة")+"</p>":"")+"</div></div>";
  }

  /* Les illustrations ne changent jamais : on les pose une fois, au
     démarrage, plutôt qu'à chaque rendu du chemin. */
  function poserImagesKit(){
    if(typeof KIT === "undefined") return;
    if(KIT.patio) document.documentElement.style.setProperty("--patio-image", "url(" + KIT.patio.src + ")");
    var paires = [["banner-img","banniere"], ["decor-chemin","chemin"]];
    paires.forEach(function(pr){
      var el = document.getElementById(pr[0]);
      if(el && KIT[pr[1]]) el.src = KIT[pr[1]].src;
    });
    var bande = document.getElementById("statstrip");
    if(bande) bande.addEventListener("click", function(){
      /* Ces deux nombres parlent de révision : le geste naturel est
         d'aller s'entraîner, pas d'ouvrir une explication. */
      switchTab("practice");
    });
  }

  function renderPath(){
    var track = document.getElementById("path-track");
    if(!track) return;

    /* La Clé garde son rang à part : ce n'est pas une unité de codes,
       c'est la règle qui rend toutes les autres moins lourdes. */
    /* Une seule paire pour toute l'étiquette : deux T() collés bout à
       bout entrelaceraient les langues (« La Clé / المفتاح / acquise »
       sur trois lignes au lieu de deux). */
    var cle = "<button class='cle-badge " + (state.keyDone ? "acquise" : "todo") + "' " +
      "type='button' id='cle-badge'>" +
      (state.keyDone ? CHECK_ICON : PLAY_ICON) +
      "<span>" + T("La Clé · " + (state.keyDone ? "acquise" : "à découvrir"),
                   "المفتاح · " + (state.keyDone ? "مكتسب" : "اكتشفه")) + "</span>" +
      "</button>";

    var suivante = nextUnit();
    var html = cle;
    UNITS.forEach(function(u, i){ html += etapeHtml(u, i, unitUnlocked(u, i), suivante); });
    if(!suivante)html+="<p class='path-complete' role='status'>"+T("Tous les niveaux sont acquis. Les révisions restent disponibles.","اكتملت المستويات. تبقى المراجعات متاحة.")+"</p>";
    track.innerHTML = html;

    document.getElementById("cle-badge").addEventListener("click", function(){
      startKey(this);
    });
    Array.prototype.forEach.call(track.querySelectorAll(".noeud"), function(b){
      var i = parseInt(b.getAttribute("data-i"), 10);
      var u = UNITS[i];
      var unlocked = unitUnlocked(u, i);
      var crown = u.id === "u1" ? pilotLevel() : (state.crowns[u.id] || 0);
      var due = unlocked ? unitDue(u) : 0;
      b.setAttribute("aria-label", TL(
        "Unité "+(i+1)+", codes "+u.label+", "+(!unlocked?"verrouillée. Consulter la condition de déblocage.":"niveau acquis "+crown+" sur 5"+(due?", "+due+" à revoir":"")+". Consulter l’unité."),
        "الوحدة "+(i+1)+"، الرموز "+u.label+"، "+(!unlocked?"مقفلة. اعرض شرط الفتح.":"المستوى المكتسب "+crown+" من 5"+(due?"، "+due+" للمراجعة":"")+". اعرض الوحدة.")));
      b.addEventListener("click",function(){openUnitSheet(u,unitUnlocked(u,i),i,b);});
    });

    renderStatStrip();
    renderCheminCompte();
    renderHero();
    renderInvitePhoto();
    refreshTopStats();
  }

  /* Le bandeau du haut : ce qui tient, et ce qui glisse. */
  function renderStatStrip(){
    var bande = document.getElementById("statstrip");
    if(!bande) return;
    var pool = poolForTier(state.tier);
    var solides = pool.filter(function(w){ return getBox(w.c) >= 5; }).length;
    var dus = reviewWilayaCount();
    bande.innerHTML = '<span class="patio-map-icon" aria-hidden="true"></span><span class="patio-progress-copy">'+T(solides+" wilayas solides · "+dus+" à revoir",solides+" ولايات راسخة · "+dus+" للمراجعة")+'<span class="patio-progress-track" aria-hidden="true"><span style="width:'+Math.round(solides/Math.max(pool.length,1)*100)+'%"></span></span></span><span class="chev" aria-hidden="true">'+CHEVRON_ICON+'</span>';
    bande.setAttribute("aria-label", TL(
      solides + " wilayas solides, " + dus + " à revoir. Ouvrir l'entraînement.",
      solides + " ولاية راسخة، " + dus + " للمراجعة."));
  }

  function renderCheminCompte(){
    var el = document.getElementById("chemin-compte");
    if(!el) return;
    var faites = UNITS.filter(function(u){ return (state.crowns[u.id]||0) >= 1; }).length;
    /* T() et non TL() : ici c'est du texte affiché, pas un aria-label.
       TL() aurait collé les deux langues avec un tiret au milieu de la
       page, au lieu de les ranger de part et d'autre du filet. */
    el.innerHTML = T(num(faites + " / " + UNITS.length) + " unités explorées",
                     num(faites + " / " + UNITS.length) + " وحدات مستكشفة");
  }

  function openUnitSheet(u,unlocked,i,trigger){
    trigger=trigger||document.querySelector('.noeud[data-i="'+i+'"]');
    var n=Math.max(0,Math.min(5,state.crowns[u.id]||0)),due=unlocked?unitDue(u):0;
    var action=due?T("Réviser cette unité","راجع هذه الوحدة"):!n?T("Commencer la leçon","ابدأ الدرس"):n<5?T("Continuer l’entraînement","واصل التدريب"):T("S’entraîner à nouveau","تدرّب مجددا");
    if(u.id === "u1")action=T("Ouvrir mon atelier","افتح ورشتي");
    openSheet("<button class='sheet-dismiss' id='sheet-close' aria-label='"+TL("Fermer","إغلاق")+"'>×</button>"+
      "<h2 id='sheet-title'>"+T("Unité "+(i+1)+" · "+num(u.label),"الوحدة "+(i+1)+" · "+num(u.label))+"</h2>"+
      "<p class='sub'>"+T(u.title,UNIT_AR[u.id]||"")+"</p>"+
      (u.id === "u1" ? "<button class='btn' id='sheet-start'>"+action+"</button>"+pilotSummary() : "")+
      (unlocked?"<p class='earned-level'>"+T((u.id === "u1" ? "Leçons déjà accomplies : " : "Niveau acquis ")+num(n+"/5"),(u.id === "u1" ? "الدروس المنجزة سابقا : " : "المستوى المكتسب ")+num(n+"/5"))+"</p>"+
        "<p class='sub'>"+T("Les niveaux récompensent les leçons réussies. Les révisions entretiennent la mémoire.","تكافئ المستويات الدروس الناجحة. وتحافظ المراجعات على الذاكرة.")+"</p>"+
        (due?"<p class='step-review'>"+T(due+" à revoir dans cette unité",due+" للمراجعة في هذه الوحدة")+"</p>":"")+
        (u.id !== "u1" ? "<button class='btn' id='sheet-start'>"+action+"</button>" : "")+
        (due?"<button class='btn ghost' id='sheet-train'>"+T("Faire une leçon","ابدأ درسا")+"</button>":""):
        "<p class='sub'>"+T("Obtiens le premier niveau de l’unité "+i+" pour ouvrir celle-ci.","احصل على المستوى الأول من الوحدة "+i+" لفتح هذه الوحدة.")+"</p><button class='btn' id='sheet-previous'>"+T("Voir l’unité "+i,"اعرض الوحدة "+i)+"</button>"));
    document.getElementById('sheet-box').classList.add('parcours-sheet');
    if(trigger){trigger.setAttribute('aria-expanded','true');sheetPrevFocus=trigger;}
    document.getElementById('sheet-close').onclick=closeSheet;
    function launch(review){
      if(!unitUnlocked(u,i)){closeSheet();openUnitSheet(u,false,i,trigger);return;}
      closeSheet();if(review)startReview(trigger,u);else startLesson(u,trigger);
    }
    var start=document.getElementById('sheet-start');if(start)start.onclick=function(){launch(!!due);};
    var train=document.getElementById('sheet-train');if(train)train.onclick=function(){launch(false);};
    var prev=document.getElementById('sheet-previous');if(prev)prev.onclick=function(){closeSheet();openUnitSheet(UNITS[i-1],unitUnlocked(UNITS[i-1],i-1),i-1);};
  }
