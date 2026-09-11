
  /* ============================================================
     GÉNÉRATEURS D'EXERCICES — tout est bilingue
     {kind, code, label, labelAr, promptHtml, options[], answerText, fastLimit, note}
     Chaque option porte son texte français ET arabe : personne
     n'est bloqué, et le code chiffré sert de pivot commun.
     ============================================================ */

  function distractors(code, n, pool){
    var picked = [], used = {};
    used[code] = true;
    function add(c){
      if(used[c]) return;
      var w = byCode(c);
      if(!w) return;
      if(!pool.some(function(p){ return p.c === c; })) return;
      used[c] = true; picked.push(w);
    }
    var conf = state.confusions[code];
    if(conf){
      Object.keys(conf).sort(function(a,b){ return conf[b]-conf[a]; })
        .forEach(function(c){ if(picked.length < n) add(parseInt(c,10)); });
    }
    var b = blockOf(code);
    if(b) shuffle(range(b.lo, b.hi)).forEach(function(c){ if(picked.length < n) add(c); });
    shuffle([code-1, code+1, code-2, code+2, code-3, code+3])
      .forEach(function(c){ if(picked.length < n) add(c); });
    shuffle(pool.slice()).forEach(function(w){ if(picked.length < n) add(w.c); });
    return picked.slice(0, n);
  }
  function range(lo, hi){ var a=[]; for(var i=lo;i<=hi;i++) a.push(i); return a; }

  /* Un nom de wilaya est du contenu : il reste dans les deux
     écritures quel que soit le mode de langue choisi. */
  function optName(w, correct){
    return {text:w.n, ar:ARABIC[w.c] || "", code:w.c, correct:!!correct, keep:true};
  }
  function optCode(w, correct){
    return {text:pad(w.c), ar:"", code:w.c, correct:!!correct};
  }

  function exCode2Name(code, nOpts, pool){
    var w = byCode(code);
    var opts = distractors(code, nOpts-1, pool).map(function(x){ return optName(x, false); });
    opts.push(optName(w, true));
    return {
      kind:"mcq", code:code,
      label:"Quelle wilaya porte ce code ?", labelAr:"أي ولاية تحمل هذا الرمز؟",
      promptHtml:"<span class='code'>" + pad(code) + "</span>",
      options:shuffle(opts), answerText:wnameL(w), fastLimit:FAST_MCQ, note:noteFor(code)
    };
  }
  function exName2Code(code, nOpts, pool){
    var w = byCode(code);
    var opts = distractors(code, nOpts-1, pool).map(function(x){ return optCode(x, false); });
    opts.push(optCode(w, true));
    return {
      kind:"mcq", code:code,
      label:"Quel est le code de…", labelAr:"ما رمز…",
      promptHtml:wnameBig(w), options:shuffle(opts), answerText:pad(code),
      fastLimit:FAST_MCQ, note:noteFor(code)
    };
  }
  function exType(code){
    var w = byCode(code);
    return {
      kind:"type", code:code,
      label:"Écris le code de…", labelAr:"اكتب رمز…",
      promptHtml:wnameBig(w), answerText:pad(code), fastLimit:FAST_TYPE, note:noteFor(code)
    };
  }
  function exBlock(code){
    var b = blockOf(code);
    if(!b) return null;
    var w = byCode(code);
    var others = shuffle(BLOCKS.filter(function(x){ return x !== b; })).slice(0,3);
    /* « 05–10  ب » est déjà lisible dans les deux langues : chiffres
       latins et lettre arabe. On sert donc la même chaîne des deux
       côtés pour que la plage ne disparaisse jamais. */
    function blockOpt(x, ok){
      var t = num(blockLabel(x)) + "&nbsp;&nbsp; " + x.ar;
      return {text:t, ar:t, code:-x.lo, correct:!!ok};
    }
    var opts = others.map(function(x){ return blockOpt(x, false); });
    opts.push(blockOpt(b, true));
    return {
      kind:"mcq", code:code,
      label:"Dans quel bloc alphabétique tombe…", labelAr:"في أي كتلة أبجدية تقع…",
      promptHtml:wnameBig(w), options:shuffle(opts), answerText:blockLabel(b),
      fastLimit:FAST_MCQ,
      note:"Bloc " + b.ar + " (" + b.tr + ") : " + blockLabel(b) + " — " + b.note,
      noteAr:"الكتلة " + b.ar + ": " + blockLabel(b)
    };
  }
  function exNeighbor(code, pool){
    var sorted = pool.slice().sort(function(a,b){ return a.c-b.c; });
    var idx = -1;
    for(var i=0;i<sorted.length;i++){ if(sorted[i].c === code){ idx=i; break; } }
    if(idx < 0) return null;
    var hasPrev = idx > 0, hasNext = idx < sorted.length-1;
    if(!hasPrev && !hasNext) return null;
    var dir = (hasPrev && hasNext) ? (Math.random()<0.5?"prev":"next") : (hasNext?"next":"prev");
    var ans = dir === "next" ? sorted[idx+1] : sorted[idx-1];
    var w = byCode(code);
    var opts = distractors(ans.c, 3, pool).filter(function(x){ return x.c !== ans.c; }).slice(0,3)
      .map(function(x){ return {text:num(pad(x.c)) + " " + x.n, ar:num(pad(x.c)) + " " + (ARABIC[x.c]||x.n), code:x.c, correct:false, keep:true}; });
    opts.push({text:num(pad(ans.c)) + " " + ans.n, ar:num(pad(ans.c)) + " " + (ARABIC[ans.c]||ans.n), code:ans.c, correct:true, keep:true});
    return {
      kind:"mcq", code:ans.c,
      label: dir==="next" ? "Quel code vient juste après…" : "Quel code vient juste avant…",
      labelAr: dir==="next" ? "ما الرمز الذي يأتي مباشرة بعد…" : "ما الرمز الذي يأتي مباشرة قبل…",
      promptHtml: wnameBig(w) + "<span class='sub'>" + pad(code) + "</span>",
      options:shuffle(opts), answerText:pad(ans.c) + " " + wnameL(ans), fastLimit:FAST_MCQ
    };
  }
  function exGap(pool){
    var sorted = pool.slice().sort(function(a,b){ return a.c-b.c; });
    if(sorted.length < 6) return null;
    var i = Math.floor(Math.random()*(sorted.length-4));
    var d = 2 + Math.floor(Math.random()*3);
    var a = sorted[i], b = sorted[Math.min(i+d, sorted.length-1)];
    if(a.c === b.c) return null;
    var gap = b.c - a.c;
    var set = {}; set[gap] = true;
    var opts = [{text:String(gap), ar:"", code:-1000-gap, correct:true}];
    var tries = 0;
    while(opts.length < 4 && tries < 30){
      tries++;
      var g = Math.max(1, gap + (Math.floor(Math.random()*7)-3));
      if(set[g]) continue;
      set[g] = true;
      opts.push({text:String(g), ar:"", code:-1000-g, correct:false});
    }
    return {
      kind:"mcq", code:b.c,
      label:"Combien de codes séparent…", labelAr:"كم رمزا يفصل…",
      promptHtml:"<span class='code'>" + pad(a.c) + "</span>" + wname(a) +
                 "<span class='sub'>↓</span>" + wname(b),
      options:shuffle(opts), answerText:String(gap), fastLimit:FAST_MCQ,
      note: wnameL(a) + " = " + pad(a.c) + ", " + wnameL(b) + " = " + pad(b.c) + " → " + gap + ".",
      noteAr: pad(a.c) + " ← → " + pad(b.c) + " : " + gap
    };
  }
  function exChain(pool){
    var sorted = pool.slice().sort(function(a,b){ return a.c-b.c; });
    var len = Math.min(4, sorted.length);
    if(len < 3) return null;
    var start = Math.floor(Math.random()*(sorted.length-len+1));
    var run = sorted.slice(start, start+len);
    return {
      kind:"chain", code:run[0].c,
      label:"Remets ces wilayas dans l'ordre des codes",
      labelAr:"رتّب هذه الولايات حسب الرموز",
      promptHtml:T("Du plus petit au plus grand", "من الأصغر إلى الأكبر"),
      order: run.map(function(w){ return w.c; }),
      bank: shuffle(run.slice()),
      answerText: run.map(function(w){ return pad(w.c) + " " + w.n; }).join(" · "),
      fastLimit: 20000
    };
  }
  function exConfuse(pair, pool){
    var a = byCode(pair.a), b = byCode(pair.b);
    if(!a || !b) return null;
    var note = wnameL(a) + " = " + pad(a.c) + "  ·  " + wnameL(b) + " = " + pad(b.c);
    if(Math.random() < 0.5){
      return {
        kind:"mcq", code:a.c,
        label:"Paire piège — quelle wilaya ?", labelAr:"زوج مُلبِس — أي ولاية؟",
        promptHtml:"<span class='code'>" + pad(a.c) + "</span>",
        options:shuffle([optName(a, true), optName(b, false)]),
        answerText:wnameL(a), fastLimit:FAST_MCQ, confuse:true, note:note
      };
    }
    return {
      kind:"mcq", code:a.c,
      label:"Paire piège — quel code ?", labelAr:"زوج مُلبِس — أي رمز؟",
      promptHtml:wnameBig(a),
      options:shuffle([optCode(a, true), optCode(b, false)]),
      answerText:pad(a.c), fastLimit:FAST_MCQ, confuse:true, note:note
    };
  }

  function noteFor(code){
    var b = blockOf(code);
    if(b) return "Bloc " + b.ar + " (" + b.tr + ") : " + blockLabel(b) + ".";
    for(var i=0;i<HOOKS.length;i++){ if(HOOKS[i][0] === code) return HOOKS[i][1] + " — " + HOOKS[i][2]; }
    return null;
  }

  function exerciseFor(code, pool, allowExotic){
    var lvl = ladderFor(code);
    var r = Math.random();
    if(allowExotic){
      if(blockOf(code) && getBox(code) <= 1 && r < 0.22){
        var eb = exBlock(code); if(eb) return eb;
      }
      if(r > 0.90){ var en = exNeighbor(code, pool); if(en) return en; }
    }
    if(lvl === "type") return exType(code);
    var n = (lvl === "mcq6") ? 6 : 4;
    return (Math.random() < 0.5) ? exCode2Name(code, n, pool) : exName2Code(code, n, pool);
  }
