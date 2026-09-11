
  /* ============================================================
     INTERFACE DU COMPTE EN LIGNE
     Le vocabulaire reste celui de l'application : on ne parle ni de
     « cloud », ni de « backend », ni de « token ». On dit ce que ça
     fait — retrouver sa progression sur un autre appareil.
     ============================================================ */

  var CLOUD_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6-1.5A3.75 3.75 0 0117.5 18z"/></svg>';

  function cloudBusy(btn, on, label){
    if(!btn) return;
    btn.disabled = !!on;
    if(on){
      btn.dataset.idle = btn.textContent;
      btn.textContent = label || TL("Patiente…","انتظر…");
    }else if(btn.dataset.idle){
      btn.textContent = btn.dataset.idle;
    }
  }
  function cloudErrInto(id, message){
    var el = document.getElementById(id);
    if(el) el.textContent = message || "";
  }

  /* Ce que la personne a besoin de savoir au moment où elle choisit un
     mot de passe : qu'un oubli se répare, et par où. */
  function cloudRecoveryNote(){
    return "<p class='gate-note'>" + TS(
      "Si tu l'oublies, « Mot de passe oublié ? » t'enverra un lien sur cette adresse — vérifie donc qu'elle est juste.",
      "إن نسيتها، سيرسل لك « نسيت كلمة السر؟ » رابطا إلى هذا البريد — تأكّد إذن من صحّته.") + "</p>";
  }

  function cloudFieldsHtml(prefix, opts){
    opts = opts || {};
    return (opts.name
        ? "<label class='sr-only' for='" + prefix + "-name'>" + TL("Ton prénom","اسمك") + "</label>" +
          "<input class='gate-input' id='" + prefix + "-name' maxlength='18' autocomplete='given-name' " +
          "placeholder='Prénom · الاسم' aria-label=\"" + TL("Ton prénom","اسمك") + "\" />"
        : "") +
      "<label class='sr-only' for='" + prefix + "-email'>" + TL("Adresse e-mail","البريد الإلكتروني") + "</label>" +
      "<input class='gate-input' id='" + prefix + "-email' type='email' inputmode='email' " +
        "autocomplete='email' autocapitalize='off' spellcheck='false' " +
        "placeholder='E-mail · البريد' aria-label=\"" + TL("Adresse e-mail","البريد الإلكتروني") + "\" />" +
      "<label class='sr-only' for='" + prefix + "-pw'>" + TL("Mot de passe","كلمة السر") + "</label>" +
      "<input class='gate-input' id='" + prefix + "-pw' type='password' " +
        "autocomplete='" + (opts.newPassword ? "new-password" : "current-password") + "' " +
        "placeholder='" + (opts.newPassword ? "Mot de passe (8 min.) · كلمة السر" : "Mot de passe · كلمة السر") + "' " +
        "aria-label=\"" + TL("Mot de passe","كلمة السر") + "\" />";
  }
  function cloudReadFields(prefix){
    var nameEl = document.getElementById(prefix + "-name");
    return {
      name: nameEl ? nameEl.value.trim() : "",
      email: (document.getElementById(prefix + "-email").value || "").trim(),
      pw: document.getElementById(prefix + "-pw").value || ""
    };
  }

  /* La ligne affichée dans la feuille « Profil » : elle dit d'un coup
     d'œil si ce profil voyage ou s'il reste sur cet appareil. */
  function cloudRowHtml(p){
    if(!cloudAvailable()) return "";
    var c = cloudOf(p);
    var linked = !!(c && c.token);
    var ago = linked ? cloudSyncedAgo(c) : null;
    var sub = linked
      ? TL(esc(c.email) + " · " + ago.fr, esc(c.email) + " · " + ago.ar)
      : TL("Retrouve ta progression sur un autre appareil",
           "استعد تقدّمك على جهاز آخر");
    return "<p class='sub' style='margin:18px 0 8px;'>" + TL("Compte en ligne","الحساب على الإنترنت") + "</p>" +
      "<button class='profile-row cloud-row" + (linked ? " on" : "") + "' id='prof-cloud'>" +
        "<span class='cloud-row-icon'>" + CLOUD_ICON + "</span>" +
        "<span class='gate-profile-body'>" +
          "<b>" + (linked ? TL("Connecté","متصل") : TL("Pas de compte","بلا حساب")) + "</b>" +
          "<span>" + sub + "</span>" +
        "</span>" +
      "</button>";
  }

  /* ---------------- Feuille principale ---------------- */

  function openCloudSheet(){
    var p = activeProfile();
    if(!p) return;
    if(!cloudAvailable()){
      toast(TL("La synchronisation n'est pas disponible sur cet appareil.",
               "المزامنة غير متاحة على هذا الجهاز."));
      return;
    }
    var c = cloudOf(p);

    /* On n'arrive ici qu'avec une session expirée : depuis que le compte
       est obligatoire, un profil actif en a toujours un. La progression
       de l'appareil continue de tourner pendant ce temps — c'est la
       synchronisation qui est en pause, pas l'application. */
    if(!c || !c.token){
      openSheet(
        "<h2 id='sheet-title'>" + T("Compte en ligne","الحساب على الإنترنت") + "</h2>" +
        "<p class='gate-err' style='margin:0 0 10px'>" +
          TL("Ta session a expiré — reconnecte-toi pour resynchroniser.",
             "انتهت جلستك — أعد الاتصال لاستئناف المزامنة.") + "</p>" +
        "<p class='sub'>" + TS(
          "Ta progression sur cet appareil est intacte et repartira sur le compte dès la reconnexion.",
          "تقدّمك على هذا الجهاز سليم وسيُرسل إلى الحساب فور إعادة الاتصال.") + "</p>" +
        "<button class='btn' id='cloud-go-login' style='margin-top:14px;'>" + T("Se reconnecter","أعد الاتصال") + "</button>" +
        "<button class='btn ghost' id='cloud-go-register' style='margin-top:9px;'>" + T("Utiliser un autre compte","استخدم حسابا آخر") + "</button>" +
        "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Fermer","إغلاق") + "</button>"
      );
      document.getElementById("cloud-go-register").addEventListener("click", function(){ openCloudForm("register"); });
      document.getElementById("cloud-go-login").addEventListener("click", function(){ openCloudForm("login"); });
      document.getElementById("sheet-close").addEventListener("click", closeSheet);
      return;
    }

    openSheet(
      "<h2 id='sheet-title'>" + T("Compte en ligne","الحساب على الإنترنت") + "</h2>" +
      "<div class='cloud-status" + (c.lastError ? " warn" : "") + "'>" +
        "<span class='cloud-status-icon'>" + CLOUD_ICON + "</span>" +
        "<span class='cloud-status-body'>" +
          "<b>" + esc(c.email) + "</b>" +
          "<span>" + TL("Dernière synchronisation : " + cloudSyncedAgo(c).fr,
                        "آخر مزامنة: " + cloudSyncedAgo(c).ar) + "</span>" +
        "</span>" +
      "</div>" +
      (c.lastError
        ? "<p class='gate-err' style='margin:10px 0 0'>" + cloudErrorText(c.lastError) + "</p>" +
          "<p class='gate-note'>" +
          TS("Ta progression est en sécurité sur cet appareil et repartira toute seule.",
             "تقدّمك في أمان على هذا الجهاز وسيُرسل تلقائيا.") + "</p>"
        : "") +
      "<button class='btn' id='cloud-now' style='margin-top:14px;'>" + T("Synchroniser maintenant","زامن الآن") + "</button>" +
      "<button class='btn ghost' id='cloud-pw' style='margin-top:9px;'>" + T("Changer le mot de passe","غيّر كلمة السر") + "</button>" +
      "<button class='btn ghost' id='cloud-out' style='margin-top:9px;'>" + T("Se déconnecter","تسجيل الخروج") + "</button>" +
      "<p class='gate-note'>" + TS(
        "Se déconnecter ne supprime rien : la progression reste sur cet appareil et sur le compte.",
        "تسجيل الخروج لا يحذف شيئا: يبقى التقدّم على الجهاز وفي الحساب.") + "</p>" +
      "<button class='btn ghost danger' id='cloud-del' style='margin-top:4px;'>" + T("Supprimer le compte","احذف الحساب") + "</button>" +
      "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Fermer","إغلاق") + "</button>"
    );

    var nowBtn = document.getElementById("cloud-now");
    nowBtn.addEventListener("click", function(){
      cloudBusy(nowBtn, true, TL("Synchronisation…","جارٍ…"));
      cloudSync(p).then(function(r){
        cloudBusy(nowBtn, false);
        renderCloudBadge();
        if(r.ok){
          toast(r.changed
            ? TL(r.added + " ajoutées, " + r.improved + " améliorées.",
                 r.added + " أُضيفت، " + r.improved + " تحسّنت.")
            : TL("Tout est à jour.","كل شيء محدّث."));
          openCloudSheet();
        }else{
          toast(cloudErrorText(r.error));
          if(r.error === "unauthorized") openCloudSheet();
        }
      });
    });
    document.getElementById("cloud-pw").addEventListener("click", function(){ openCloudForm("password"); });
    document.getElementById("cloud-out").addEventListener("click", function(){
      confirmDialog(TL("Se déconnecter de « " + esc(c.email) + " » sur cet appareil ?",
                       "تسجيل الخروج من « " + esc(c.email) + " » على هذا الجهاز؟"),
                    TL("Se déconnecter","خروج"))
        .then(function(ok){
          if(!ok) return;
          cloudLogout(p);
          closeSheet(); renderCloudBadge();
          toast(TL("Déconnecté. La progression reste ici.","تم الخروج. يبقى التقدّم هنا."));
        });
    });
    document.getElementById("cloud-del").addEventListener("click", function(){ openCloudForm("delete"); });
    document.getElementById("sheet-close").addEventListener("click", closeSheet);
  }

  /* ---------------- Formulaires ---------------- */

  function openCloudForm(mode){
    var p = activeProfile();
    if(!p) return;

    if(mode === "register"){
      openSheet(
        "<h2 id='sheet-title'>" + T("Créer un compte","أنشئ حسابا") + "</h2>" +
        "<p class='sub'>" + TS("Ta progression actuelle sera envoyée sur ce compte, puis retrouvée partout.",
                               "سيُرسل تقدّمك الحالي إلى هذا الحساب، ثم تجده في كل مكان.") + "</p>" +
        cloudFieldsHtml("creg", {name:true, newPassword:true}) +
        cloudRecoveryNote() +
        "<p class='gate-err' id='creg-err' role='alert'></p>" +
        "<button class='btn' id='creg-go'>" + T("Créer le compte","أنشئ الحساب") + "</button>" +
        "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>"
      );
      document.getElementById("creg-name").value = p.name;
      var regBtn = document.getElementById("creg-go");
      regBtn.addEventListener("click", function(){
        var f = cloudReadFields("creg");
        cloudErrInto("creg-err", "");
        if(!f.name){ return cloudErrInto("creg-err", cloudErrorText("bad_name")); }
        if(!f.email){ return cloudErrInto("creg-err", cloudErrorText("bad_email")); }
        if(f.pw.length < 8){ return cloudErrInto("creg-err", cloudErrorText("weak_password")); }
        cloudBusy(regBtn, true, TL("Création…","جارٍ الإنشاء…"));
        cloudRegister(p, f.email, f.name, f.pw).then(function(r){
          cloudBusy(regBtn, false);
          if(!r.ok) return cloudErrInto("creg-err", r.message);
          /* Rien n'est rattaché tant que l'adresse n'est pas confirmée :
             on emmène donc vers la boîte mail, sans annoncer une
             synchronisation qui n'a pas eu lieu. */
          closeSheet();
          showGate("pending", f.email);
        });
      });
      document.getElementById("sheet-close").addEventListener("click", openCloudSheet);
      document.getElementById("creg-email").focus();
      return;
    }

    if(mode === "login"){
      openSheet(
        "<h2 id='sheet-title'>" + T("Se connecter","تسجيل الدخول") + "</h2>" +
        "<p class='sub'>" + TS(
          "La progression du compte sera FUSIONNÉE avec « " + esc(p.name) + " » : pour chaque wilaya, la meilleure des deux mémoires est gardée. Rien n'est effacé.",
          "سيُدمج تقدّم الحساب مع « " + esc(p.name) + " »: تُحفظ الأفضل من الذاكرتين. لا شيء يُمحى.") + "</p>" +
        cloudFieldsHtml("clog", {}) +
        "<p class='gate-err' id='clog-err' role='alert'></p>" +
        "<button class='btn' id='clog-go'>" + T("Se connecter","ادخل") + "</button>" +
        "<button class='btn ghost' id='clog-forgot' style='margin-top:9px;'>" + T("Mot de passe oublié ?","نسيت كلمة السر؟") + "</button>" +
        "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>"
      );
      var logBtn = document.getElementById("clog-go");
      function doLogin(){
        var f = cloudReadFields("clog");
        cloudErrInto("clog-err", "");
        if(!f.email || !f.pw){ return cloudErrInto("clog-err", cloudErrorText("bad_credentials")); }
        cloudBusy(logBtn, true, TL("Connexion…","جارٍ الاتصال…"));
        cloudLoginInto(p, f.email, f.pw).then(function(r){
          cloudBusy(logBtn, false);
          if(!r.ok){
            if(r.code === "not_verified"){
              setPending(f.email, f.email.split("@")[0], p.lang || "bi", p.id);
              closeSheet();
              return showGate("pending", f.email);
            }
            return cloudErrInto("clog-err", r.message);
          }
          renderCloudBadge(); renderAvatar();
          toast(r.added || r.improved
            ? TL(r.added + " ajoutées, " + r.improved + " améliorées.",
                 r.added + " أُضيفت، " + r.improved + " تحسّنت.")
            : TL("Connecté — tout est à jour.","تم الاتصال — كل شيء محدّث."));
          openCloudSheet();
        });
      }
      logBtn.addEventListener("click", doLogin);
      document.getElementById("clog-pw").addEventListener("keydown", function(e){
        if(e.key === "Enter") doLogin();
      });
      document.getElementById("clog-forgot").addEventListener("click", function(){
        openCloudForm("forgot");
      });
      document.getElementById("sheet-close").addEventListener("click", openCloudSheet);
      document.getElementById("clog-email").focus();
      return;
    }

    if(mode === "forgot"){
      openSheet(
        "<h2 id='sheet-title'>" + T("Mot de passe oublié","نسيت كلمة السر") + "</h2>" +
        "<p class='sub'>" + TS("Donne ton adresse : on t'envoie un lien pour en choisir un nouveau.",
                               "أدخل بريدك: سنرسل لك رابطا لاختيار كلمة سر جديدة.") + "</p>" +
        "<label class='sr-only' for='cfor-email'>" + TL("Adresse e-mail","البريد الإلكتروني") + "</label>" +
        "<input class='gate-input' id='cfor-email' type='email' inputmode='email' autocomplete='email' " +
          "autocapitalize='off' spellcheck='false' placeholder='E-mail · البريد' aria-label=\"" + TL("Adresse e-mail","البريد الإلكتروني") + "\" />" +
        "<p class='gate-err' id='cfor-err' role='alert'></p>" +
        "<p class='gate-note' id='cfor-done' style='display:none' role='status'></p>" +
        "<button class='btn' id='cfor-go'>" + T("Envoyer le lien","أرسل الرابط") + "</button>" +
        "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>"
      );
      var cforBtn = document.getElementById("cfor-go");
      var cforEmail = document.getElementById("cfor-email");
      var c0 = cloudOf(p);
      if(c0 && c0.email) cforEmail.value = c0.email;
      function doCloudForgot(){
        var mail = cforEmail.value.trim();
        cloudErrInto("cfor-err", "");
        if(!mail){ return cloudErrInto("cfor-err", cloudErrorText("bad_email")); }
        cloudBusy(cforBtn, true, TL("Envoi…","جارٍ الإرسال…"));
        cloudForgot(mail).then(function(r){
          cloudBusy(cforBtn, false);
          if(!r.ok){ return cloudErrInto("cfor-err", r.message); }
          var done = document.getElementById("cfor-done");
          done.style.display = "";
          done.innerHTML = TS(
            "Si un compte existe avec cette adresse, le lien vient de partir. Il est valable une heure — pense à regarder dans les indésirables.",
            "إن كان هناك حساب بهذا البريد، فقد أُرسل الرابط. صالح لمدة ساعة — تحقّق من البريد غير المرغوب فيه.");
          cforBtn.disabled = true;
        });
      }
      cforBtn.addEventListener("click", doCloudForgot);
      cforEmail.addEventListener("keydown", function(e){ if(e.key === "Enter") doCloudForgot(); });
      document.getElementById("sheet-close").addEventListener("click", openCloudSheet);
      cforEmail.focus();
      return;
    }

    if(mode === "password"){
      openSheet(
        "<h2 id='sheet-title'>" + T("Changer le mot de passe","غيّر كلمة السر") + "</h2>" +
        "<p class='sub'>" + TS("Les autres appareils connectés à ce compte devront se reconnecter.",
                               "ستحتاج الأجهزة الأخرى إلى إعادة الاتصال.") + "</p>" +
        "<label class='sr-only' for='cpw-cur'>" + TL("Mot de passe actuel","كلمة السر الحالية") + "</label>" +
        "<input class='gate-input' id='cpw-cur' type='password' autocomplete='current-password' " +
          "placeholder='Mot de passe actuel · الحالية' aria-label=\"" + TL("Mot de passe actuel","كلمة السر الحالية") + "\" />" +
        "<label class='sr-only' for='cpw-new'>" + TL("Nouveau mot de passe","كلمة السر الجديدة") + "</label>" +
        "<input class='gate-input' id='cpw-new' type='password' autocomplete='new-password' " +
          "placeholder='Nouveau (8 min.) · الجديدة' aria-label=\"" + TL("Nouveau mot de passe","كلمة السر الجديدة") + "\" />" +
        cloudRecoveryNote() +
        "<p class='gate-err' id='cpw-err' role='alert'></p>" +
        "<button class='btn' id='cpw-go'>" + T("Changer","غيّر") + "</button>" +
        "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>"
      );
      var pwBtn = document.getElementById("cpw-go");
      pwBtn.addEventListener("click", function(){
        var cur = document.getElementById("cpw-cur").value || "";
        var nxt = document.getElementById("cpw-new").value || "";
        cloudErrInto("cpw-err", "");
        if(nxt.length < 8){ return cloudErrInto("cpw-err", cloudErrorText("weak_password")); }
        cloudBusy(pwBtn, true);
        cloudChangePassword(p, cur, nxt).then(function(r){
          cloudBusy(pwBtn, false);
          if(!r.ok) return cloudErrInto("cpw-err", r.message);
          toast(TL("Mot de passe changé.","تم تغيير كلمة السر."));
          openCloudSheet();
        });
      });
      document.getElementById("sheet-close").addEventListener("click", openCloudSheet);
      document.getElementById("cpw-cur").focus();
      return;
    }

    if(mode === "delete"){
      openSheet(
        "<h2 id='sheet-title'>" + T("Supprimer le compte","احذف الحساب") + "</h2>" +
        "<p class='sub'>" + TS(
          "Le compte et la progression qu'il contient seront effacés du serveur, définitivement. La progression de cet appareil, elle, reste intacte.",
          "سيُحذف الحساب وما فيه من تقدّم من الخادم نهائيا. يبقى تقدّم هذا الجهاز سليما.") + "</p>" +
        "<label class='sr-only' for='cdel-pw'>" + TL("Mot de passe","كلمة السر") + "</label>" +
        "<input class='gate-input' id='cdel-pw' type='password' autocomplete='current-password' " +
          "placeholder='Mot de passe · كلمة السر' aria-label=\"" + TL("Mot de passe","كلمة السر") + "\" />" +
        "<p class='gate-err' id='cdel-err' role='alert'></p>" +
        "<button class='btn ghost danger' id='cdel-go'>" + T("Supprimer définitivement","احذف نهائيا") + "</button>" +
        "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>"
      );
      var delBtn = document.getElementById("cdel-go");
      delBtn.addEventListener("click", function(){
        var pw = document.getElementById("cdel-pw").value || "";
        cloudErrInto("cdel-err", "");
        confirmDialog(TL("Supprimer définitivement ce compte en ligne ?",
                         "حذف هذا الحساب نهائيا؟"), TL("Supprimer","احذف"))
          .then(function(ok){
            if(!ok) return;
            cloudBusy(delBtn, true);
            cloudDeleteAccount(p, pw).then(function(r){
              cloudBusy(delBtn, false);
              if(!r.ok) return cloudErrInto("cdel-err", r.message);
              closeSheet(); renderCloudBadge();
              toast(TL("Compte supprimé. Ta progression reste sur cet appareil.",
                       "حُذف الحساب. يبقى تقدّمك على هذا الجهاز."));
            });
          });
      });
      document.getElementById("sheet-close").addEventListener("click", openCloudSheet);
      document.getElementById("cdel-pw").focus();
    }
  }
