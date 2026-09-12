
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
    return UNITS[0];
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
    hero.className = "hero ui1" + (o.classe ? " " + o.classe : "");
    hero.innerHTML =
      (typeof KIT !== "undefined" && KIT.patio ? "<img class='hero-patio' src='" + KIT.patio.src + "' alt='' aria-hidden='true'/>" : "") +
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
      "<div class='hero-bete'>" + o.mascotte + "</div>" +
      "<span class='hero-go'>" + PLAY_ICON + " " + o.cta + "</span>";
    hero.setAttribute("aria-label", o.aria);
    hero.onclick = o.action;
  }

  function renderHero(){
    var due = dueCodes(poolForTier(state.tier)).length;

    if(!state.keyDone){
      heroCarte({
        classe:"key",
        kicker:T("Commence ici","ابدأ هنا"),
        badge:T("2 min","دقيقتان"),
        titre:T("La Clé","المفتاح"),
        sous:TS("Les codes 01–31 suivent une règle. Comprends-la d'abord, et il te restera trois fois moins à mémoriser.",
                "الرموز 01–31 تتبع قاعدة. افهمها أولا، وسيبقى عليك حفظ ثلث ما كنت ستحفظه."),
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
        titre:T(due + " wilaya" + (due>1?"s":"") + " à réviser", due + " ولاية للمراجعة"),
        sous:TS("Elles arrivent au bord de l'oubli. Les revoir maintenant coûte une minute et vaut dix répétitions plus tard.",
                "إنها على حافة النسيان. مراجعتها الآن تكلّف دقيقة وتساوي عشر تكرارات لاحقا."),
        mascotte:mascotHtml("cigogne", 96, "happy"),
        cta:T("Réviser","راجع"),
        aria:TL(due + " wilayas à réviser", due + " ولاية للمراجعة"),
        action:function(){ startReview(document.getElementById("hero-card")); }
      });
      return;
    }

    var u = nextUnit();
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

  /* ============================================================
     LE CHEMIN — d'après le kit graphique

     Chaque étape est une ligne : le nœud à gauche, ce qu'il faut savoir
     à droite. Deux informations distinctes y sont montrées, et le kit
     insiste pour qu'on ne les confonde jamais :
       · la MAÎTRISE (les couronnes gagnées, de 0 à 5) ;
       · les RÉVISIONS DUES, qui n'enlèvent aucune couronne mais
         redemandent du travail.
     ============================================================ */

  /* Les cinq rosettes représentent les niveaux gagnés (couronnes).
     La force Leitner, continue, reste dans le détail de l'unité. */
  function niveauxHtml(crown, unlocked){
    var n = unlocked ? Math.max(0, Math.min(5, crown)) : 0;
    var label = !unlocked ? "" : n
      ? T("Maîtrise " + num(n + "/5"), "الإتقان " + num(n + "/5"))
      : T("Non commencée", "لم تبدأ بعد");
    var chips = "";
    for(var k=0;k<5;k++) chips += "<svg class='niveau-rose" + (k<n ? " on" : "") + "' viewBox='0 0 32 32' aria-hidden='true'><path d='M16 1 L21 5 L27 5 L27 11 L31 16 L27 21 L27 27 L21 27 L16 31 L11 27 L5 27 L5 21 L1 16 L5 11 L5 5 L11 5 Z'/></svg>";
    return "<div class='etape-niveaux" + (n===5 ? " complete" : "") + "'>" +
      (label ? "<p class='niveau-label'>" + label + "</p>" : "") +
      "<div class='niveau-rosettes' aria-hidden='true'>" + chips + "</div></div>";
  }

  /* Le cadre à seize côtés du kit, repris tel quel. */
  var NOEUD_CADRE = "M40 1 L49 9 L62 10 L65 23 L77 39 L67 50 L62 65 L49 68 L40 77 " +
                    "L29 69 L16 65 L12 51 L2 40 L13 27 L16 13 L30 9 Z";

  function noeudSvg(texte, etat){
    var trait = etat === "fermee" ? "var(--border-strong)"
              : etat === "faite"  ? "var(--gold)" : "var(--accent)";
    /* Le même fond pour tous les états : en thème clair, `--surface`
       est presque blanc — un nœud verrouillé y devenait le disque le
       plus lumineux de l'écran, donc le plus attirant. C'est le trait
       qui dit l'état, pas le remplissage. */
    var fond  = "var(--surface-2)";
    return "<svg viewBox='0 0 80 80' aria-hidden='true' focusable='false'>" +
      "<path d='" + NOEUD_CADRE + "' fill='" + fond + "' stroke='" + trait + "' stroke-width='1.3'/>" +
      "<circle cx='40' cy='39' r='31' fill='" + fond + "' stroke='" + trait + "' stroke-width='1.5'/>" +
      "<circle cx='40' cy='39' r='27.5' fill='none' stroke='" + trait + "' stroke-width='.55' opacity='.65'/>" +
      "<path d='M40 5l2 3-2 3-2-3ZM74 39l-3 2-3-2 3-2ZM40 73l-2-3 2-3 2 3ZM6 39l3-2 3 2-3 2Z' fill='" + trait + "'/>" +
      /* `direction` en ATTRIBUT, et non le <bdi> de num() : <bdi> est un
         élément HTML, invisible à l'intérieur d'un SVG — le texte y
         disparaissait purement et simplement. */
      "<text class='noeud-txt' x='40' y='45' text-anchor='middle' " +
        "direction='ltr' unicode-bidi='isolate'>" + texte + "</text>" +
      "</svg>";
  }

  /* La liaison d'un nœud au suivant : un simple trait vertical. La
     serpentine du kit étalait le chemin sur deux fois la hauteur, et
     on ne voyait plus que trois unités sur huit à l'écran. */
  function liaisonHtml(acquise){
    return "<span class='liaison" + (acquise ? " acquise" : "") + "' aria-hidden='true'></span>";
  }

  function etapeHtml(u, i, unlocked, suivante){
    var crown = state.crowns[u.id] || 0;
    var due = unlocked ? unitDue(u) : 0;
    var etat = !unlocked ? "fermee" : (crown >= 5 ? "faite" : (crown > 0 ? "ouverte" : "ouverte"));

    /* L'état affiché répond à « qu'est-ce que je fais maintenant ? ».
       Une révision due passe donc devant une couronne déjà gagnée. */
    /* T() et non TL() : ce sont des libellés AFFICHÉS. TL() est la
       version texte pur, réservée aux aria-label — utilisée ici, elle
       collait les deux langues avec un tiret au milieu de la ligne. */
    var ligne, classe, icone;
    if(!unlocked){
      classe = "fermee"; icone = LOCK_ICON;
      ligne = T("Verrouillée","مقفلة");
    }else if(due > 0){
      classe = "revoir"; icone = REVISION_ICON;
      ligne = T(num(due) + " à revoir", num(due) + " للمراجعة");
    }else if(crown >= 5){
      classe = "faite"; icone = CHECK_ICON;
      ligne = T("Maîtrisée","متقَنة");
    }else if(crown > 0){
      classe = "ouverte"; icone = PLAY_ICON;
      ligne = T("À continuer","تابع");
    }else{
      classe = "ouverte"; icone = PLAY_ICON;
      ligne = T("À commencer","ابدأ");
    }

    return "<div class='etape" + (unlocked && suivante && u.id === suivante.id ? " etape-current" : "") + "' data-unite='" + u.id + "'>" +
      "<div class='etape-noeud'>" +
        /* Même la première étape porte sa liaison : elle la relie au
           badge de La Clé, juste au-dessus. Sans elle, le chemin
           commencerait dans le vide. */
        liaisonHtml(i > 0 ? unlocked : state.keyDone) +
        "<button class='noeud' type='button' data-i='" + i + "'" + (unlocked ? "" : " disabled") + ">" +
          noeudSvg(u.label, classe) +
        "</button>" +
        /* Une seule pastille « lecture » sur tout le chemin : celle de
           l'étape où l'on en est. Deux repères de départ, ce serait
           deux départs — et on ne saurait plus lequel est le sien. */
        (unlocked && suivante && u.id === suivante.id
          ? "<span class='noeud-go' aria-hidden='true'>" + PLAY_ICON + "</span>" : "") +
      "</div>" +
      "<div class='etape-corps'>" +
        "<h3>" + T("Unité " + (i+1), "الوحدة " + (i+1)) + "</h3>" +
        "<p class='etape-etat " + classe + "'>" + icone + "<span>" + ligne + "</span></p>" +
        niveauxHtml(crown, unlocked) +
      "</div>" +
    "</div>";
  }

  /* Les illustrations ne changent jamais : on les pose une fois, au
     démarrage, plutôt qu'à chaque rendu du chemin. */
  function poserImagesKit(){
    if(typeof KIT === "undefined") return;
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
    track.innerHTML = html;

    document.getElementById("cle-badge").addEventListener("click", function(){
      startKey(this);
    });
    Array.prototype.forEach.call(track.querySelectorAll(".noeud"), function(b){
      var i = parseInt(b.getAttribute("data-i"), 10);
      var u = UNITS[i];
      var unlocked = unitUnlocked(u, i);
      var crown = state.crowns[u.id] || 0;
      var due = unlocked ? unitDue(u) : 0;
      b.setAttribute("aria-label", TL(
        "Unité " + (i+1) + ", codes " + u.label + ", " + u.title + ", " +
        (!unlocked ? "verrouillée, termine l'étape précédente"
                   : (due ? due + " à réviser, " : "") + "maîtrise " + crown + " sur 5, " +
                     "activer pour lancer la leçon"),
        "الوحدة " + (i+1) + "، الرموز " + u.label));
      if(unlocked) b.addEventListener("click", function(){ startLesson(u, b); });
    });
    /* Un appui long, ou le corps de la ligne, ouvre le détail : le nœud
       lance, le reste explique. */
    Array.prototype.forEach.call(track.querySelectorAll(".etape-corps"), function(c, i){
      c.addEventListener("click", function(){
        openUnitSheet(UNITS[i], unitUnlocked(UNITS[i], i), i);
      });
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
    var dus = dueCodes(pool).length;
    bande.innerHTML =
      "<span class='stat-part'><span class='stat-pill ok'>" + CHECK_ICON + "</span>" +
        "<b>" + T(solides + " solides", solides + " راسخة") + "</b></span>" +
      "<span class='sep' aria-hidden='true'></span>" +
      "<span class='stat-part'><span class='stat-pill due'>" + REVISION_ICON + "</span>" +
        "<b>" + T(dus + " à revoir", dus + " للمراجعة") + "</b></span>" +
      "<span class='chev' aria-hidden='true'>" + CHEVRON_ICON + "</span>";
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
    el.innerHTML = T(num(faites + " / " + UNITS.length) + " unités",
                     num(faites + " / " + UNITS.length) + " وحدة");
  }

  function openUnitSheet(u, unlocked, i){
    var crown = state.crowns[u.id] || 0;
    var strength = unitStrength(u);
    var due = unitDue(u);
    var mastered = u.pool.filter(function(w){ return getBox(w.c) >= 5; }).length;
    var blocks = BLOCKS.filter(function(b){ return b.lo <= u.hi && b.hi >= u.lo; });
    var blockHtml = blocks.length
      ? "<p class='sub'>" + T("Blocs : " + blocks.map(function(b){ return b.ar + " " + blockLabel(b); }).join(" · "),
                             "الكتل: " + blocks.map(function(b){ return b.ar + " " + blockLabel(b); }).join(" · ")) + "</p>"
      : "";
    openSheet(
      "<h2 id='sheet-title'>" + num(u.label) + "</h2>" +
      "<p class='sub'>" + T(u.title, UNIT_AR[u.id] || "") + "</p>" + blockHtml +
      "<div class='strength-bar'><div class='strength-fill' style='width:" + strength + "%;'></div></div>" +
      "<div class='sheet-grid'>" +
        "<div class='sheet-stat'><span class='n'>" + strength + "%</span><span class='l'>" + TL("maîtrise","إتقان") + "</span></div>" +
        "<div class='sheet-stat'><span class='n'>" + mastered + "/" + u.pool.length + "</span><span class='l'>" + TL("ancrées","راسخة") + "</span></div>" +
        "<div class='sheet-stat'><span class='n'>" + crown + "/5</span><span class='l'>" + TL("couronnes","تيجان") + "</span></div>" +
      "</div>" +
      (due ? "<p class='sub'>" + T(due + " à réviser", due + " للمراجعة") + "</p>" : "") +
      (unlocked
        ? "<button class='btn' id='sheet-start'>" + T("Lancer la leçon","ابدأ الدرس") + "</button>"
        : "<p class='sub'>" + TS("Verrouillée — termine l'étape " + UNITS[i-1].label + ".",
                                 "مقفلة — أنهِ المرحلة " + UNITS[i-1].label + ".") + "</p>") +
      "<button class='btn ghost' id='sheet-close' style='margin-top:10px;'>" + T("Fermer","إغلاق") + "</button>"
    );
    var s = document.getElementById("sheet-start");
    if(s) s.addEventListener("click", function(){ closeSheet(); startLesson(u); });
    document.getElementById("sheet-close").addEventListener("click", closeSheet);
  }
