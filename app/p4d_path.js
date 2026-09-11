
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

  function renderHero(){
    var hero = document.getElementById("hero-card");
    var due = dueCodes(poolForTier(state.tier)).length;
    hero.className = "hero";

    if(!state.keyDone){
      hero.classList.add("key");
      hero.innerHTML =
        "<p class='hero-kicker'>" + T("Commence ici · 2 min","ابدأ هنا · دقيقتان") + "</p>" +
        "<p class='hero-title'>" + T("La Clé","المفتاح") + "</p>" +
        "<p class='hero-sub'>" + TS("Les codes 01–31 suivent une règle. Comprends-la d'abord, et il te restera trois fois moins à mémoriser.",
                                    "الرموز 01–31 تتبع قاعدة. افهمها أولا، وسيبقى عليك حفظ ثلث ما كنت ستحفظه.") + "</p>" +
        "<div class='hero-mascot'>" + mascotHtml("fennec", 84, "excited") +
          "<span>" + T("Je te montre.","سأريك.") + "</span></div>" +
        "<span class='hero-go'>" + PLAY_ICON + " " + T("Découvrir","اكتشف") + "</span>";
      hero.setAttribute("aria-label", TL("La Clé, leçon de découverte de deux minutes","المفتاح، درس اكتشاف في دقيقتين"));
      hero.onclick = function(){ startKey(hero); };
      return;
    }
    var anyDone = UNITS.some(function(x){ return (state.crowns[x.id]||0) >= 1; });
    if(due > 0 && anyDone){
      hero.classList.add("review");
      hero.innerHTML =
        "<p class='hero-kicker'>" + T("Le bon moment","الوقت المناسب") + "</p>" +
        "<p class='hero-title'>" + T(due + " wilaya" + (due>1?"s":"") + " à réviser", due + " ولاية للمراجعة") + "</p>" +
        "<p class='hero-sub'>" + TS("Elles arrivent au bord de l'oubli. Les revoir maintenant coûte une minute et vaut dix répétitions plus tard.",
                                    "إنها على حافة النسيان. مراجعتها الآن تكلّف دقيقة وتساوي عشر تكرارات لاحقا.") + "</p>" +
        "<div class='hero-mascot'>" + mascotHtml("cigogne", 78, "happy") +
          "<span>" + pickLine("streak") + "</span></div>" +
        "<span class='hero-go'>" + PLAY_ICON + " " + T("Réviser","راجع") + "</span>";
      hero.setAttribute("aria-label", TL(due + " wilayas à réviser", due + " ولاية للمراجعة"));
      hero.onclick = function(){ startReview(hero); };
      return;
    }
    var u = nextUnit();
    var crown = state.crowns[u.id] || 0;
    hero.innerHTML =
      "<p class='hero-kicker'>" + T("Prochaine étape","المرحلة التالية") + "</p>" +
      "<p class='hero-title'>" + T(num(u.label) + " · " + u.title, num(u.label) + " · " + (UNIT_AR[u.id]||"")) + "</p>" +
      "<p class='hero-sub'>" + (crown === 0
          ? TS("Nouvelle étape — 10 questions, cinq cœurs.","مرحلة جديدة — 10 أسئلة، خمسة قلوب.")
          : TS("Niveau " + crown + "/5. Rejoue pour monter d'une couronne.","المستوى " + crown + "/5. أعِد لترتقي بتاج.")) + "</p>" +
      "<div class='hero-mascot'>" + mascotHtml(UNIT_MASCOT[u.id], 78, "happy") +
        "<span>" + pickLine("greet") + "</span></div>" +
      "<span class='hero-go'>" + PLAY_ICON + " " + (crown === 0 ? T("Commencer","ابدأ") : T("Continuer","تابع")) + "</span>";
    hero.setAttribute("aria-label", TL("Prochaine étape " + u.label + ", " + u.title, "المرحلة التالية " + u.label));
    hero.onclick = function(){ startLesson(u, hero); };
  }

  /* Une couleur par étape, comme les bandeaux d'unité de Duolingo :
     ça casse la monotonie d'un parcours à une seule teinte. */
  var UNIT_COLORS = ["var(--accent)","var(--teal)","var(--slate)","var(--rose)","var(--olive)","var(--gold)"];

  function renderPath(){
    var track = document.getElementById("path-track");
    track.innerHTML = "";

    var keyRow = document.createElement("div");
    keyRow.className = "node-row off-l";
    var keyCol = document.createElement("div");
    keyCol.className = "node-col";
    var keyLine = document.createElement("div");
    keyLine.className = "node-line";
    var keyBtn = document.createElement("button");
    keyBtn.className = "node " + (state.keyDone ? "complete" : "current");
    keyBtn.innerHTML = state.keyDone ? CROWN_ICON
      : "<span style='font-size:.78rem;line-height:1.2;'>" + T("CLÉ","مفتاح") + "</span>";
    keyBtn.setAttribute("aria-label", TL("La Clé, leçon de la règle alphabétique. " +
      (state.keyDone ? "Terminée, rejouer." : "À faire en premier."), "المفتاح، درس القاعدة الأبجدية"));
    keyBtn.addEventListener("click", function(){ startKey(keyBtn); });
    keyLine.appendChild(keyBtn);
    var keyLabel = document.createElement("div");
    keyLabel.className = "node-label";
    keyLabel.innerHTML = T("La Clé","المفتاح");
    keyLabel.setAttribute("aria-hidden", "true");
    keyCol.appendChild(keyLine); keyCol.appendChild(keyLabel);
    keyRow.appendChild(keyCol); track.appendChild(keyRow);

    UNITS.forEach(function(u, i){
      var uColor = UNIT_COLORS[i % UNIT_COLORS.length];
      var conn = document.createElement("div");
      conn.className = "connector";
      conn.style.setProperty("--unit-color", uColor);
      track.appendChild(conn);

      var unlocked = unitUnlocked(u, i);
      var crown = state.crowns[u.id] || 0;
      var needsReview = unlocked && unitNeedsReview(u);

      var row = document.createElement("div");
      row.className = "node-row " + (i % 2 === 0 ? "off-r" : "off-l");
      var col = document.createElement("div");
      col.className = "node-col";
      var line = document.createElement("div");
      line.className = "node-line";

      var btn = document.createElement("button");
      btn.className = "node " + (!unlocked ? "locked" : (crown>0 ? "complete" : "current"));
      btn.style.setProperty("--unit-color", uColor);
      btn.setAttribute("aria-disabled", (!unlocked).toString());
      btn.innerHTML = !unlocked ? LOCK_ICON : (crown>0 ? CROWN_ICON : num(u.label));
      var stateText = !unlocked
        ? "verrouillée, termine l'étape précédente"
        : (crown<=0 ? "à commencer, activer pour lancer la leçon"
                    : ("niveau " + crown + " sur 5" + (needsReview?", révision conseillée":"") + ", activer pour lancer la leçon"));
      btn.setAttribute("aria-label",
        TL("Étape " + u.label + ", " + u.title + ", " + stateText,
           "مرحلة " + u.label + " · " + (UNIT_AR[u.id]||"")));
      if(needsReview){
        var badge = document.createElement("span");
        badge.className = "node-review";
        badge.setAttribute("aria-hidden", "true");
        btn.appendChild(badge);
      }
      btn.addEventListener("click", function(){
        if(unlocked) startLesson(u, btn);
        else toast(TL("Termine l'étape " + UNITS[i-1].label + " d'abord.",
                      "أنهِ أولا المرحلة " + UNITS[i-1].label));
      });
      line.appendChild(btn);

      var info = document.createElement("button");
      info.className = "node-info";
      info.innerHTML = INFO_ICON;
      info.setAttribute("aria-label", TL("Détails de l'étape " + u.label, "تفاصيل المرحلة " + u.label));
      info.addEventListener("click", function(){ openUnitSheet(u, unlocked, i); });
      line.appendChild(info);

      var label = document.createElement("div");
      label.className = "node-label";
      label.innerHTML = num(u.label);
      label.setAttribute("aria-hidden", "true");

      var pips = document.createElement("div");
      pips.className = "crown-row";
      pips.setAttribute("aria-hidden", "true");
      for(var p=0;p<5;p++){
        var pip = document.createElement("span");
        pip.className = "crown-pip" + (p<crown ? " on" : "");
        pips.appendChild(pip);
      }

      col.appendChild(line); col.appendChild(label); col.appendChild(pips);
      row.appendChild(col); track.appendChild(row);
    });

    renderHero();
    refreshTopStats();
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
