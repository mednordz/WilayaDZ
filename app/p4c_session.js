
  /* ============================================================
     MOTEUR DE SESSION
     Un seul runner pour tous les modes : leçon, révision,
     confusions, rafale et la leçon-découverte « La Clé ».
     ============================================================ */
  var session = {alive:false};
  var sessionPrevFocus = null;

  function weightedPick(codes, last){
    var cands = codes.filter(function(c){ return c !== last; });
    if(!cands.length) cands = codes.slice();
    var weights = cands.map(function(c){
      return Math.max(6 - getBox(c), 1) + (isDue(c) ? 3 : 0) + (state.progress[c] ? 0 : 2);
    });
    var total = weights.reduce(function(a,b){ return a+b; }, 0);
    var r = Math.random()*total;
    for(var i=0;i<cands.length;i++){ r -= weights[i]; if(r <= 0) return cands[i]; }
    return cands[cands.length-1];
  }

  function buildLessonQueue(unit){
    var pool = poolForTier(Math.max(unit.tier, state.tier));
    var codes = unit.pool.map(function(w){ return w.c; });
    /* Une première visite de chaque wilaya : aucune couverture laissée au hasard.
       Le format sera choisi au moment de l'affichage, après les réponses précédentes. */
    var q = shuffle(codes.slice()).map(function(code){
      return {kind:"adaptive", code:code, pool:pool};
    });
    /* Les exercices de structure restent disponibles sans certifier une association. */
    var chain = exChain(unit.pool);
    if(chain) q.push(chain);
    return q;
  }

  function buildReviewQueue(unit){
    var pool = unit ? unit.pool : poolForTier(state.tier);
    var due = dueCodes(pool).filter(function(w){return !((state.learning||{})[w.c]);});
    var q=due.map(function(w){ return {kind:"adaptive", code:w.c, pool:pool, due:state.progress[w.c].due||0}; });
    pool.forEach(function(w){
      var p=(state.learning||{})[w.c];if(!p)return;
      ['n','c'].forEach(function(k){if(p[k][3]&&p[k][2]<=Date.now()){
        var step=pilotStep(w.c,k);step.due=p[k][2];q.push(step);
      }});
    });
    return q.sort(function(a,b){return a.due-b.due;}).slice(0,15);
  }

  function buildConfusionQueue(){
    var pool = poolForTier(state.tier);
    var pairs = confusionPairs().slice(0, 6);
    var q = [];
    pairs.forEach(function(p){
      var e1 = exConfuse(p, pool); if(e1) q.push(e1);
      var e2 = exConfuse({a:p.b, b:p.a, n:p.n}, pool); if(e2) q.push(e2);
    });
    return shuffle(q);
  }

  function blitzGen(){
    var pool = poolForTier(state.tier);
    var codes = pool.map(function(w){ return w.c; });
    var c = weightedPick(codes, session.lastBlitz);
    session.lastBlitz = c;
    return (Math.random() < 0.5) ? exCode2Name(c, 4, pool) : exName2Code(c, 4, pool);
  }

  /* ---------------- Cycle de vie ---------------- */
  function startSession(cfg){
    sessionPrevFocus = cfg.trigger || document.activeElement;
    session = {
      alive: true,
      kind: cfg.kind,
      unit: cfg.unit || null,
      queue: cfg.queue || [],
      gen: cfg.gen || null,
      index: 0,
      hearts: (cfg.hearts === undefined) ? 5 : cfg.hearts,
      useHearts: cfg.hearts > 0 && cfg.kind === "blitz",
      retries: {}, unresolved: {}, scheduledRetries: 0,
      correct: 0, answered: 0, blitzScore: 0, done: false,
      combo: 0, comboMax: 0,
      locked: false, current: null, qStart: 0, lastBlitz: null,
      timeLimit: cfg.timeLimit || 0, endsAt: 0, timerId: null,
      label: cfg.label || "Leçon en cours"
    };

    var overlay = document.getElementById("lesson-overlay");
    overlay.classList.add("active");
    overlay.setAttribute("aria-label", session.label);

    var isBlitz = session.kind === "blitz";
    document.getElementById("lesson-hearts").style.display = (session.useHearts && !isBlitz) ? "flex" : "none";
    document.getElementById("blitz-timer").style.display = isBlitz ? "block" : "none";
    document.getElementById("blitz-score").style.display = isBlitz ? "block" : "none";
    document.getElementById("blitz-score").textContent = "0";

    var bar = document.getElementById("lesson-bar");
    bar.setAttribute("aria-valuemax", isBlitz ? 100 : session.queue.length);
    bar.setAttribute("aria-valuenow", 0);

    if(session.useHearts && !isBlitz) renderHearts();

    if(isBlitz){
      session.endsAt = Date.now() + session.timeLimit;
      session.timerId = window.setInterval(blitzTick, 200);
      blitzTick();
    }
    renderStep();
    document.getElementById("lesson-close").focus();
  }

  function blitzTick(){
    if(!session.alive) return;
    var left = Math.max(0, session.endsAt - Date.now());
    var secs = Math.ceil(left/1000);
    var t = document.getElementById("blitz-timer");
    t.textContent = secs;
    t.classList.toggle("low", secs <= 10);
    document.getElementById("lesson-bar-fill").style.width = (100*left/session.timeLimit) + "%";
    if(left <= 0){
      window.clearInterval(session.timerId);
      session.timerId = null;
      finishSession(true);
    }
  }

  function stopTimer(){
    if(session.timerId){ window.clearInterval(session.timerId); session.timerId = null; }
  }

  function closeSession(){
    stopTimer();
    session.alive = false;
    document.getElementById("lesson-overlay").classList.remove("active");
    var returnIndex=sessionPrevFocus&&sessionPrevFocus.getAttribute("data-i");
    renderPath();
    if(returnIndex!==null && /^\d+$/.test(returnIndex||""))sessionPrevFocus=document.querySelector('.noeud[data-i="'+returnIndex+'"]');
    refreshTopStats();
    refreshStats();
    refreshPracticeCards();
    buildLedger();
    renderSyncPanel();   /* le code de transfert doit toujours refléter l'état réel */
    if(sessionPrevFocus && typeof sessionPrevFocus.focus === "function" && document.body.contains(sessionPrevFocus)){
      sessionPrevFocus.focus({preventScroll:true});
    }else{
      document.getElementById("hero-card").focus({preventScroll:true});
    }
    sessionPrevFocus = null;
  }

  function requestCloseSession(){
    if(!session.alive) return;
    if(session.answered === 0){ closeSession(); return; }
    confirmDialog(TS("Quitter ? Ta progression sur cette session sera perdue.","تريد الخروج؟ سيضيع تقدّمك في هذه الجلسة."), TL("Quitter","اخرج")).then(function(ok){
      if(ok) closeSession();
    });
  }
  document.getElementById("lesson-close").addEventListener("click", requestCloseSession);

  function sessionKeydown(e){
    var overlay = document.getElementById("lesson-overlay");
    if(!overlay.classList.contains("active")) return;
    var cr = document.getElementById("confirm-root");
    if(cr && cr.firstChild) return;
    if(e.key === "Escape"){ e.preventDefault(); requestCloseSession(); return; }
    if(e.key === "Tab"){
      var f = Array.prototype.filter.call(
        overlay.querySelectorAll("button,[href],input,[tabindex]:not([tabindex='-1'])"),
        function(el){ return el.offsetParent !== null; });
      if(!f.length) return;
      var first = f[0], last = f[f.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener("keydown", sessionKeydown);

  function renderHearts(){
    var el = document.getElementById("lesson-hearts");
    var html = "";
    for(var i=0;i<5;i++){ html += (i < session.hearts) ? HEART_ICON : HEART_ICON_LOST; }
    el.innerHTML = html;
    el.setAttribute("aria-label", TL(session.hearts + " cœur" + (session.hearts===1?"":"s") +
      " restant" + (session.hearts===1?"":"s") + " sur 5", session.hearts + " قلوب متبقية من 5"));
  }

  /* ---------------- Série en cours (combo) ---------------- */
  function comboMilestone(n){
    return n === 3 || n === 5 || n === 8 || n === 12 || n === 20 || (n > 20 && n % 10 === 0);
  }
  function popCombo(n){
    var root = document.getElementById("lesson-overlay");
    if(!root) return;
    var el = document.createElement("div");
    el.className = "combo-pop";
    el.innerHTML = FLAME_ICON + " <span>" + T(n + " en série", n + " على التوالي") + "</span>";
    el.setAttribute("aria-hidden", "true");
    root.appendChild(el);
    window.setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }

  function announce(text){
    var live = document.getElementById("lesson-announcer");
    if(live){ live.textContent = ""; window.setTimeout(function(){ live.textContent = text; }, 30); }
  }

  function updateProgress(){
    if(session.kind === "blitz") return;
    var total = session.queue.length || 1;
    document.getElementById("lesson-bar-fill").style.width = Math.round((session.index/total)*100) + "%";
    var bar = document.getElementById("lesson-bar");
    bar.setAttribute("aria-valuemax", total);
    bar.setAttribute("aria-valuenow", session.index);
    bar.setAttribute("aria-valuetext", TL("Question " + Math.min(session.index+1, total) + " sur " + total, "سؤال " + Math.min(session.index+1, total) + " من " + total));
  }

  /* ---------------- Rendu d'une étape ---------------- */
  function renderStep(){
    if(!session.alive || session.done) return;
    session.locked = false;
    var spec;
    if(session.gen){
      spec = session.gen();
    }else{
      if(session.index >= session.queue.length){ finishSession(true); return; }
      spec = session.queue[session.index];
      if(spec.kind === "pilot-step"){
        var plannedPilot=spec;
        spec=pilotExercise(spec.code,spec.pilotSkill);spec.relearning=plannedPilot.relearning;
      }
      if(spec.kind === "adaptive"){
        var planned = spec;
        spec = exerciseFor(planned.code, planned.pool, false);
        spec.relearning = !!planned.relearning;
      }
    }
    session.current = spec;
    session.qStart = Date.now();
    updateProgress();
    var body = document.getElementById("lesson-body");
    if(spec.kind === "tell") renderTell(spec, body);
    else if(spec.kind === "chain") renderChain(spec, body);
    else if(spec.kind === "type") renderType(spec, body);
    else renderMCQ(spec, body);
    if(session.kind !== "blitz" && (spec.kind === "type" || spec.kind === "mcq")){
      var help = document.createElement("button");
      help.className = "btn ghost";
      help.id = "lesson-help";
      help.style.marginTop = "18px";
      help.innerHTML = T("Je ne sais pas · voir la réponse", "لا أعرف · أظهر الإجابة");
      help.addEventListener("click", function(){ answer(false, null, help, spec); });
      body.appendChild(help);
    }
  }

  function renderTell(spec, body){
    body.innerHTML =
      "<div class='key-step'>" + spec.html + "</div>" +
      "<div style='margin-top:26px;'><button class='btn' id='tell-next'>" + (spec.cta || T("Continuer","تابع")) + "</button></div>";
    if(typeof spec.after === "function") spec.after(body);
    var btn = document.getElementById("tell-next");
    btn.addEventListener("click", function(){
      if(spec.onContinue)spec.onContinue();
      session.index++;
      renderStep();
    });
    btn.focus();
  }

  var ALERT_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3l9.5 17H2.5L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/></svg>';

  function renderMCQ(spec, body){
    var html = "";
    if(spec.confuse){
      html += "<div class='confuse-banner'>" + ALERT_ICON +
              "<span>" + TS("Tu as déjà confondu ces deux-là. Prends une seconde de plus.",
                            "سبق أن خلطت بين هاتين. خذ ثانية إضافية.") + "</span></div>";
    }
    html += "<p class='lesson-prompt-label'>" + T(spec.label, spec.labelAr) + "</p>" +
            "<p class='lesson-prompt' id='lesson-prompt-focus' tabindex='-1'>" + spec.promptHtml + "</p>" +
            "<div class='lesson-choices' id='lesson-choices'></div>";
    body.innerHTML = html;
    var wrap = document.getElementById("lesson-choices");
    spec.options.forEach(function(opt){
      var b = document.createElement("button");
      b.className = "lesson-choice";
      b.innerHTML = T(opt.text, opt.ar, opt.keep ? "bi-keep" : "");
      b.setAttribute("data-correct", opt.correct ? "1" : "0");
      b.setAttribute("data-code", opt.code);
      b.setAttribute("aria-label", plain(TL(opt.text, opt.ar)));
      b.addEventListener("click", function(){ answer(opt.correct, opt.code, b, spec); });
      wrap.appendChild(b);
    });
    document.getElementById("lesson-prompt-focus").focus();
  }

  function renderType(spec, body){
    var labelTxt = TL(spec.label, spec.labelAr) + " " + spec.promptHtml.replace(/<[^>]*>/g, " ");
    body.innerHTML =
      "<p class='lesson-prompt-label'>" + T(spec.label, spec.labelAr) + "</p>" +
      "<p class='lesson-prompt' id='lesson-prompt-focus' tabindex='-1'>" + spec.promptHtml + "</p>" +
      "<div class='lesson-type-row'>" +
        "<label class='sr-only' for='lesson-type-input'>" + labelTxt + "</label>" +
        "<input type='text' inputmode='" + (spec.answerMode==='name'?'text':'numeric') + "' id='lesson-type-input' maxlength='" + (spec.answerMode==='name'?80:2) + "' placeholder='" + (spec.answerMode==='name'?'':'16') + "' autocomplete='off' aria-label=\"" + labelTxt + "\" />" +
        "<button class='btn' style='width:auto;' id='lesson-type-submit'>" + T("Valider","تحقّق") + "</button>" +
      "</div>";
    var inp = document.getElementById("lesson-type-input");
    function submit(){
      if(session.locked) return;
      if(spec.answerMode === 'name'){
        if(!inp.value.trim())return;
        answer(pilotMatchesName(spec.code,inp.value),null,null,spec);return;
      }
      var digits = inp.value.trim().replace(/[٠-٩]/g, function(c){return String(c.charCodeAt(0)-1632);})
        .replace(/[۰-۹]/g, function(c){return String(c.charCodeAt(0)-1776);});
      if(!/^\d{1,2}$/.test(digits)) return;
      var val = Number(digits);
      answer(val === spec.code, val, null, spec);
    }
    document.getElementById("lesson-type-submit").addEventListener("click", submit);
    inp.addEventListener("keydown", function(e){ if(e.key === "Enter") submit(); });
    inp.focus();
  }

  function renderChain(spec, body){
    body.innerHTML =
      "<p class='lesson-prompt-label'>" + T(spec.label, spec.labelAr) + "</p>" +
      "<p class='lesson-prompt' id='lesson-prompt-focus' tabindex='-1' style='font-size:1.02rem;'>" + spec.promptHtml + "</p>" +
      "<div class='chain-slots' id='chain-slots'></div>" +
      "<div class='chain-bank' id='chain-bank'></div>";
    var picked = [];
    function draw(){
      var slots = document.getElementById("chain-slots");
      slots.innerHTML = "";
      spec.order.forEach(function(_, i){
        var b = document.createElement("button");
        b.className = "chain-slot" + (picked[i] ? " filled" : "");
        b.innerHTML = picked[i] ? T(picked[i].n, ARABIC[picked[i].c] || "") : ((i+1) + "ᵉ");
        b.setAttribute("aria-label", picked[i]
          ? ("Position " + (i+1) + " : " + picked[i].n + ". Activer pour retirer.")
          : ("Position " + (i+1) + ", vide."));
        if(picked[i]) b.addEventListener("click", function(){ picked = picked.slice(0, i); draw(); });
        slots.appendChild(b);
      });
      var bank = document.getElementById("chain-bank");
      bank.innerHTML = "";
      spec.bank.forEach(function(w){
        var used = picked.some(function(p){ return p && p.c === w.c; });
        var b = document.createElement("button");
        b.className = "chain-chip" + (used ? " used" : "");
        b.innerHTML = T(w.n, ARABIC[w.c] || "");
        b.setAttribute("data-code", w.c);
        b.setAttribute("aria-label", wnameL(w) + (used ? ", déjà placé" : ", placer en position " + (picked.length+1)));
        if(!used){
          b.addEventListener("click", function(){
            picked.push(w);
            draw();
            if(picked.length === spec.order.length){
              var ok = picked.every(function(p, i){ return p.c === spec.order[i]; });
              answer(ok, ok ? spec.order[0] : picked[0].c, null, spec);
            }
          });
        }
        bank.appendChild(b);
      });
    }
    draw();
    document.getElementById("lesson-prompt-focus").focus();
  }

  /* ---------------- Réponse ---------------- */
  function answer(correct, chosenCode, el, spec){
    if(session.locked) return;
    session.locked = true;
    var ms = Date.now() - session.qStart;
    session.answered++;

    if(session.kind !== "blitz" && spec.code > 0 && !spec.noRecord){
      recordAnswer(spec.code, correct, ms, correct ? null : chosenCode, spec.fastLimit, spec);
      persist();   /* écrit à chaque réponse : quitter en cours ne perd plus rien */
    }
    if(spec.pilotSkill){
      pilotRecord(spec,correct);
      if(pilotLevel()>=2)state.crowns.u1=Math.max(state.crowns.u1||0,1);
      persist();
    }
    if(session.kind !== "blitz" && spec.code > 0 && (!spec.noRecord || spec.pilotSkill)){
      var evidenceKey=spec.pilotSkill ? spec.code+':'+spec.pilotSkill : spec.code;
      if(correct) delete session.unresolved[evidenceKey];
      else {
        session.unresolved[evidenceKey] = true;
        /* Une seule reprise par wilaya, six au maximum : pas de boucle punitive.
           Deux autres questions passent d'abord lorsque la file le permet. */
        if(!session.retries[evidenceKey] && session.scheduledRetries < 6){
          session.retries[evidenceKey] = true;
          session.scheduledRetries++;
          var pool = session.unit ? session.unit.pool : poolForTier(state.tier);
          var retry = spec.pilotSkill ? pilotStep(spec.code,spec.pilotSkill,true) : {kind:"adaptive", code:spec.code, pool:pool, relearning:true};
          session.queue.splice(Math.min(session.index+3, session.queue.length), 0, retry);
        }
      }
    }
    if(correct){
      session.correct++;
      session.combo = (session.combo||0) + 1;
      session.comboMax = Math.max(session.comboMax||0, session.combo);
    }else{
      session.combo = 0;
    }

    Array.prototype.forEach.call(document.querySelectorAll(".lesson-choice"), function(b){ b.disabled = true; });
    Array.prototype.forEach.call(document.querySelectorAll(".chain-chip,.chain-slot"), function(b){ b.disabled = true; });
    var sb = document.getElementById("lesson-type-submit");
    if(sb) sb.disabled = true;
    var help = document.getElementById("lesson-help");
    if(help) help.disabled = true;
    if(el) el.classList.add(correct ? "correct" : "wrong");
    if(!correct && spec.kind === "mcq"){
      Array.prototype.forEach.call(document.querySelectorAll(".lesson-choice"), function(b){
        if(b.getAttribute("data-correct") === "1") b.classList.add("correct");
      });
    }

    if(correct){
      tryVibrate(18);
      if(comboMilestone(session.combo)) sndCombo(); else sndCorrect();
    }else{
      tryVibrate([16,60,16]);
      sndWrong();
    }
    if(comboMilestone(session.combo)) popCombo(session.combo);

    if(session.kind === "blitz"){
      if(correct){
        session.blitzScore++;
        document.getElementById("blitz-score").textContent = session.blitzScore;
      }
      window.setTimeout(function(){ if(session.alive && !session.done) renderStep(); }, correct ? 240 : 780);
      return;
    }

    if(!correct && session.useHearts){ session.hearts--; renderHearts(); }

    var footer = document.createElement("div");
    footer.className = "lesson-footer show " + (correct ? "correct" : "wrong");
    footer.id = "lesson-footer";
    var msg = correct
      ? (CHECK_ICON + " " + T("Correct !","صحيح!"))
      : (CROSS_ICON + " " + T("Pas tout à fait — " + numIf(spec.answerText),
                              "ليس تماما — " + numIf(spec.answerText)));
    var note = (!correct && spec.note)
      ? "<div class='lesson-footer-note'>" + T(spec.note, spec.noteAr || "") + "</div>" : "";
    var retryNote = !correct && session.retries[spec.pilotSkill ? spec.code+':'+spec.pilotSkill : spec.code] && !spec.relearning
      ? "<div class='lesson-footer-note'>" + T("Prends le temps de retenir cette association. Tu pourras la retenter dans cette séance.","خذ وقتك لتذكّر هذا الربط. ستتمكن من المحاولة مجددا في هذه الجلسة.") + "</div>" : "";
    var who = (session.unit && UNIT_MASCOT[session.unit.id]) || "fennec";
    var mascotLine = "<div class='lesson-footer-mascot'>" + mascotHtml(who, 46, correct ? "happy" : "sad") +
      "<span>" + pickLine(correct ? "correct" : "wrong") + "</span></div>";
    footer.innerHTML =
      "<div class='lesson-footer-msg'>" + msg + "</div>" + note + retryNote + mascotLine +
      "<button class='btn' id='lesson-continue-btn'>" + T("Continuer","تابع") + "</button>";
    document.getElementById("lesson-body").appendChild(footer);
    footer.scrollIntoView({behavior:prefersReducedMotion()?"auto":"smooth", block:"end"});
    announce((correct ? "Correct." : "Pas tout à fait. La bonne réponse était " + spec.answerText + ".") +
             (spec.note && !correct ? " " + spec.note : ""));

    var cont = document.getElementById("lesson-continue-btn");
    cont.focus();
    cont.addEventListener("click", function(){
      session.index++;
      if(session.useHearts && session.hearts <= 0){ finishSession(false); return; }
      if(session.index >= session.queue.length){ finishSession(true); return; }
      renderStep();
    });
  }

  /* ---------------- Fin de session ---------------- */
  function finishSession(success){
    if(session.done) return;
    session.done = true;
    stopTimer();
    var body = document.getElementById("lesson-body");
    document.getElementById("lesson-bar-fill").style.width = "100%";
    var total = Math.max(session.answered, 1);
    var accuracy = Math.round((session.correct/total)*100);
    var xpGain = 0, title = "", sub = "", extra = "";
    var AGAIN = TS("Réessaie, tu vas y arriver.","أعد المحاولة، ستنجح.");
    var NOHEART = T("Plus de cœurs","نفدت القلوب");

    if(session.kind === "blitz"){
      xpGain = session.blitzScore * 3;
      var isRecord = session.blitzScore > (state.bestBlitz||0);
      if(isRecord) state.bestBlitz = session.blitzScore;
      title = T("Rafale terminée","انتهت الدفعة");
      sub = isRecord ? TS("Nouveau record personnel !","رقم قياسي جديد!")
                     : TS("Ton record : " + (state.bestBlitz||0) + ".","رقمك القياسي: " + (state.bestBlitz||0) + ".");
      extra = "<div class='result-stat'><span class='n'>" + session.blitzScore + "</span><span class='l'>" + TL("bonnes","صحيحة") + "</span></div>";
      if(session.blitzScore > 0) bumpStreak();
    }else if(session.kind === "key"){
      state.keyDone = true;
      xpGain = 40;
      title = T("La clé est à toi","المفتاح لك");
      sub = TS("Les codes 01–31 ne sont plus 31 faits, mais 9 blocs.","الرموز 01–31 لم تعد 31 معلومة، بل 9 كتل.");
      bumpStreak();
    }else if(session.kind === "review"){
      xpGain = success ? (session.correct*8 + 10) : session.correct*4;
      title = success ? T("Révision terminée","انتهت المراجعة") : NOHEART;
      sub = success ? TS("Ta mémoire vient d'être rafraîchie au bon moment.","تم إنعاش ذاكرتك في الوقت المناسب.") : AGAIN;
      if(success) bumpStreak();
    }else if(session.kind === "confuse"){
      xpGain = success ? (session.correct*8 + 10) : session.correct*4;
      title = success ? T("Paires démêlées","فُكّ الالتباس") : NOHEART;
      sub = success ? TS("Ces confusions devraient s'estomper.","من المفترض أن يخفّ هذا الالتباس.") : AGAIN;
      if(success) bumpStreak();
    }else{
      xpGain = success ? (session.correct*10 + 15) : Math.round(session.correct*5);
      title = success ? T("Leçon terminée !","انتهى الدرس!") : NOHEART;
      var streakBefore = state.streak.count || 0;
      if(success && session.kind !== "pilot" && session.unit && !Object.keys(session.unresolved).length){
        state.crowns[session.unit.id] = Math.min(5, (state.crowns[session.unit.id]||0)+1);
        bumpStreak();
      }
      sub = success
        ? ((state.streak.count > streakBefore) ? TS("Série +1 — continue comme ça.","السلسلة +1 — واصل هكذا.") : TS("Bien joué.","أحسنت."))
        : AGAIN;
    }

    if(session.kind === "pilot"){extra=pilotSummary();if(session.correct)bumpStreak();}
    var remaining = Object.keys(session.unresolved).length;
    if(remaining && session.kind !== "blitz"){
      sub = TS(remaining + " association(s) à reprendre. Tes réponses sont sauvegardées.",
        remaining + " روابط تحتاج إلى مراجعة. تم حفظ إجاباتك.");
    }

    /* La première tentative compte : corriger ensuite n'efface pas l'erreur. */
    var perfectEligible = success && session.answered > 0 &&
      (session.kind === "lesson" || session.kind === "review" || session.kind === "confuse");
    var perfect = perfectEligible && session.correct === session.answered;
    var bonusXp = perfect ? 8 : 0;
    xpGain += bonusXp;
    if(perfect){
      title = T("Leçon parfaite !","درس مثالي!");
      sub = TS("Toutes les réponses justes dès le premier essai — bonus.","كل الإجابات صحيحة من المحاولة الأولى — مكافأة.");
    }

    state.xp += xpGain;
    persist();
    refreshTopStats();

    var heartsStat = (session.useHearts && session.kind !== "blitz")
      ? "<div class='result-stat'><span class='n'>" + Math.max(session.hearts,0) + "/5</span><span class='l'>" + TL("cœurs","قلوب") + "</span></div>" : "";

    var mood = perfect ? "excited" : (success ? "happy" : "sad");
    var resultWho = (session.unit && UNIT_MASCOT[session.unit.id]) || "fennec";
    var mascotBlock = "<div class='result-mascot'>" + mascotHtml(resultWho, 110, mood) +
      "<span>" + pickLine(perfect ? "perfect" : (success ? "success" : "fail")) + "</span></div>";

    body.innerHTML =
      "<div class='result-screen" + (perfect ? " perfect" : "") + "'>" +
        (success ? "<div class='confetti' id='result-confetti' aria-hidden='true'></div>" : "") +
        "<div class='result-badge " + (success?"success":"fail") + "'>" + (success ? CHECK_ICON : CROSS_ICON) + "</div>" +
        "<h2 id='result-heading' tabindex='-1'>" + title + "</h2>" +
        "<p style='color:var(--ink-dim); margin:-8px 0 0;'>" + sub + "</p>" +
        mascotBlock +
        "<div class='result-stats'>" +
          "<div class='result-stat'><span class='n' id='result-xp-n'>+0</span><span class='l'>XP</span></div>" +
          (extra || "<div class='result-stat'><span class='n'>" + accuracy + "%</span><span class='l'>" + TL("précision","دقة") + "</span></div>") +
          heartsStat +
        "</div>" +
        "<div class='result-actions'>" +
          (success
            ? "<button class='btn' id='result-continue'>" + T("Continuer","تابع") + "</button>"
            : "<button class='btn' id='result-retry'>" + T("Réessayer","أعد المحاولة") + "</button>") +
          "<button class='btn ghost' id='result-close'>" + T("Retour au parcours","العودة إلى المسار") + "</button>" +
        "</div>" +
      "</div>";

    var cont = document.getElementById("result-continue");
    if(cont) cont.addEventListener("click", closeSession);
    var retry = document.getElementById("result-retry");
    if(retry) retry.addEventListener("click", function(){
      if(session.unit) startLesson(session.unit);
      else closeSession();
    });
    document.getElementById("result-close").addEventListener("click", closeSession);
    tryVibrate(success ? [20,40,20,40,30] : [40,80,40]);
    if(success){ if(perfect) sndPerfect(); else sndComplete(); spawnConfetti(perfect); }
    else{ sndFail(); }
    countUpXp(xpGain);
    document.getElementById("result-heading").focus();
    announce(String(title).replace(/<[^>]*>/g," ") + ". " + accuracy + " % — " + xpGain + " XP.");
  }

  /* ---------------- Célébration de fin de session ---------------- */
  function countUpXp(target){
    var el = document.getElementById("result-xp-n");
    if(!el){ return; }
    if(target <= 0){ el.textContent = "+0"; return; }
    var start = null, dur = 550;
    function step(ts){
      if(start === null) start = ts;
      var p = Math.min(1, (ts-start)/dur);
      var v = Math.round(target * (1 - Math.pow(1-p, 3)));
      el.textContent = "+" + v;
      if(p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }
  function spawnConfetti(big){
    var root = document.getElementById("result-confetti");
    if(!root) return;
    var colors = ["var(--accent-bright)","var(--teal)","var(--gold)","var(--rose)","var(--slate)","var(--grape)"];
    var n = big ? 46 : 26;
    var html = "";
    for(var i=0;i<n;i++){
      var left = Math.round(Math.random()*100);
      var delay = (Math.random()*0.25).toFixed(2);
      var dur = (1.1 + Math.random()*0.9).toFixed(2);
      var rot = Math.round(Math.random()*360);
      var c = colors[i % colors.length];
      var shape = (i % 3 === 0) ? "round" : "";
      html += "<span class='confetto " + shape + "' style='left:" + left + "%; background:" + c +
              "; animation-delay:" + delay + "s; animation-duration:" + dur + "s; --rot:" + rot + "deg;'></span>";
    }
    root.innerHTML = html;
  }

  /* ---------------- Lanceurs ---------------- */
  function startLesson(unit, trigger){
    if(unit.id === "u1"){startPilot(trigger);return;}
    startSession({kind:"lesson", unit:unit, queue:buildLessonQueue(unit),
                  label:TL("Leçon " + unit.label, "درس " + unit.label), trigger:trigger});
  }
  function startReview(trigger,unit){
    if(unit && unit.id === "u1"){startPilot(trigger);return;}
    if(unit && !unitUnlocked(unit,UNITS.indexOf(unit)))return;
    var q = buildReviewQueue(unit);
    if(!q.length){ toast(TL("Rien à réviser pour l'instant.","لا شيء للمراجعة الآن.")); return; }
    startSession({kind:"review", unit:unit || null, queue:q, label:unit?TL("Révision · "+unit.label,"مراجعة · "+unit.label):TL("Révision du jour","مراجعة اليوم"), trigger:trigger});
  }
  function startConfusion(trigger){
    var q = buildConfusionQueue();
    if(!q.length){ toast(TL("Aucune paire de confusion détectée.","لم يُرصد أي التباس.")); return; }
    startSession({kind:"confuse", queue:q, label:TL("Tes confusions","التباساتك"), trigger:trigger});
  }
  function startBlitz(trigger){
    startSession({kind:"blitz", gen:blitzGen, hearts:0, timeLimit:60000,
                  label:TL("Rafale, 60 secondes","دفعة، 60 ثانية"), trigger:trigger});
  }
