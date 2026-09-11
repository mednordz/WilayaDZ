
  /* ============================================================
     INTERFACE DES PROFILS
     ============================================================ */
  var USER_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0115 0"/></svg>';
  var LOCKSM_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';

  /* Le sélecteur de langue reste volontairement écrit dans les deux
     langues et n'est jamais masqué : c'est le seul endroit où l'on
     ne peut pas encore savoir ce que la personne lit. */
  function langPickerHtml(current){
    var opts = [
      ["fr", "Français", "Interface en français", "الواجهة بالفرنسية"],
      ["ar", "العربية",  "Interface en arabe",    "الواجهة بالعربية"],
      ["bi", "Les deux · الاثنتان", "Côte à côte", "جنبا إلى جنب"]
    ];
    return "<div class='lang-pick' role='radiogroup' aria-label=\"Langue de l'interface — لغة الواجهة\">" +
      opts.map(function(o){
        var on = (current || "bi") === o[0];
        var isAr = o[0] === "ar";
        return "<button class='lang-opt' type='button' role='radio' data-lang='" + o[0] + "' " +
                 "aria-checked='" + (on?"true":"false") + "' aria-label=\"" + o[1] + " — " + o[3] + "\">" +
                 "<span class='tick' aria-hidden='true'></span>" +
                 "<span>" +
                   "<b" + (isAr ? " lang='ar' dir='rtl'" : "") + ">" + o[1] + "</b>" +
                   "<span>" + o[2] + " · " + o[3] + "</span>" +
                 "</span>" +
               "</button>";
      }).join("") + "</div>";
  }
  function wireLangPicker(root, onPick){
    Array.prototype.forEach.call(root.querySelectorAll(".lang-opt"), function(b){
      b.addEventListener("click", function(){
        Array.prototype.forEach.call(root.querySelectorAll(".lang-opt"), function(x){
          x.setAttribute("aria-checked", "false");
        });
        b.setAttribute("aria-checked", "true");
        onPick(b.getAttribute("data-lang"));
      });
    });
  }
  function pickedLang(root){
    var on = root.querySelector(".lang-opt[aria-checked='true']");
    return on ? on.getAttribute("data-lang") : "bi";
  }

  function renderAvatar(){
    var btn = document.getElementById("profile-btn");
    var p = activeProfile();
    if(!p){ btn.style.display = "none"; return; }
    btn.style.display = "flex";
    btn.style.background = PROFILE_COLORS[p.color || 0];
    btn.textContent = profileInitial(p);
    btn.setAttribute("aria-label", TL("Profil de " + p.name + ", changer de profil",
                                      "ملف " + p.name + "، تغيير الملف"));
    renderCloudBadge();
  }

  /* ---------------- Porte d'entrée : « Qui apprend ? » ---------------- */
  /* La porte d'entrée recouvre l'application en entier. Sans cela elle
     ne la recouvrirait que pour les yeux : un lecteur d'écran
     continuerait de traverser la barre d'onglets et les cartes du
     parcours, y compris avant leur premier rendu — c'est-à-dire des
     boutons encore vides et sans nom. */
  function setShellHidden(hidden){
    var shell = document.querySelector(".app-shell");
    if(!shell) return;
    if(hidden) shell.setAttribute("aria-hidden", "true");
    else shell.removeAttribute("aria-hidden");
  }

  function showGate(mode, targetProfile){
    var gate = document.getElementById("gate");
    gate.style.display = "flex";
    gate.setAttribute("aria-hidden", "false");
    setShellHidden(true);

    if(mode === "pin"){
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-avatar' style='background:" + PROFILE_COLORS[targetProfile.color||0] + "'>" + profileInitial(targetProfile) + "</div>" +
          "<h2 id='gate-title'>" + esc(targetProfile.name) + "</h2>" +
          "<p class='gate-sub'>" + TS("Entre ton code d'accès.", "أدخل رمز الدخول.") + "</p>" +
          "<label class='sr-only' for='gate-pin'>" + TL("Code d'accès à 4 chiffres","رمز الدخول من 4 أرقام") + "</label>" +
          "<input class='gate-pin' id='gate-pin' type='password' inputmode='numeric' maxlength='6' autocomplete='off' aria-label=\"" + TL("Code d'accès","رمز الدخول") + "\" />" +
          "<p class='gate-err' id='gate-err' role='alert'></p>" +
          "<button class='btn' id='gate-ok'>" + T("Ouvrir","افتح") + "</button>" +
          "<button class='btn ghost' id='gate-back' style='margin-top:9px;'>" + T("Choisir un autre profil","اختر ملفا آخر") + "</button>" +
        "</div>";
      var inp = document.getElementById("gate-pin");
      function tryPin(){
        var v = inp.value.trim();
        if(hashPin(v, targetProfile.salt) === targetProfile.pin){
          account.activeId = targetProfile.id; saveAccount();
          hideGate(); bootProfile();
        }else{
          document.getElementById("gate-err").textContent = TL("Code incorrect.","رمز غير صحيح.");
          inp.value = ""; inp.focus();
          tryVibrate([40,60,40]);
        }
      }
      document.getElementById("gate-ok").addEventListener("click", tryPin);
      inp.addEventListener("keydown", function(e){ if(e.key === "Enter") tryPin(); });
      document.getElementById("gate-back").addEventListener("click", function(){ showGate("pick"); });
      inp.focus();
      return;
    }

    /* Appareil neuf : on se connecte et la progression arrive, sans
       avoir à recopier un code depuis l'ancien téléphone. */
    if(mode === "login"){
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<h2 id='gate-title'>" + T("Se connecter","تسجيل الدخول") + "</h2>" +
          "<p class='gate-sub'>" + TS("Ta progression te rejoint sur cet appareil.",
                                      "سيصلك تقدّمك على هذا الجهاز.") + "</p>" +
          cloudFieldsHtml("glog", {}) +
          "<p class='gate-err' id='glog-err' role='alert'></p>" +
          "<button class='btn' id='glog-go'>" + T("Se connecter","ادخل") + "</button>" +
          "<button class='btn ghost' id='gate-back' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>" +
        "</div>";
      var glogBtn = document.getElementById("glog-go");
      function doGateLogin(){
        var f = cloudReadFields("glog");
        cloudErrInto("glog-err", "");
        if(!f.email || !f.pw){ return cloudErrInto("glog-err", cloudErrorText("bad_credentials")); }
        cloudBusy(glogBtn, true, TL("Connexion…","جارٍ الاتصال…"));
        cloudLoginNewProfile(f.email, f.pw).then(function(r){
          cloudBusy(glogBtn, false);
          if(!r.ok) return cloudErrInto("glog-err", r.message);
          hideGate(); bootProfile();
          toast(TL("Bon retour, " + esc(r.profile.name) + ".",
                   "مرحبا بعودتك، " + esc(r.profile.name) + "."));
        });
      }
      glogBtn.addEventListener("click", doGateLogin);
      document.getElementById("glog-pw").addEventListener("keydown", function(e){
        if(e.key === "Enter") doGateLogin();
      });
      document.getElementById("gate-back").addEventListener("click", function(){
        showGate(account.profiles.length ? "pick" : "create");
      });
      document.getElementById("glog-email").focus();
      return;
    }

    if(mode === "create"){
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-avatar'>" + USER_ICON + "</div>" +
          "<h2 id='gate-title'>" + T("Nouveau profil","ملف جديد") + "</h2>" +
          "<p class='gate-sub'>" + TS("Ta progression sera gardée sous ce nom, séparée des autres.",
                                      "سيُحفظ تقدّمك باسمك، منفصلا عن الآخرين.") + "</p>" +
          "<label class='sr-only' for='gate-name'>" + TL("Ton prénom","اسمك") + "</label>" +
          "<input class='gate-input' id='gate-name' maxlength='18' autocomplete='off' placeholder='Prénom · الاسم' aria-label=\"" + TL("Ton prénom","اسمك") + "\" />" +
          langPickerHtml("bi") +
          "<p class='gate-note'>" + TS("Les noms de wilayas resteront écrits dans les deux langues quel que soit ton choix — c'est ce que tu apprends.",
                                       "ستبقى أسماء الولايات مكتوبة باللغتين مهما كان اختيارك — فهي مادة التعلّم نفسها.") + "</p>" +
          "<label class='sr-only' for='gate-newpin'>" + TL("Code d'accès à 4 chiffres, facultatif","رمز دخول من 4 أرقام، اختياري") + "</label>" +
          "<input class='gate-input' id='gate-newpin' type='password' inputmode='numeric' maxlength='6' autocomplete='off' placeholder=\"Code 4 chiffres (facultatif)\" aria-label=\"" + TL("Code d'accès facultatif","رمز دخول اختياري") + "\" />" +
          "<p class='gate-note'>" + TS("Ce code est un verrou local : il empêche quelqu'un d'ouvrir ton profil sur cet appareil. Ce n'est pas un mot de passe sécurisé et il ne se récupère pas.",
                                       "هذا الرمز قفل محلي: يمنع غيرك من فتح ملفك على هذا الجهاز. ليس كلمة سر آمنة ولا يمكن استرجاعه.") + "</p>" +
          "<p class='gate-err' id='gate-err' role='alert'></p>" +
          "<button class='btn' id='gate-create'>" + T("Créer","أنشئ") + "</button>" +
          (cloudAvailable() ? "<button class='btn ghost' id='gate-login' style='margin-top:9px;'>" + T("J'ai déjà un compte","لدي حساب") + "</button>" : "") +
          (account.profiles.length ? "<button class='btn ghost' id='gate-back' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>" : "") +
        "</div>";
      var gateBox = document.getElementById("gate-box");
      /* aperçu immédiat : on applique la langue dès le clic */
      wireLangPicker(gateBox, function(l){ applyLang(l); });
      var nameInp = document.getElementById("gate-name");
      document.getElementById("gate-create").addEventListener("click", function(){
        var nm = nameInp.value.trim();
        if(!nm){
          document.getElementById("gate-err").textContent = TL("Écris un prénom.","اكتب اسما.");
          nameInp.focus(); return;
        }
        var pin = document.getElementById("gate-newpin").value.trim();
        if(pin && !/^\d{4,6}$/.test(pin)){
          document.getElementById("gate-err").textContent = TL("Le code doit faire 4 à 6 chiffres.","الرمز من 4 إلى 6 أرقام.");
          return;
        }
        createProfile(nm, pin || null, pickedLang(gateBox));
        hideGate(); bootProfile();
        toast(TL("Profil « " + esc(nm) + " » créé.","أُنشئ الملف « " + esc(nm) + " »."));
      });
      var gotoLogin = document.getElementById("gate-login");
      if(gotoLogin) gotoLogin.addEventListener("click", function(){ showGate("login"); });
      var back = document.getElementById("gate-back");
      if(back) back.addEventListener("click", function(){ showGate("pick"); });
      nameInp.focus();
      return;
    }

    /* mode "pick" */
    var list = account.profiles.map(function(p){
      var s = profileStats(p);
      return "<button class='gate-profile' data-id='" + p.id + "' aria-label=\"" +
             esc(TL(p.name + ", " + s.tracked + " wilayas suivies, " + s.xp + " XP" + (p.pin ? ", protégé par un code" : ""),
                p.name + "، " + s.tracked + " ولاية، " + s.xp + " نقطة")) + "\">" +
               "<span class='gate-profile-av' style='background:" + PROFILE_COLORS[p.color||0] + "'>" + profileInitial(p) + "</span>" +
               "<span class='gate-profile-body'>" +
                 "<b>" + esc(p.name) + "</b>" +
                 "<span>" + s.tracked + " wilayas · " + s.xp + " XP · " + s.streak + "🔥</span>" +
               "</span>" +
               (p.pin ? "<span class='gate-profile-lock' aria-hidden='true'>" + LOCKSM_ICON + "</span>" : "") +
             "</button>";
    }).join("");

    gate.innerHTML =
      "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
        "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
        "<h2 id='gate-title'>" + T("Qui apprend ?","من يتعلّم؟") + "</h2>" +
        "<p class='gate-sub'>" + TS("Chaque personne garde sa propre mémoire, ses propres cœurs, sa propre série.",
                                    "لكل شخص ذاكرته وقلوبه وسلسلته الخاصة.") + "</p>" +
        "<div class='gate-list'>" + list + "</div>" +
        "<button class='btn ghost' id='gate-new'>" + T("+ Nouveau profil","+ ملف جديد") + "</button>" +
        (cloudAvailable() ? "<button class='btn ghost' id='gate-login' style='margin-top:9px;'>" + T("Se connecter à un compte","الدخول إلى حساب") + "</button>" : "") +
      "</div>";

    Array.prototype.forEach.call(gate.querySelectorAll(".gate-profile"), function(b){
      b.addEventListener("click", function(){
        var id = b.getAttribute("data-id");
        var p = account.profiles.filter(function(x){ return x.id === id; })[0];
        if(!p) return;
        if(p.pin){ showGate("pin", p); return; }
        account.activeId = p.id; saveAccount();
        hideGate(); bootProfile();
      });
    });
    document.getElementById("gate-new").addEventListener("click", function(){ showGate("create"); });
    var pickLogin = document.getElementById("gate-login");
    if(pickLogin) pickLogin.addEventListener("click", function(){ showGate("login"); });
    document.getElementById("gate-box").focus();
  }

  function hideGate(){
    var gate = document.getElementById("gate");
    gate.style.display = "none";
    gate.setAttribute("aria-hidden", "true");
    gate.innerHTML = "";
    setShellHidden(false);
  }

  /* Recharge toute l'application pour le profil actif. */
  function bootProfile(){
    loadState();                 /* applique aussi la langue du profil */
    buildCompass();
    buildMethodBlocks();
    buildAnchorHooks();
    buildFullHooks();
    state.pool = poolForTier(state.tier);
    renderAvatar();
    refreshTopStats();
    refreshStats();
    newQuestion();
    buildLedger();
    renderPath();
    refreshPracticeCards();
    renderSyncPanel();
    checkImportHash();
    cloudBootSync();
  }

  /* ---------------- Feuille « Profil » ---------------- */
  function openProfileSheet(){
    var p = activeProfile();
    if(!p) return;
    var s = profileStats(p);
    var others = account.profiles.filter(function(x){ return x.id !== p.id; });
    openSheet(
      "<h2 id='sheet-title'>" + T("Profil","الملف") + "</h2>" +
      "<div class='profile-head'>" +
        "<span class='profile-av' style='background:" + PROFILE_COLORS[p.color||0] + "'>" + profileInitial(p) + "</span>" +
        "<span class='profile-name'>" + esc(p.name) + (p.pin ? " " + LOCKSM_ICON : "") + "</span>" +
      "</div>" +
      "<div class='sheet-grid'>" +
        "<div class='sheet-stat'><span class='n'>" + s.tracked + "</span><span class='l'>" + TL("suivies","متابَعة") + "</span></div>" +
        "<div class='sheet-stat'><span class='n'>" + s.anchored + "</span><span class='l'>" + TL("ancrées","راسخة") + "</span></div>" +
        "<div class='sheet-stat'><span class='n'>" + s.xp + "</span><span class='l'>XP</span></div>" +
      "</div>" +
      (others.length
        ? "<p class='sub' style='margin:16px 0 8px;'>" + TL("Changer de profil","تغيير الملف") + "</p>" +
          others.map(function(o){
            return "<button class='profile-row' data-id='" + o.id + "'>" +
                     "<span class='gate-profile-av' style='background:" + PROFILE_COLORS[o.color||0] + "'>" + profileInitial(o) + "</span>" +
                     "<span class='gate-profile-body'><b>" + esc(o.name) + "</b><span>" + profileStats(o).tracked + " wilayas · " + profileStats(o).xp + " XP</span></span>" +
                     (o.pin ? "<span class='gate-profile-lock' aria-hidden='true'>" + LOCKSM_ICON + "</span>" : "") +
                   "</button>";
          }).join("")
        : "") +
      "<p class='sub' style='margin:18px 0 8px;'>" + TL("Langue de l'interface","لغة الواجهة") + "</p>" +
      langPickerHtml(p.lang || "bi") +
      cloudRowHtml(p) +
      "<button class='btn ghost' id='prof-new' style='margin-top:12px;'>" + T("+ Nouveau profil","+ ملف جديد") + "</button>" +
      "<button class='btn ghost' id='prof-sync' style='margin-top:9px;'>" + T("Synchroniser un autre appareil","مزامنة جهاز آخر") + "</button>" +
      (account.profiles.length > 1
        ? "<button class='btn ghost danger' id='prof-del' style='margin-top:9px;'>" + T("Supprimer ce profil","احذف هذا الملف") + "</button>"
        : "") +
      "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Fermer","إغلاق") + "</button>"
    );

    wireLangPicker(document.getElementById("sheet-box"), function(l){
      p.lang = l; saveAccount();
      applyLang(l);
      bootProfile();
    });
    /* `[data-id]` n'est pas décoratif : d'autres lignes partagent la
       classe .profile-row sans désigner un profil (le compte en ligne).
       Sans ce filtre, cliquer l'une d'elles cherche un profil qui
       n'existe pas. */
    Array.prototype.forEach.call(document.querySelectorAll(".profile-row[data-id]"), function(b){
      b.addEventListener("click", function(){
        var id = b.getAttribute("data-id");
        var o = account.profiles.filter(function(x){ return x.id === id; })[0];
        if(!o) return;
        closeSheet();
        if(o.pin){ showGate("pin", o); return; }
        account.activeId = o.id; saveAccount(); bootProfile();
        toast(TL("Profil « " + esc(o.name) + " »","الملف « " + esc(o.name) + " »"));
      });
    });
    var cloudRow = document.getElementById("prof-cloud");
    if(cloudRow) cloudRow.addEventListener("click", function(){ openCloudSheet(); });
    document.getElementById("prof-new").addEventListener("click", function(){ closeSheet(); showGate("create"); });
    document.getElementById("prof-sync").addEventListener("click", function(){
      closeSheet(); switchTab("info");
      document.getElementById("sync-section").scrollIntoView({behavior:"smooth", block:"start"});
      document.getElementById("sync-code").focus();
    });
    var del = document.getElementById("prof-del");
    if(del) del.addEventListener("click", function(){
      confirmDialog(TL("Supprimer le profil « " + esc(p.name) + " » et toute sa progression ?",
                       "حذف الملف « " + esc(p.name) + " » وكل تقدّمه؟"), TL("Supprimer","احذف"))
        .then(function(ok){
          if(!ok) return;
          account.profiles = account.profiles.filter(function(x){ return x.id !== p.id; });
          account.activeId = account.profiles.length ? account.profiles[0].id : null;
          saveAccount(); closeSheet();
          if(account.activeId) bootProfile(); else showGate("pick");
        });
    });
    document.getElementById("sheet-close").addEventListener("click", closeSheet);
  }

  /* ---------------- Panneau de synchronisation ---------------- */
  function renderSyncPanel(){
    var p = activeProfile();
    var box = document.getElementById("sync-code");
    if(!box || !p) return;
    box.value = exportCode(p);
    var info = document.getElementById("sync-info");
    var s = profileStats(p);
    if(info){
      info.innerHTML = TS(
        "Ce code contient la mémoire de « " + esc(p.name) + " » : " + s.tracked + " wilayas suivies, " + s.xp + " XP.",
        "يحتوي هذا الرمز على ذاكرة « " + esc(p.name) + " »: " + s.tracked + " ولاية، " + s.xp + " نقطة.");
    }
  }

  function initSyncPanel(){
    var copyBtn = document.getElementById("sync-copy");
    var codeBox = document.getElementById("sync-code");
    copyBtn.addEventListener("click", function(){
      codeBox.select();
      var done = false;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(codeBox.value);
          done = true;
        }else if(document.execCommand){ done = document.execCommand("copy"); }
      }catch(e){}
      toast(done ? TL("Code copié.","نُسخ الرمز.") : TL("Sélectionne le texte et copie-le.","حدّد النص وانسخه."));
    });

    var saveBtn = document.getElementById("sync-save");
    saveBtn.addEventListener("click", function(){
      var p = activeProfile();
      if(!p) return;
      (async function(){
        var dl = null;
        try{ dl = window.claude && claude.use ? await claude.use("downloads") : null; }catch(e){ dl = null; }
        if(dl){
          try{
            await dl.save({ filename:"wilayas-" + p.name.replace(/\W+/g,"-").toLowerCase() + ".txt",
                            data: exportCode(p) });
            toast(TL("Sauvegarde enregistrée.","حُفظت النسخة."));
          }catch(e){ toast(TL("Enregistrement annulé.","أُلغي الحفظ.")); }
        }else{
          codeBox.select();
          toast(TL("Copie le code et garde-le en lieu sûr.","انسخ الرمز واحفظه في مكان آمن."));
        }
      })();
    });

    document.getElementById("sync-import").addEventListener("click", function(){
      var raw = document.getElementById("sync-paste").value.trim();
      importCode(raw, function(){ document.getElementById("sync-paste").value = ""; });
    });

    initWebShare();
  }

  /* Fusion d'un code, quelle que soit sa provenance (coller à la main
     ou lien/QR reçu) : même validation, même confirmation, même fusion. */
  function importCode(raw, onDone){
    if(!raw){ toast(TL("Colle d'abord un code.","الصق رمزا أولا.")); return; }
    var res = parseCode(raw);
    if(res.error){
      var msg = res.error === "abime"
        ? TL("Ce code est incomplet ou abîmé — recopie-le en entier.","الرمز ناقص أو تالف — أعد نسخه كاملا.")
        : TL("Ce n'est pas un code de transfert valide.","هذا ليس رمز نقل صالح.");
      toast(msg); return;
    }
    var obj = res.obj;
    var p = activeProfile();
    if(!p) return;
    var n = Object.keys(obj.p||{}).length;
    confirmDialog(
      TL("Le code vient de « " + esc(obj.n || "?") + " » et contient " + n + " wilayas. Il sera FUSIONNÉ avec « " + esc(p.name) + " » : pour chaque wilaya, la meilleure des deux mémoires est gardée. Rien n'est effacé.",
         "الرمز من « " + esc(obj.n || "?") + " » ويحتوي " + n + " ولاية. سيُدمج مع « " + esc(p.name) + " »: تُحفظ الأفضل من الذاكرتين. لا شيء يُمحى."),
      TL("Fusionner","ادمج")
    ).then(function(ok){
      if(!ok) return;
      var r = mergeInto(p, obj);
      saveAccount(); bootProfile();
      if(onDone) onDone();
      toast(TL(r.added + " ajoutées, " + r.improved + " améliorées.",
               r.added + " أُضيفت، " + r.improved + " تحسّنت."));
    });
  }

  /* ---------------- Partage web : lien + QR ----------------
     file:// (l'APK, un double-clic local) n'a pas d'adresse à partager
     et navigator.share n'y existe de toute façon pas : toute cette
     section reste masquée hors http(s). */
  function isWebOrigin(){ return /^https?:$/.test(location.protocol); }

  function shareUrl(){
    var p = activeProfile();
    if(!p) return null;
    return location.origin + location.pathname + "#w=" + exportCode(p);
  }

  function initWebShare(){
    var row = document.getElementById("sync-web-actions");
    if(!row || !isWebOrigin()) return;
    row.style.display = "";

    var shareBtn = document.getElementById("sync-share");
    shareBtn.addEventListener("click", function(){
      var url = shareUrl();
      if(!url) return;
      if(navigator.share){
        navigator.share({
          title:"WilayaDZ",
          text:TL("Ma progression WilayaDZ — importe-la sur ton appareil.",
                  "تقدّمي في تطبيق WilayaDZ — استورده على جهازك."),
          url:url
        }).catch(function(){ /* annulé par l'utilisateur : rien à faire */ });
      }else if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url);
        toast(TL("Lien copié — envoie-le sur l'autre appareil.","نُسخ الرابط — أرسله إلى الجهاز الآخر."));
      }else{
        toast(TL("Partage indisponible ici — utilise le code ci-dessus.","المشاركة غير متاحة هنا — استخدم الرمز أعلاه."));
      }
    });

    var qrBtn = document.getElementById("sync-qr-toggle");
    var qrBox = document.getElementById("sync-qr-box");
    var qrHint = document.getElementById("sync-qr-hint");
    qrBtn.addEventListener("click", function(){
      var open = qrBox.style.display !== "none";
      if(open){
        qrBox.style.display = "none"; qrHint.style.display = "none";
        qrBox.innerHTML = ""; qrBtn.setAttribute("aria-expanded","false");
        return;
      }
      var url = shareUrl();
      if(!url) return;
      try{
        var qr = qrcode(0, "M");
        qr.addData(url);
        qr.make();
        qrBox.innerHTML = qr.createSvgTag({scalable:true});
        qrBox.style.display = ""; qrHint.style.display = "";
        qrBtn.setAttribute("aria-expanded","true");
      }catch(e){
        toast(TL("Code QR indisponible sur cet appareil.","رمز QR غير متاح على هذا الجهاز."));
      }
    });
  }

  /* ---------------- Import par lien (#w=...) ----------------
     Ouvrir un lien de partage suffit : pas besoin de recopier le code
     à la main. Ne se déclenche qu'une fois par chargement de page, et
     seulement une fois qu'un profil actif existe (bootProfile() peut
     tourner plusieurs fois — changement de langue, de profil...). */
  var hashImportDone = false;
  function checkImportHash(){
    if(hashImportDone) return;
    var m = location.hash.match(/#w=(WLY1\.[A-Za-z0-9\-_]+\.[a-z0-9]+)/);
    if(!m) return;
    hashImportDone = true;
    history.replaceState(null, "", location.pathname + location.search);
    importCode(m[1]);
  }

  document.getElementById("profile-btn").addEventListener("click", openProfileSheet);
