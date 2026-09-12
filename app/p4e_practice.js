
  /* ============================================================
     ENTRAÎNEMENT LIBRE
     ============================================================ */
  function pickNext(pool, exclude){
    var candidates = pool.filter(function(w){ return !exclude || w.c !== exclude.c; });
    if(!candidates.length) candidates = pool.slice();
    var due = candidates.filter(function(w){ return isDue(w.c); });
    var source = due.length ? due : candidates;
    var weights = source.map(function(w){ return Math.max(6 - getBox(w.c), 1); });
    var total = weights.reduce(function(a,b){ return a+b; }, 0);
    var r = Math.random()*total;
    for(var i=0;i<source.length;i++){ r -= weights[i]; if(r <= 0) return source[i]; }
    return source[source.length-1];
  }

  function refreshStats(){
    var total = state.pool.length;
    var mastered = state.pool.filter(function(w){ return getBox(w.c) >= 5; }).length;
    var due = state.pool.filter(function(w){ return state.progress[w.c] && isDue(w.c); }).length;
    document.getElementById("stat-session").textContent = state.sessionCorrect + "/" + state.sessionTotal;
    document.getElementById("stat-mastered").textContent = mastered;
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-due").textContent = due;
  }

  function newQuestion(){
    state.locked = false;
    var feedback = document.getElementById("feedback");
    feedback.textContent = ""; feedback.className = "feedback";
    var choiceArea = document.getElementById("choice-area");
    var typeArea = document.getElementById("typein-area");
    var w = pickNext(state.pool, state.current);
    state.current = w;

    var labelEl = document.getElementById("prompt-label");
    var textEl = document.getElementById("prompt-text");

    if(state.mode === "typein"){
      choiceArea.style.display = "none";
      typeArea.style.display = "flex";
      labelEl.innerHTML = T("Quel est le code de…","ما رمز…");
      textEl.innerHTML = wnameBig(w);
      state.currentAnswer = w.c;
      var inp = document.getElementById("typein-input");
      inp.value = ""; inp.disabled = false;
      document.getElementById("typein-submit").disabled = false;
      return;
    }

    choiceArea.style.display = "grid";
    typeArea.style.display = "none";
    choiceArea.innerHTML = "";

    var spec;
    if(state.mode === "neighbors"){
      spec = exNeighbor(w.c, state.pool) || exCode2Name(w.c, 4, state.pool);
    }else if(state.mode === "name2code"){
      spec = exName2Code(w.c, 4, state.pool);
    }else{
      spec = exCode2Name(w.c, 4, state.pool);
    }
    state.currentSpec = spec;
    labelEl.innerHTML = T(spec.label, spec.labelAr);
    textEl.innerHTML = spec.promptHtml;
    spec.options.forEach(function(opt){
      var b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = T(opt.text, opt.ar, opt.keep ? "bi-keep" : "");
      b.setAttribute("data-correct", opt.correct ? "1" : "0");
      b.setAttribute("aria-label", plain(TL(opt.text, opt.ar)));
      b.addEventListener("click", function(){ answerFree(opt.correct, opt.code, b, spec); });
      choiceArea.appendChild(b);
    });
  }

  function answerFree(correct, chosenCode, el, spec){
    if(state.locked) return;
    state.locked = true;
    state.sessionTotal++;
    if(correct) state.sessionCorrect++;
    recordAnswer(spec.code, correct, null, correct ? null : chosenCode, spec.fastLimit);
    persist();

    var choiceArea = document.getElementById("choice-area");
    Array.prototype.forEach.call(choiceArea.children, function(b){ b.disabled = true; });
    if(el) el.classList.add(correct ? "correct" : "wrong");
    if(!correct){
      Array.prototype.forEach.call(choiceArea.children, function(b){
        if(b.getAttribute("data-correct") === "1") b.classList.add("correct");
      });
    }
    var feedback = document.getElementById("feedback");
    feedback.innerHTML = correct ? T("Correct.","صحيح.")
                                 : T("Non — " + numIf(spec.answerText), "لا — " + numIf(spec.answerText));
    feedback.className = "feedback " + (correct ? "correct" : "wrong");
    refreshStats();
    window.setTimeout(newQuestion, correct ? 650 : 1600);
  }

  function submitTypein(){
    if(state.locked) return;
    var inp = document.getElementById("typein-input");
    var val = parseInt(inp.value, 10);
    if(isNaN(val)) return;
    state.locked = true;
    state.sessionTotal++;
    var correct = val === state.currentAnswer;
    if(correct) state.sessionCorrect++;
    recordAnswer(state.currentAnswer, correct, null, correct ? null : val, FAST_TYPE);
    persist();
    inp.disabled = true;
    document.getElementById("typein-submit").disabled = true;
    var feedback = document.getElementById("feedback");
    feedback.innerHTML = correct
      ? T("Correct.","صحيح.")
      : T("Non — " + state.current.n + " = " + pad(state.current.c),
          "لا — " + (ARABIC[state.current.c] || state.current.n) + " = " + pad(state.current.c));
    feedback.className = "feedback " + (correct ? "correct" : "wrong");
    refreshStats();
    window.setTimeout(newQuestion, correct ? 650 : 1600);
  }
  document.getElementById("typein-submit").addEventListener("click", submitTypein);
  document.getElementById("typein-input").addEventListener("keydown", function(e){
    if(e.key === "Enter") submitTypein();
  });
  document.getElementById("skip-btn").addEventListener("click", function(){ newQuestion(); });

  document.getElementById("reset-progress").addEventListener("click", function(){
    confirmDialog(TS("Réinitialiser la progression de ce compte sur tous tes appareils (parcours, XP, série, confusions) ? La remise à zéro sera transmise au retour de la connexion.",
                     "إعادة ضبط تقدّم هذا الحساب على كل أجهزتك (المسار، النقاط، السلسلة، الالتباسات)؟ ستُنقل إعادة الضبط عند عودة الاتصال."), TL("Réinitialiser","أعد الضبط"))
      .then(function(ok){
        if(!ok) return;
        resetProgress();
        state.sessionCorrect = 0; state.sessionTotal = 0;
        persist(); refreshStats(); refreshTopStats(); newQuestion();
        renderPath(); refreshPracticeCards(); buildLedger(); renderSyncPanel();
        toast(TL("Progression réinitialisée.","أُعيد ضبط التقدّم."));
      });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".tier-btn"), function(btn){
    btn.addEventListener("click", function(){
      Array.prototype.forEach.call(document.querySelectorAll(".tier-btn"), function(b){
        b.classList.remove("active"); b.setAttribute("aria-checked","false");
      });
      btn.classList.add("active"); btn.setAttribute("aria-checked","true");
      state.tier = parseInt(btn.getAttribute("data-tier"), 10);
      state.pool = poolForTier(state.tier);
      refreshStats(); newQuestion(); buildMap(); refreshPracticeCards(); renderHero();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".mode-btn"), function(btn){
    btn.addEventListener("click", function(){
      Array.prototype.forEach.call(document.querySelectorAll(".mode-btn"), function(b){
        b.classList.remove("active"); b.setAttribute("aria-checked","false");
      });
      btn.classList.add("active"); btn.setAttribute("aria-checked","true");
      state.mode = btn.getAttribute("data-mode");
      newQuestion();
    });
  });

  /* ---------------- Cartes d'action + prévision ---------------- */
  function refreshPracticeCards(){
    var due = dueCodes(poolForTier(state.tier)).length;
    var rev = document.getElementById("act-review");
    document.getElementById("act-review-sub").innerHTML =
      due ? TS(due + " wilaya" + (due>1?"s":"") + " au bord de l'oubli.", due + " ولاية على حافة النسيان.")
          : TS("Rien d'urgent. Ta mémoire tient.","لا شيء عاجل. ذاكرتك صامدة.");
    rev.setAttribute("aria-disabled", due ? "false" : "true");

    var pairs = confusionPairs();
    var cf = document.getElementById("act-confuse");
    document.getElementById("act-confuse-sub").innerHTML =
      pairs.length ? TS(pairs.length + " paire" + (pairs.length>1?"s":"") + " que tu mélanges vraiment.",
                        pairs.length + " زوج تخلط بينها فعلا.")
                   : TS("Aucune paire détectée pour l'instant.","لم يُرصد أي زوج بعد.");
    cf.setAttribute("aria-disabled", pairs.length ? "false" : "true");

    renderForecast();
  }

  function renderForecast(){
    var pool = poolForTier(state.tier);
    var buckets = [
      {label:"Jamais vues", ar:"لم تُرَ بعد", test:function(c){ return !state.progress[c]; } },
      {label:"Fragiles",    ar:"هشّة",        test:function(c){ return state.progress[c] && getBox(c) <= 2; } },
      {label:"Solides",     ar:"متينة",       test:function(c){ return state.progress[c] && getBox(c) >= 3 && getBox(c) < 5; } },
      {label:"Ancrées",     ar:"راسخة",       test:function(c){ return state.progress[c] && getBox(c) >= 5; } }
    ];
    var total = pool.length || 1;
    var rows = buckets.map(function(b){
      var n = pool.filter(function(w){ return b.test(w.c); }).length;
      var pct = Math.round((n/total)*100);
      return "<div class='forecast-row'>" +
               "<span style='min-width:132px;'>" + T(b.label, b.ar) + "</span>" +
               "<span class='forecast-bar'><i style='width:" + pct + "%;'></i></span>" +
               "<span class='v'>" + n + "</span>" +
             "</div>";
    }).join("");
    var best = state.bestBlitz ? ("<p class='section-note' style='margin:10px 0 0;'>" +
      T("Record en Rafale : <b>" + state.bestBlitz + "</b> en 60 s.", "رقم الدفعة القياسي: <b>" + state.bestBlitz + "</b> في 60 ث") + "</p>") : "";
    document.getElementById("forecast-rows").innerHTML = rows + best;
  }

  document.getElementById("act-review").addEventListener("click", function(){ startReview(this); });
  document.getElementById("act-blitz").addEventListener("click", function(){ startBlitz(this); });
  document.getElementById("act-confuse").addEventListener("click", function(){ startConfusion(this); });
  document.getElementById("act-free").addEventListener("click", function(){
    document.getElementById("quiz-section").scrollIntoView({behavior:prefersReducedMotion()?"auto":"smooth", block:"start"});
    document.getElementById("prompt-text").focus();
  });

  /* ============================================================
     REGISTRE, INDICES, BLOCS, CARTE
     ============================================================ */
  function buildLedger(){
    var body = document.getElementById("ledger-body");
    var regions = ["Centre","Est","Ouest","Sud","Hauts Plateaux"];
    body.innerHTML = "";
    regions.forEach(function(region){
      var items = DATA.filter(function(w){ return w.r === region; }).sort(function(a,b){ return a.c-b.c; });
      if(!items.length) return;
      var heading = document.createElement("tr");
      heading.className = "region-heading";
      var td = document.createElement("td"); td.colSpan = 3;
      td.textContent = region + " — " + items.length + " wilaya" + (items.length>1?"s":"");
      heading.appendChild(td); body.appendChild(heading);
      items.forEach(function(w){
        var box = getBox(w.c);
        var pct = Math.round((box/5)*100);
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td class='code'>" + pad(w.c) + "</td>" +
          "<td>" + wname(w) + "</td>" +
          "<td><span class='mini-bar' role='img' aria-label='" + TL("Force " + box + " sur 5", "قوة " + box + " من 5") + "'><i style='width:" + pct + "%;'></i></span></td>";
        body.appendChild(tr);
      });
    });
  }

  function buildFullHooks(){
    var list = document.getElementById("full-hooks-list");
    list.innerHTML = "";
    HOOKS.forEach(function(h){
      var b = blockOf(h[0]);
      var extra = b ? (" <span style='color:var(--ink-faint);'>· bloc <span dir='rtl' lang='ar'>" + b.ar + "</span> " + blockLabel(b) + "</span>") : "";
      var w = byCode(h[0]);
      var div = document.createElement("div"); div.className = "hook";
      div.innerHTML = "<div class='code'>" + pad(h[0]) + "</div><div class='body'>" +
        (w ? wname(w) : ("<b>" + h[1] + "</b>")) +
        "<span style='display:block;margin-top:4px;'>" + h[2] + extra + "</span></div>";
      list.appendChild(div);
    });
  }

  function buildMethodBlocks(){
    document.getElementById("method-blocks").innerHTML = BLOCKS.map(function(b){
      return "<div class='block-row on'>" +
               "<div class='block-ar' dir='rtl' lang='ar'>" + b.ar + "</div>" +
               "<div class='block-range'>" + blockLabel(b) + "</div>" +
               "<div class='block-names'>" + TS(b.note, b.noteAr) + "</div>" +
             "</div>";
    }).join("");
  }

  function buildAnchorHooks(){
    var el = document.getElementById("anchor-hooks");
    if(!el) return;
    var rows = [
      [16, "Alger ouvre le bloc <span dir='rtl' lang='ar'>ج</span> : premier nom du pays, premier de sa lettre.",
           "الجزائر تفتح كتلة ج: أول اسم في البلاد، وأول حرفه."],
      [31, "Oran ferme 1974 : <span dir='rtl' lang='ar'>و</span> est la dernière lettre utilisée.",
           "وهران تختم 1974: و هو آخر حرف مستعمل."],
      [9,  "Blida est dans le gros bloc <span dir='rtl' lang='ar'>ب</span> (05–10) : six wilayas en B d'affilée.",
           "البليدة في كتلة ب الكبيرة (05–10): ست ولايات متتالية."]
    ];
    el.innerHTML = rows.map(function(r){
      var w = byCode(r[0]);
      return "<div class='hook'><div class='code'>" + pad(r[0]) + "</div><div class='body'>" +
               wname(w) + "<span style='display:block;margin-top:5px;'>" + TS(r[1], r[2]) + "</span>" +
             "</div></div>";
    }).join("");
  }

  /* ============================================================
     INIT — le profil décide de tout ce qui suit
     ============================================================ */
  applyLang("bi");
  loadAccount();
  state.pool = poolForTier(state.tier);
  buildFullHooks();
  buildMethodBlocks();
  buildAnchorHooks();
  buildMap();
  buildLedger();
  poserImagesKit();
  /* Reprend la musique là où le réglage l'avait laissée. Si le
     navigateur refuse (aucun geste depuis l'ouverture), elle se réarme
     toute seule sur le premier clic — voir musiqueArmerGeste(). */
  musiqueAppliquer();
  initSyncPanel();

  /* Un lien de réinitialisation reçu par courriel passe avant tout le
     reste : la personne est bloquée dehors, c'est la seule chose qui
     l'intéresse en ouvrant l'application. */
  loadCloudConfig();
  var googleBack = googlePendingReturn();
  var pendingConfirm = cloudPendingConfirm();
  var pendingReset = cloudPendingReset();
  var startProfile = activeProfile();
  if(googleBack){
    showGate("googling", googleBack);
  }else if(pendingConfirm){
    showGate("confirming", pendingConfirm);
  }else if(pendingReset){
    showGate("reset", pendingReset);
  }else if(cloudPending()){
    /* Inscription faite, adresse pas encore confirmée : on ne laisse pas
       entrer, sinon la confirmation ne servirait à rien. */
    showGate("pending");
  }else if(!account.profiles.length){
    showGate("create");
  }else if(!startProfile){
    showGate("pick");
  }else if(!cloudOf(startProfile)){
    /* Profil d'avant les comptes : le rattachement passe avant l'entrée.
       Sa progression part sur le compte, elle n'est pas remplacée. */
    showGate("create", startProfile);
  }else if(startProfile.pin){
    showGate("pin", startProfile);
  }else{
    bootProfile();
  }
