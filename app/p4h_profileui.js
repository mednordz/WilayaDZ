
  /* ============================================================
     INTERFACE DES PROFILS
     ============================================================ */
  var USER_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0115 0"/></svg>';
  var MAIL_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.5l8.5 6 8.5-6"/></svg>';
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
    /* C'est le bloc entier qui apparaît ou disparaît : le bouton seul
       laisserait son étiquette « Mon profil » flotter sans rien. */
    var bloc = document.getElementById("profil-bloc");
    var p = activeProfile();
    if(!p){ if(bloc) bloc.style.display = "none"; btn.style.display = "none"; return; }
    if(bloc) bloc.style.display = "flex";
    btn.style.display = "flex";
    applyAvatar(btn, p);
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
          avatarHtml(targetProfile, "gate-avatar") +
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
      /* Meme regle qu'a la creation : si un profil local est vise, on
         se connecte DANS ce profil et sa progression fusionne avec
         celle du compte. */
      var loginInto = (targetProfile && typeof targetProfile === "object") ? targetProfile : null;
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<h2 id='gate-title'>" + T("Se connecter","تسجيل الدخول") + "</h2>" +
          "<p class='gate-sub'>" + (loginInto
            ? TS("La progression de « " + esc(loginInto.name) + " » sera FUSIONNÉE avec celle du compte : pour chaque wilaya, la meilleure des deux mémoires est gardée.",
                 "سيُدمج تقدّم « " + esc(loginInto.name) + " » مع تقدّم الحساب: تُحفظ الأفضل من الذاكرتين.")
            : TS("Ta progression te rejoint sur cet appareil.",
                 "سيصلك تقدّمك على هذا الجهاز.")) + "</p>" +
          cloudFieldsHtml("glog", {login:true}) +
          "<p class='gate-err' id='glog-err' role='alert'></p>" +
          "<button class='btn' id='glog-go'>" + T("Se connecter","ادخل") + "</button>" +
          googleButtonHtml("glog") +
          "<button class='btn ghost' id='glog-forgot' style='margin-top:9px;'>" + T("Mot de passe oublié ?","نسيت كلمة السر؟") + "</button>" +
          "<button class='btn ghost' id='gate-back' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>" +
        "</div>";
      var glogBox = document.getElementById("gate-box");
      wirePasswordEyes(glogBox);
      wireGoogleButton(glogBox, loginInto);
      var glogBtn = document.getElementById("glog-go");
      function doGateLogin(){
        var f = cloudReadFields("glog");
        cloudErrInto("glog-err", "");
        if(!f.email || !f.pw){ return cloudErrInto("glog-err", cloudErrorText("bad_credentials")); }
        cloudBusy(glogBtn, true, TL("Connexion…","جارٍ الاتصال…"));
        var demarche = loginInto
          ? cloudLoginInto(loginInto, f.email, f.pw).then(function(r){
              if(r.ok){ account.activeId = loginInto.id; saveAccount(); r.profile = loginInto; }
              return r;
            })
          : cloudLoginNewProfile(f.email, f.pw);
        demarche.then(function(r){
          cloudBusy(glogBtn, false);
          if(!r.ok){
            /* Le mot de passe est bon mais l'adresse n'a jamais été
               confirmée : ce n'est pas un refus, c'est une étape qui
               reste à faire. On y emmène au lieu d'afficher une erreur. */
            if(r.code === "not_verified"){
              setPending(f.email, f.email.split("@")[0], "bi",
                         loginInto ? loginInto.id : null);
              return showGate("pending", f.email);
            }
            return cloudErrInto("glog-err", r.message);
          }
          hideGate(); bootProfile();
          toast(TL("Bon retour, " + esc(r.profile.name) + ".",
                   "مرحبا بعودتك، " + esc(r.profile.name) + "."));
        });
      }
      glogBtn.addEventListener("click", doGateLogin);
      document.getElementById("glog-pw").addEventListener("keydown", function(e){
        if(e.key === "Enter") doGateLogin();
      });
      document.getElementById("glog-forgot").addEventListener("click", function(){
        var identifier=document.getElementById("glog-email").value.trim();
        showGate("forgot", identifier.indexOf("@")!==-1?identifier:"");
      });
      document.getElementById("gate-back").addEventListener("click", function(){
        if(loginInto) return showGate("create", loginInto);
        showGate(account.profiles.length ? "pick" : "create");
      });
      document.getElementById("glog-email").focus();
      return;
    }

    /* Inscription faite, adresse pas encore confirmée. C'est un état
       qui dure : la personne doit sortir de l'application, aller dans sa
       boîte, cliquer. L'écran doit donc dire exactement quoi faire, et
       offrir les deux sorties de secours — renvoyer, ou corriger une
       adresse mal saisie. */
    if(mode === "pending"){
      var attente = cloudPending() || {};
      var adresse = (typeof targetProfile === "string" && targetProfile) || attente.email || "";
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<div class='gate-avatar'>" + MAIL_ICON + "</div>" +
          "<h2 id='gate-title'>" + T("Vérifie ta boîte mail","تحقّق من بريدك") + "</h2>" +
          "<p class='gate-sub'>" + TS(
            "Un lien vient de partir à " + esc(adresse) + ". Ouvre-le et tu seras connecté — le lien est valable 24 heures.",
            "أُرسل رابط إلى " + esc(adresse) + ". افتحه وستدخل مباشرة — الرابط صالح 24 ساعة.") + "</p>" +
          "<p class='gate-note'>" + TS(
            "Rien ne t'arrivera tant que tu n'auras pas confirmé : c'est ce qui empêche quelqu'un d'ouvrir un compte avec l'adresse de quelqu'un d'autre. Pense à regarder dans les indésirables.",
            "لن يحدث شيء قبل التأكيد: هكذا لا يفتح أحد حسابا ببريد غيره. تحقّق أيضا من البريد غير المرغوب فيه.") + "</p>" +
          "<p class='gate-err' id='gpen-err' role='alert'></p>" +
          "<p class='gate-note' id='gpen-done' style='display:none' role='status'></p>" +
          "<button class='btn' id='gpen-resend'>" + T("Renvoyer le lien","أعد إرسال الرابط") + "</button>" +
          "<button class='btn ghost' id='gpen-change' style='margin-top:9px;'>" + T("Ce n'est pas la bonne adresse","ليس هذا البريد الصحيح") + "</button>" +
          "<button class='btn ghost' id='gpen-login' style='margin-top:9px;'>" + T("J'ai déjà confirmé, me connecter","لقد أكّدت، أدخلني") + "</button>" +
        "</div>";
      var penBtn = document.getElementById("gpen-resend");
      penBtn.addEventListener("click", function(){
        cloudErrInto("gpen-err", "");
        cloudBusy(penBtn, true, TL("Envoi…","جارٍ الإرسال…"));
        cloudResend(adresse).then(function(r){
          cloudBusy(penBtn, false);
          if(!r.ok) return cloudErrInto("gpen-err", r.message);
          var fait = document.getElementById("gpen-done");
          fait.style.display = "";
          fait.innerHTML = TS("C'est reparti. Si rien n'arrive, l'adresse est peut-être mal écrite.",
                              "أُرسل من جديد. إن لم يصلك شيء، فقد يكون البريد مكتوبا بشكل خاطئ.");
        });
      });
      document.getElementById("gpen-change").addEventListener("click", function(){
        clearPending();
        showGate("create");
      });
      document.getElementById("gpen-login").addEventListener("click", function(){
        showGate("login");
      });
      document.getElementById("gate-box").focus();
      return;
    }

    /* Premier pas dans l'application, une fois l'adresse confirmée.
       C'est ici que l'avatar et la langue trouvent leur place : au
       moment où ça fait plaisir de choisir, pas au moment où ça
       retarde l'inscription. Tout y est facultatif. */
    if(mode === "welcome"){
      var pw = targetProfile || activeProfile();
      if(!pw){ hideGate(); return bootProfile(); }
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<h2 id='gate-title'>" + T("Bienvenue, " + esc(pw.name),
                                     "مرحبا، " + esc(pw.name)) + "</h2>" +
          "<p class='gate-sub'>" + TS("Deux réglages, et on commence. Tu pourras les changer quand tu veux.",
                                      "إعدادان، ثم نبدأ. يمكنك تغييرهما متى شئت.") + "</p>" +
          "<p class='sub' style='margin:14px 0 2px'>" + TL("Ta photo","صورتك") + "</p>" +
          avatarPickerHtml(pw) +
          "<p class='sub' style='margin:18px 0 2px'>" + TL("Langue de l'interface","لغة الواجهة") + "</p>" +
          langPickerHtml(pw.lang || "bi") +
          "<p class='gate-note'>" + TS("Les noms de wilayas resteront écrits dans les deux langues quel que soit ton choix — c'est ce que tu apprends.",
                                       "ستبقى أسماء الولايات مكتوبة باللغتين مهما كان اختيارك — فهي مادة التعلّم نفسها.") + "</p>" +
          "<button class='btn' id='gwel-go' style='margin-top:10px;'>" + T("Commencer","لنبدأ") + "</button>" +
        "</div>";
      var wb = document.getElementById("gate-box");
      wireAvatarPicker(wb, pw, function(){ showGate("welcome", pw); });
      wireLangPicker(wb, function(l){ pw.lang = l; saveAccount(); applyLang(l); });
      document.getElementById("gwel-go").addEventListener("click", function(){
        hideGate(); bootProfile();
      });
      wb.focus();
      return;
    }

    /* Retour de Google. targetProfile porte ici ce que la redirection a
       rapporté, déjà retiré de la barre d'adresse. */
    if(mode === "googling"){
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<h2 id='gate-title'>" + T("Connexion…","جارٍ الاتصال…") + "</h2>" +
          "<p class='gate-sub' id='ggo-msg' role='status'>" +
            TS("On termine avec Google, ça prend deux secondes.",
               "ننهي الاتصال مع Google، لن يطول الأمر.") + "</p>" +
          "<p class='gate-err' id='ggo-err' role='alert'></p>" +
          "<button class='btn ghost' id='ggo-back' style='display:none'>" + T("Retour","رجوع") + "</button>" +
        "</div>";
      cloudGoogle(targetProfile).then(function(r){
        if(r.ok){
          if(r.cree) return showGate("welcome", r.profile);
          hideGate(); bootProfile();
          if(r.linked){openSettings("account");toast(TL("Google est associé à ton compte.","تم ربط Google بحسابك."));return;}
          toast(TL("Bienvenue, " + esc(r.profile.name) + ".","مرحبا، " + esc(r.profile.name) + "."));
          return;
        }
        document.getElementById("ggo-msg").style.display = "none";
        cloudErrInto("ggo-err", r.message);
        var b = document.getElementById("ggo-back");
        b.style.display = "";
        b.addEventListener("click", function(){
          showGate(account.profiles.length ? "pick" : "create");
        });
      });
      document.getElementById("gate-box").focus();
      return;
    }

    /* Arrivée par le lien de confirmation. targetProfile porte ici le
       jeton, déjà retiré de la barre d'adresse. */
    if(mode === "confirming"){
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<h2 id='gate-title'>" + T("Confirmation…","جارٍ التأكيد…") + "</h2>" +
          "<p class='gate-sub' id='gcon-msg' role='status'>" +
            TS("On vérifie ton adresse, ça prend deux secondes.",
               "نتحقّق من بريدك، لن يطول الأمر.") + "</p>" +
          "<p class='gate-err' id='gcon-err' role='alert'></p>" +
          "<button class='btn' id='gcon-again' style='display:none'>" + T("Me renvoyer un lien","أرسل لي رابطا جديدا") + "</button>" +
          "<button class='btn ghost' id='gcon-back' style='display:none;margin-top:9px;'>" + T("Retour","رجوع") + "</button>" +
        "</div>";
      cloudConfirm(targetProfile).then(function(r){
        if(r.ok){
          if(r.cree) return showGate("welcome", r.profile);
          hideGate(); bootProfile();
          toast(TL("Adresse confirmée — bienvenue, " + esc(r.profile.name) + ".",
                   "تم تأكيد البريد — مرحبا، " + esc(r.profile.name) + "."));
          return;
        }
        document.getElementById("gcon-msg").style.display = "none";
        cloudErrInto("gcon-err", r.message);
        var encore = document.getElementById("gcon-again");
        var retour = document.getElementById("gcon-back");
        retour.style.display = "";
        retour.addEventListener("click", function(){
          showGate(cloudPending() ? "pending" : (account.profiles.length ? "pick" : "create"));
        });
        var att = cloudPending();
        if(r.expired && att && att.email){
          encore.style.display = "";
          encore.addEventListener("click", function(){
            cloudBusy(encore, true, TL("Envoi…","جارٍ الإرسال…"));
            cloudResend(att.email).then(function(){ showGate("pending"); });
          });
        }
      });
      document.getElementById("gate-box").focus();
      return;
    }

    /* « J'ai oublié » : la réponse est volontairement la MÊME que
       l'adresse existe ou non. Le serveur répond 204 dans les deux cas
       pour ne dire à personne qui a un compte ici ; si l'interface
       disait « adresse inconnue », elle rouvrirait à elle seule la
       fuite que le serveur s'applique à fermer. */
    if(mode === "forgot"){
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<h2 id='gate-title'>" + T("Mot de passe oublié","نسيت كلمة السر") + "</h2>" +
          "<p class='gate-sub'>" + TS("Donne ton adresse : on t'envoie un lien pour en choisir un nouveau.",
                                      "أدخل بريدك: سنرسل لك رابطا لاختيار كلمة سر جديدة.") + "</p>" +
          "<label class='sr-only' for='gfor-email'>" + TL("Adresse e-mail","البريد الإلكتروني") + "</label>" +
          "<input class='gate-input' id='gfor-email' type='email' inputmode='email' autocomplete='email' " +
            "autocapitalize='off' spellcheck='false' placeholder='E-mail · البريد' aria-label=\"" + TL("Adresse e-mail","البريد الإلكتروني") + "\" />" +
          "<p class='gate-err' id='gfor-err' role='alert'></p>" +
          "<p class='gate-note' id='gfor-done' style='display:none' role='status'></p>" +
          "<button class='btn' id='gfor-go'>" + T("Envoyer le lien","أرسل الرابط") + "</button>" +
          "<button class='btn ghost' id='gate-back' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>" +
        "</div>";
      var forEmail = document.getElementById("gfor-email");
      if(typeof targetProfile === "string") forEmail.value = targetProfile;
      var forBtn = document.getElementById("gfor-go");
      function doForgot(){
        var mail = forEmail.value.trim();
        cloudErrInto("gfor-err", "");
        if(!mail){ return cloudErrInto("gfor-err", cloudErrorText("bad_email")); }
        cloudBusy(forBtn, true, TL("Envoi…","جارٍ الإرسال…"));
        cloudForgot(mail).then(function(r){
          cloudBusy(forBtn, false);
          if(!r.ok){ return cloudErrInto("gfor-err", r.message); }
          var done = document.getElementById("gfor-done");
          done.style.display = "";
          done.innerHTML = TS(
            "Si un compte existe avec cette adresse, le lien vient de partir. Il est valable une heure — pense à regarder dans les indésirables.",
            "إن كان هناك حساب بهذا البريد، فقد أُرسل الرابط. صالح لمدة ساعة — تحقّق من البريد غير المرغوب فيه.");
          forBtn.disabled = true;
        });
      }
      forBtn.addEventListener("click", doForgot);
      forEmail.addEventListener("keydown", function(e){ if(e.key === "Enter") doForgot(); });
      document.getElementById("gate-back").addEventListener("click", function(){ showGate("login"); });
      forEmail.focus();
      return;
    }

    /* Arrivée par le lien reçu par courriel. targetProfile porte ici le
       jeton de réinitialisation, déjà retiré de la barre d'adresse. */
    if(mode === "reset"){
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-brand'>Wilaya<span>DZ</span></div>" +
          "<h2 id='gate-title'>" + T("Nouveau mot de passe","كلمة سر جديدة") + "</h2>" +
          "<p class='gate-sub'>" + TS("Choisis-en un nouveau : tu seras connecté dans la foulée.",
                                      "اختر كلمة سر جديدة: ستدخل مباشرة بعدها.") + "</p>" +
          passwordFieldHtml("gres-pw", "Mot de passe · كلمة السر",
                            "new-password", TL("Nouveau mot de passe","كلمة السر الجديدة")) +
          passwordFieldHtml("gres-pw2", "Répéter le mot de passe · كرّر كلمة السر",
                            "new-password", TL("Répéter le mot de passe","كرّر كلمة السر")) +
          passwordRuleHtml() +
          "<p class='gate-note'>" + TS("Tous les appareils déjà connectés à ce compte devront se reconnecter.",
                                       "ستحتاج كل الأجهزة المتصلة بهذا الحساب إلى إعادة الاتصال.") + "</p>" +
          "<p class='gate-err' id='gres-err' role='alert'></p>" +
          "<button class='btn' id='gres-go'>" + T("Valider","تأكيد") + "</button>" +
          "<button class='btn ghost' id='gres-again' style='margin-top:9px;display:none'>" + T("Demander un nouveau lien","اطلب رابطا جديدا") + "</button>" +
          "<button class='btn ghost' id='gate-back' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>" +
        "</div>";
      wirePasswordEyes(document.getElementById("gate-box"));
      var resPw = document.getElementById("gres-pw");
      var resBtn = document.getElementById("gres-go");
      function doReset(){
        var pw = resPw.value || "";
        var pw2 = document.getElementById("gres-pw2").value || "";
        cloudErrInto("gres-err", "");
        var souci = passwordProblem(pw, pw2);
        if(souci){ return cloudErrInto("gres-err", souci); }
        cloudBusy(resBtn, true, TL("Patiente…","انتظر…"));
        cloudResetWithToken(targetProfile, pw).then(function(r){
          cloudBusy(resBtn, false);
          if(!r.ok){
            cloudErrInto("gres-err", r.message);
            document.getElementById("gres-again").style.display = "";
            return;
          }
          hideGate(); bootProfile();
          toast(TL("Mot de passe changé — te voilà connecté.",
                   "تم تغيير كلمة السر — أنت متصل الآن."));
        });
      }
      resBtn.addEventListener("click", doReset);
      document.getElementById("gres-pw2").addEventListener("keydown", function(e){ if(e.key === "Enter") doReset(); });
      document.getElementById("gres-again").addEventListener("click", function(){ showGate("forgot"); });
      document.getElementById("gate-back").addEventListener("click", function(){
        showGate(account.profiles.length ? "pick" : "create");
      });
      resPw.focus();
      return;
    }

    if(mode === "create"){
      /* targetProfile, s'il s'agit d'un profil, est une progression qui
         existe deja sur cet appareil et qu'il faut rattacher au compte
         qu'on va creer — surtout pas remplacer par un compte vide. */
      var attachTo = (targetProfile && typeof targetProfile === "object") ? targetProfile : null;
      /* Trois champs, rien de plus. La langue se choisit déjà dans le
         profil et l'application est bilingue de toute façon ; le code
         d'accès est un verrou local qui n'a rien à faire ici. Les deux
         prenaient 60 % de la hauteur d'un écran que tout le monde voit
         en premier — et qu'il fallait faire défiler pour rien. */
      gate.innerHTML =
        "<div class='gate-box' role='dialog' aria-modal='true' aria-labelledby='gate-title' tabindex='-1' id='gate-box'>" +
          "<div class='gate-avatar'>" + USER_ICON + "</div>" +
          "<h2 id='gate-title'>" + T("Créer ton compte","أنشئ حسابك") + "</h2>" +
          "<p class='gate-sub'>" + (attachTo
            ? TS("La progression de « " + esc(attachTo.name) + " » déjà sur cet appareil sera envoyée sur ce compte. Rien n'est effacé.",
                 "سيُرسل تقدّم « " + esc(attachTo.name) + " » الموجود على هذا الجهاز إلى هذا الحساب. لا شيء يُمحى.")
            : TS("Tu la retrouveras sur n'importe quel appareil où tu te connectes.",
                 "ستجد تقدّمك على أي جهاز تتصل منه.")) + "</p>" +
          cloudFieldsHtml("gate", {name:true, newPassword:true, confirm:true}) +
          cloudRecoveryNote() +
          "<p class='gate-err' id='gate-err' role='alert'></p>" +
          "<button class='btn' id='gate-create'>" + T("Créer le compte","أنشئ الحساب") + "</button>" +
          legalNoteHtml() +
          googleButtonHtml("gate") +
          "<button class='btn ghost' id='gate-login' style='margin-top:9px;'>" + T("J'ai déjà un compte","لدي حساب") + "</button>" +
          (account.profiles.length ? "<button class='btn ghost' id='gate-back' style='margin-top:9px;'>" + T("Retour","رجوع") + "</button>" : "") +
        "</div>";
      var gateBox = document.getElementById("gate-box");
      wirePasswordEyes(gateBox);
      wireGoogleButton(gateBox, attachTo);
      var nameInp = document.getElementById("gate-name");
      var createBtn = document.getElementById("gate-create");
      if(attachTo) nameInp.value = attachTo.name;

      function doCreate(){
        var f = cloudReadFields("gate");
        cloudErrInto("gate-err", "");
        if(!f.name){ cloudErrInto("gate-err", TL("Choisis un pseudo.","اختر اسما مستعارا.")); nameInp.focus(); return; }
        if(!f.email){ cloudErrInto("gate-err", cloudErrorText("bad_email")); return; }
        var souci = passwordProblem(f.pw, f.pw2);
        if(souci){ cloudErrInto("gate-err", souci); return; }

        cloudBusy(createBtn, true, TL("Création…","جارٍ الإنشاء…"));
        var demarche;
        if(attachTo){
          attachTo.name = f.name;
          account.activeId = attachTo.id;
          saveAccount();
          demarche = cloudRegister(attachTo, f.email, f.name, f.pw);
        }else{
          demarche = cloudRegisterNew(f.name, f.email, f.pw, "bi");
        }
        demarche.then(function(r){
          cloudBusy(createBtn, false);
          if(!r.ok){ cloudErrInto("gate-err", r.message); return; }
          showGate("pending", f.email);
        });
      }
      createBtn.addEventListener("click", doCreate);
      document.getElementById("gate-pw2").addEventListener("keydown", function(e){
        if(e.key === "Enter") doCreate();
      });
      document.getElementById("gate-login").addEventListener("click", function(){ showGate("login", attachTo); });
      var back = document.getElementById("gate-back");
      if(back) back.addEventListener("click", function(){ showGate("pick"); });
      nameInp.focus();
      return;
    }

    /* mode "pick" */
    var list = account.profiles.map(function(p){
      var s = profileStats(p);
      /* Un profil d'avant les comptes n'a rien de cassé : il a juste
         besoin d'être rattaché une fois. On le dit, on ne le cache pas,
         et surtout on n'efface rien. */
      var orphan = !cloudOf(p);
      var ligne = orphan
        ? TL("à rattacher à un compte","بحاجة إلى ربط بحساب")
        : s.tracked + " wilayas · " + s.xp + " XP · " + s.streak + "🔥";
      return "<button class='gate-profile" + (orphan ? " orphan" : "") + "' data-id='" + p.id + "' aria-label=\"" +
             esc(TL(p.name + ", " + s.tracked + " wilayas suivies, " + s.xp + " XP"
                    + (orphan ? ", à rattacher à un compte" : "")
                    + (p.pin ? ", protégé par un code" : ""),
                p.name + "، " + s.tracked + " ولاية، " + s.xp + " نقطة"
                    + (orphan ? "، بحاجة إلى ربط بحساب" : ""))) + "\">" +
               avatarHtml(p, "gate-profile-av") +
               "<span class='gate-profile-body'>" +
                 "<b>" + esc(p.name) + "</b>" +
                 "<span>" + ligne + "</span>" +
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
        "<button class='btn ghost' id='gate-new'>" + T("+ Nouveau compte","+ حساب جديد") + "</button>" +
        "<button class='btn ghost' id='gate-login' style='margin-top:9px;'>" + T("Se connecter à un compte","الدخول إلى حساب") + "</button>" +
      "</div>";

    Array.prototype.forEach.call(gate.querySelectorAll(".gate-profile"), function(b){
      b.addEventListener("click", function(){
        var id = b.getAttribute("data-id");
        var p = account.profiles.filter(function(x){ return x.id === id; })[0];
        if(!p) return;
        /* Rattachement d'abord : le compte est désormais obligatoire.
           La progression de ce profil sera envoyée sur le compte, pas
           remplacée par lui. */
        if(!cloudOf(p)){ showGate("create", p); return; }
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
    buildMap();
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
        avatarHtml(p, "profile-av") +
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
                     avatarHtml(o, "gate-profile-av") +
                     "<span class='gate-profile-body'><b>" + esc(o.name) + "</b><span>" + profileStats(o).tracked + " wilayas · " + profileStats(o).xp + " XP</span></span>" +
                     (o.pin ? "<span class='gate-profile-lock' aria-hidden='true'>" + LOCKSM_ICON + "</span>" : "") +
                   "</button>";
          }).join("")
        : "") +
      "<p class='sub' style='margin:18px 0 8px;'>" + TL("Langue de l'interface","لغة الواجهة") + "</p>" +
      langPickerHtml(p.lang || "bi") +
      cloudRowHtml(p) +
      "<button class='profile-row' id='prof-name' style='margin-top:14px'>" +
        "<span class='cloud-row-icon'>" + USER_ICON + "</span>" +
        "<span class='gate-profile-body'>" +
          "<b>" + TL("Ton pseudo","اسمك المستعار") + "</b>" +
          "<span>" + esc(p.name) + "</span>" +
        "</span>" +
      "</button>" +
      "<button class='profile-row' id='prof-avatar'>" +
        avatarHtml(p, "gate-profile-av") +
        "<span class='gate-profile-body'>" +
          "<b>" + TL("Ta photo","صورتك") + "</b>" +
          "<span>" + TL("Une mascotte, ou ta propre photo","شخصية، أو صورتك") + "</span>" +
        "</span>" +
      "</button>" +
      "<p class='sub' style='margin:18px 0 8px;'>" + TL("Sur cet appareil","على هذا الجهاز") + "</p>" +
      /* La musique est un réglage d'APPAREIL, pas de compte : elle coûte
         des données, et ce qu'on veut dans le bus n'est pas ce qu'on
         veut dans le salon. */
      musiqueRowHtml() +
      "<button class='profile-row' id='prof-pin'>" +
        "<span class='cloud-row-icon'>" + LOCKSM_ICON + "</span>" +
        "<span class='gate-profile-body'>" +
          "<b>" + TL("Code d'accès","رمز الدخول") + "</b>" +
          "<span>" + (p.pin
            ? TL("Ton profil est verrouillé ici","ملفك مقفل هنا")
            : TL("Personne n'a besoin de code pour l'ouvrir","لا حاجة لرمز لفتحه")) + "</span>" +
        "</span>" +
      "</button>" +
      "<button class='btn ghost' id='prof-new' style='margin-top:12px;'>" + T("+ Nouveau compte","+ حساب جديد") + "</button>" +
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
    document.getElementById("prof-name").addEventListener("click", openRenameSheet);
    document.getElementById("prof-avatar").addEventListener("click", openAvatarSheet);
    wireMusiqueRow(function(){ openProfileSheet(); });
    document.getElementById("prof-pin").addEventListener("click", openPinSheet);
    document.getElementById("prof-new").addEventListener("click", function(){ closeSheet(); showGate("create"); });
    document.getElementById("prof-sync").addEventListener("click", function(){
      closeSheet(); openSettings("backup");
      document.getElementById("settings-transfer").open = true;
      document.getElementById("sync-section").scrollIntoView({behavior:prefersReducedMotion()?"auto":"smooth", block:"start"});
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

  /* ---------------- Code d'accès local ----------------
     Il a quitté l'inscription : c'est un verrou propre à cet appareil,
     sans rapport avec le compte, et il encombrait le premier écran que
     tout le monde voit. Sa place est ici, où l'on vient quand on décide
     de partager son téléphone. */
  function openPinSheet(){
    var p = activeProfile();
    if(!p) return;
    var aDeja = !!p.pin;
    openSheet(
      "<h2 id='sheet-title'>" + T("Code d'accès","رمز الدخول") + "</h2>" +
      "<p class='sub'>" + TS(
        "Il verrouille « " + esc(p.name) + " » sur CET appareil, pour que personne d'autre ne l'ouvre ici. Il ne remplace pas ton mot de passe et ne se récupère pas — mais ton compte, lui, reste accessible ailleurs.",
        "يقفل « " + esc(p.name) + " » على هذا الجهاز فقط. لا يحل محل كلمة السر ولا يمكن استرجاعه — لكن حسابك يبقى متاحا في مكان آخر.") + "</p>" +
      (aDeja
        ? "<label class='sr-only' for='pin-old'>" + TL("Code actuel","الرمز الحالي") + "</label>" +
          "<input class='gate-pin' id='pin-old' type='password' inputmode='numeric' maxlength='6' " +
            "autocomplete='off' placeholder='••••' aria-label=\"" + TL("Code actuel","الرمز الحالي") + "\" />"
        : "") +
      "<label class='sr-only' for='pin-new'>" + TL("Nouveau code, 4 à 6 chiffres","رمز جديد من 4 إلى 6 أرقام") + "</label>" +
      "<input class='gate-pin' id='pin-new' type='password' inputmode='numeric' maxlength='6' " +
        "autocomplete='off' placeholder='••••' aria-label=\"" + TL("Nouveau code, 4 à 6 chiffres","رمز جديد من 4 إلى 6 أرقام") + "\" />" +
      "<p class='gate-err' id='pin-err' role='alert'></p>" +
      "<button class='btn' id='pin-save'>" + (aDeja ? T("Changer le code","غيّر الرمز") : T("Activer le code","فعّل الرمز")) + "</button>" +
      (aDeja ? "<button class='btn ghost danger' id='pin-off' style='margin-top:9px;'>" + T("Retirer le code","أزل الرمز") + "</button>" : "") +
      "<button class='btn ghost' id='sheet-close' style='margin-top:9px;'>" + T("Fermer","إغلاق") + "</button>"
    );

    function codeActuelBon(){
      if(!aDeja) return true;
      var v = (document.getElementById("pin-old").value || "").trim();
      return hashPin(v, p.salt) === p.pin;
    }
    document.getElementById("pin-save").addEventListener("click", function(){
      cloudErrInto("pin-err", "");
      if(!codeActuelBon()){ return cloudErrInto("pin-err", TL("Code actuel incorrect.","الرمز الحالي غير صحيح.")); }
      var n = (document.getElementById("pin-new").value || "").trim();
      if(!/^\d{4,6}$/.test(n)){
        return cloudErrInto("pin-err", TL("Le code doit faire 4 à 6 chiffres.","الرمز من 4 إلى 6 أرقام."));
      }
      p.pin = hashPin(n, p.salt);
      saveAccount(); closeSheet();
      toast(TL("Code d'accès enregistré.","حُفظ رمز الدخول."));
    });
    var off = document.getElementById("pin-off");
    if(off) off.addEventListener("click", function(){
      cloudErrInto("pin-err", "");
      if(!codeActuelBon()){ return cloudErrInto("pin-err", TL("Code actuel incorrect.","الرمز الحالي غير صحيح.")); }
      p.pin = null; saveAccount(); closeSheet();
      toast(TL("Code retiré.","أُزيل الرمز."));
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
          var blob=new Blob([exportCode(p)],{type:'text/plain;charset=utf-8'});
          var url=URL.createObjectURL(blob), link=document.createElement('a');
          link.href=url; link.download='wilayadz-sauvegarde.txt';
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(function(){URL.revokeObjectURL(url);},30000);
          toast(TL("Sauvegarde téléchargée.","تم تنزيل النسخة."));
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
      TL("Le code vient de « " + esc(obj.n || "?") + " » et contient " + n + " wilayas. Il sera FUSIONNÉ avec « " + esc(p.name) + " » : les réponses les plus récentes sont conservées. Une remise à zéro plus récente est également appliquée.",
         "الرمز من « " + esc(obj.n || "?") + " » ويحتوي " + n + " ولاية. سيُدمج مع « " + esc(p.name) + " »: تُحفظ أحدث الإجابات وتُطبّق أيضا إعادة الضبط الأحدث."),
      TL("Fusionner","ادمج")
    ).then(function(ok){
      if(!ok) return;
      flushActive(p);
      var r = mergeInto(p, obj);
      if(r.error){ toast(cloudErrorText(r.error)); return; }
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

  function shareUrl(compact){
    var p = activeProfile();
    if(!p) return null;
    return location.origin + location.pathname + "#w=" + exportCode(p, compact);
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
      var url = shareUrl(true);
      if(!url) return;
      try{
        if(url.length > 2300) throw new Error("too_large");
        var qr = qrcode(0, "M");
        qr.addData(url);
        qr.make();
        qrBox.innerHTML = qr.createSvgTag({scalable:true});
        qrBox.style.display = ""; qrHint.style.display = "";
        qrBtn.setAttribute("aria-expanded","true");
      }catch(e){
        toast(TL("Sauvegarde trop volumineuse pour un QR. Utilise « Enregistrer » pour transférer le fichier.","النسخة أكبر من سعة رمز QR. استخدم «احفظ» لنقل الملف."));
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
