
  /* ============================================================
     COMPTE EN LIGNE ET SYNCHRONISATION
     Un compte (adresse e-mail + mot de passe) rattache un profil local
     au serveur, de sorte que la même progression se retrouve sur
     n'importe quel appareil où l'on se connecte.

     Trois règles tiennent tout le reste :
       1. Le serveur n'est exigé qu'UNE fois : à l'ouverture du compte
          ou à la connexion. Ensuite la session reste sur l'appareil et
          l'application travaille sur sa mémoire locale — hors ligne,
          dans l'APK, en avion — la synchronisation reprenant d'elle
          même au retour du réseau. Une panne du service ne doit jamais
          empêcher de réviser.
       2. On ne remplace jamais, on FUSIONNE — avec exactement la même
          fonction (mergeInto) que les codes de transfert, déjà éprouvée :
          pour chaque wilaya, la meilleure des deux mémoires gagne.
       3. Rien n'est poussé sans avoir d'abord lu ce que le serveur a.
          C'est ce qui permet à deux appareils utilisés le même jour de
          converger au lieu de s'effacer l'un l'autre.
     ============================================================ */

  /* En http(s) l'API est sur la même origine. Dans l'APK (file://) il
     n'y a pas d'origine : on vise alors le site de production, sinon la
     synchronisation serait impossible là où elle est la plus utile — un
     téléphone qu'on emmène. */
  var CLOUD_HOME = "https://wilayadz.smnc.win";
  function cloudBase(){
    return /^https?:$/.test(location.protocol)
      ? location.origin + "/api"
      : CLOUD_HOME + "/api";
  }
  function cloudAvailable(){ return typeof fetch === "function"; }

  var CLOUD_TIMEOUT = 15000;
  var CLOUD_DEBOUNCE = 10000;

  /* ---------------- Transport ---------------- */

  /* Ne rejette jamais sur une panne réseau : une coupure n'est pas une
     erreur de programme, c'est l'état normal d'un téléphone. L'appelant
     reçoit status 0 et décide quoi en dire. */
  function cloudCall(method, path, body, token){
    if(!cloudAvailable()) return Promise.resolve({status:0, data:null});
    var ctrl = (typeof AbortController === "function") ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, CLOUD_TIMEOUT) : null;
    var opts = { method:method, headers:{}, cache:"no-store" };
    if(ctrl) opts.signal = ctrl.signal;
    if(body !== undefined && body !== null){
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if(token) opts.headers["Authorization"] = "Bearer " + token;

    return fetch(cloudBase() + path, opts).then(function(res){
      if(timer) clearTimeout(timer);
      return res.text().then(function(txt){
        var data = null;
        if(txt){ try{ data = JSON.parse(txt); }catch(e){ data = null; } }
        return {status:res.status, data:data};
      });
    }).catch(function(){
      if(timer) clearTimeout(timer);
      return {status:0, data:null};
    });
  }

  /* Le serveur ne renvoie que des codes stables ; c'est ici, et nulle
     part côté serveur, qu'on sait parler français et arabe. */
  function cloudErrorText(code){
    switch(code){
      case "bad_email":       return TL("Cette adresse e-mail n'est pas valide.","هذا البريد الإلكتروني غير صالح.");
      case "bad_name":        return TL("Écris un prénom (18 caractères au plus).","اكتب اسما (18 حرفا على الأكثر).");
      case "weak_password":   return TL("Le mot de passe doit faire au moins 8 caractères.","كلمة السر 8 أحرف على الأقل.");
      case "email_taken":     return TL("Un compte existe déjà avec cette adresse.","يوجد حساب بهذا البريد الإلكتروني.");
      case "bad_credentials": return TL("Adresse ou mot de passe incorrect.","البريد أو كلمة السر غير صحيحة.");
      case "too_many":        return TL("Trop de tentatives. Réessaie dans un moment.","محاولات كثيرة. أعد المحاولة بعد قليل.");
      case "unauthorized":    return TL("Session expirée — reconnecte-toi.","انتهت الجلسة — أعد الاتصال.");
      case "not_verified":    return TL("Confirme d'abord ton adresse e-mail.","أكّد بريدك الإلكتروني أولا.");
      case "too_large":       return TL("Progression trop volumineuse pour être envoyée.","التقدّم أكبر من أن يُرسل.");
      case "offline":         return TL("Pas de connexion — réessaie plus tard.","لا يوجد اتصال — أعد المحاولة لاحقا.");
      default:                return TL("Le service est indisponible pour le moment.","الخدمة غير متاحة حاليا.");
    }
  }
  function cloudFailText(res){
    if(res.status === 0) return cloudErrorText("offline");
    return cloudErrorText(res.data && res.data.error);
  }

  /* ---------------- État attaché au profil ---------------- */

  function cloudOf(p){ return (p && p.cloud) || null; }
  function cloudLinked(p){ var c = cloudOf(p); return !!(c && c.token); }

  function attachCloud(p, account, token){
    p.cloud = { email:account.email, name:account.name, token:token,
                version:0, lastSync:0, lastError:null };
    saveAccount();
  }
  function detachCloud(p){
    if(p) { p.cloud = null; saveAccount(); }
  }

  /* Un même compte ne peut pas être branché sur deux profils du même
     appareil : les deux se pousseraient dessus en boucle. */
  function profileForEmail(email){
    for(var i=0;i<account.profiles.length;i++){
      var c = cloudOf(account.profiles[i]);
      if(c && c.email === email) return account.profiles[i];
    }
    return null;
  }

  /* ---------------- Synchronisation ---------------- */

  var syncInFlight = false;
  var syncTimer = null;

  /* Le profil actif a sa progression en cours dans `state`, pas encore
     forcément écrite dans p.data. Il faut la coucher AVANT de fusionner,
     sinon la fusion travaille sur une version périmée et le prochain
     persist() écrase le résultat. */
  function flushActive(p){
    if(activeProfile() && activeProfile().id === p.id) persist();
  }
  function reloadActive(p){
    if(activeProfile() && activeProfile().id === p.id) bootProfile();
  }

  /* Renvoie une promesse de {ok, changed, added, improved, error}. */
  function cloudSync(p, opts){
    opts = opts || {};
    var c = cloudOf(p);
    if(!c || !c.token) return Promise.resolve({ok:false, error:"unlinked"});
    if(syncInFlight) return Promise.resolve({ok:false, error:"busy"});
    syncInFlight = true;

    flushActive(p);
    var added = 0, improved = 0;

    function finish(result){
      syncInFlight = false;
      c.lastError = result.ok ? null : (result.error || "unknown");
      saveAccount();
      return result;
    }

    function pushWith(baseVersion, attempt){
      return cloudCall("PUT", "/sync",
                       {base_version:baseVersion, data:packProfile(p)}, c.token)
        .then(function(res){
          if(res.status === 200){
            c.version = res.data.version;
            c.lastSync = Date.now();
            return {ok:true, changed:(added+improved) > 0, added:added, improved:improved};
          }
          /* 409 : un autre appareil a écrit entre notre lecture et notre
             envoi. On refusionne sur l'état qu'il nous rend et on
             retente une seule fois — au-delà, mieux vaut réessayer plus
             tard que de boucler sur un appareil qui écrit sans arrêt. */
          if(res.status === 409 && attempt < 2){
            if(res.data && res.data.data){
              var r = mergeInto(p, res.data.data);
              added += r.added; improved += r.improved;
              saveAccount();
            }
            return pushWith(res.data.version, attempt + 1);
          }
          if(res.status === 401){ c.token = null; }
          return {ok:false, error:(res.status === 0 ? "offline"
                                 : (res.data && res.data.error) || "push")};
        });
    }

    return cloudCall("GET", "/sync", null, c.token).then(function(res){
      if(res.status === 401){ c.token = null; return finish({ok:false, error:"unauthorized"}); }
      if(res.status !== 200)  return finish({ok:false, error:(res.status === 0 ? "offline" : "pull")});

      if(res.data && res.data.data){
        var r = mergeInto(p, res.data.data);
        added = r.added; improved = r.improved;
        saveAccount();
      }
      return pushWith(res.data.version, 1).then(function(out){
        if(out.ok && out.changed && !opts.silent) reloadActive(p);
        return finish(out);
      });
    });
  }

  /* Poussée discrète après une réponse : on ne synchronise pas à chaque
     bonne réponse (ce serait une requête toutes les trois secondes),
     mais une fois que la personne s'est arrêtée un moment. */
  function cloudScheduleSync(){
    var p = activeProfile();
    if(!p || !cloudLinked(p) || !cloudAvailable()) return;
    if(syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function(){
      syncTimer = null;
      cloudSync(p, {silent:true}).then(function(r){
        if(r && r.ok) renderCloudBadge();
      });
    }, CLOUD_DEBOUNCE);
  }

  /* Quitter l'application est le moment le plus probable où l'on passe
     à l'autre appareil : c'est là qu'il faut avoir poussé. */
  function cloudFlushNow(){
    if(syncTimer){ clearTimeout(syncTimer); syncTimer = null; }
    var p = activeProfile();
    if(p && cloudLinked(p)) cloudSync(p, {silent:true});
  }
  if(typeof document !== "undefined"){
    document.addEventListener("visibilitychange", function(){
      if(document.visibilityState === "hidden") cloudFlushNow();
    });
  }
  if(typeof window !== "undefined"){
    window.addEventListener("online", function(){ cloudScheduleSync(); });
  }

  /* Au démarrage on tire d'abord ce que les autres appareils ont fait,
     une seule fois par profil et par session : bootProfile() est
     rappelé après chaque fusion, et sans ce garde-fou la lecture
     relancerait une lecture, indéfiniment. */
  var cloudBooted = {};
  function cloudBootSync(){
    var p = activeProfile();
    if(!p) return;
    renderCloudBadge();
    if(!cloudLinked(p) || cloudBooted[p.id]) return;
    cloudBooted[p.id] = true;
    cloudSync(p).then(function(){ renderCloudBadge(); });
  }

  /* ---------------- Opérations de compte ---------------- */

  /* Rattacher un profil existant à un compte tout neuf. Rien n'est
     attaché tout de suite : tant que l'adresse n'est pas confirmée,
     rien ne prouve qu'elle appartient à celui qui vient de la saisir. */
  function cloudRegister(p, email, name, password){
    return cloudCall("POST", "/auth/register",
                     {email:email, name:name, password:password})
      .then(function(res){
        if(res.status !== 202) return {ok:false, message:cloudFailText(res)};
        setPending(res.data.email, name, p.lang || "bi", p.id);
        return {ok:true, pending:true};
      });
  }

  /* ---------------- Inscription en attente ---------------- */

  /* Entre l'inscription et la confirmation, il faut se souvenir de ce
     qu'on attend : quelle adresse, sous quel prénom, et — si l'on
     rattachait un profil déjà garni — lequel. C'est rangé avec les
     profils, donc ça survit à la fermeture de l'application. */
  function setPending(email, name, lang, profileId){
    account.pending = { email:email, name:name, lang:lang || "bi",
                        profileId: profileId || null, since: Date.now() };
    saveAccount();
  }
  function clearPending(){
    if(account.pending){ account.pending = null; saveAccount(); }
  }
  function cloudPending(){ return account.pending || null; }

  function cloudResend(email){
    return cloudCall("POST", "/auth/resend", {email:email})
      .then(function(res){
        return res.status === 204 ? {ok:true} : {ok:false, message:cloudFailText(res)};
      });
  }

  function cloudConfirm(token){
    return cloudCall("POST", "/auth/confirm", {token:token})
      .then(function(res){
        if(res.status !== 200){
          var code = res.data && res.data.error;
          if(code === "bad_token"){
            return {ok:false, expired:true, message:TL(
              "Ce lien n'est plus valable — il expire au bout de 24 heures. Fais-t'en renvoyer un.",
              "هذا الرابط لم يعد صالحا — ينتهي بعد 24 ساعة. اطلب رابطا جديدا.")};
          }
          return {ok:false, message:cloudFailText(res)};
        }
        var attente = cloudPending();
        var cible = null;
        if(attente && attente.profileId){
          for(var i=0;i<account.profiles.length;i++){
            if(account.profiles[i].id === attente.profileId) cible = account.profiles[i];
          }
        }
        if(cible && attente.lang) cible.lang = attente.lang;
        return adoptSession(res.data.account, res.data.token, cible)
          .then(function(r){
            /* Le code d'accès local choisi à l'inscription attendait que
               le profil existe. On n'a jamais stocké le code, seulement
               son empreinte et son sel. */
            if(attente && attente.pinHash && r.profile && !r.profile.pin){
              r.profile.salt = attente.pinSalt;
              r.profile.pin = attente.pinHash;
              saveAccount();
            }
            clearPending();
            return r;
          });
      });
  }

  function cloudPendingConfirm(){
    var m = String(location.hash || "").match(/#confirm=([A-Za-z0-9\-_]{16,128})/);
    if(!m) return null;
    try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
    return m[1];
  }

  function cloudLoginInto(p, email, password){
    return cloudCall("POST", "/auth/login", {email:email, password:password})
      .then(function(res){
        if(res.status !== 200){
          return {ok:false, code:(res.data && res.data.error),
                  message:cloudFailText(res)};
        }
        var acc = res.data.account;
        var clash = profileForEmail(acc.email);
        if(clash && clash.id !== p.id){
          return {ok:false, message:TL(
            "Ce compte est déjà relié au profil « " + esc(clash.name) + " » sur cet appareil.",
            "هذا الحساب مرتبط بالفعل بالملف « " + esc(clash.name) + " » على هذا الجهاز.")};
        }
        attachCloud(p, acc, res.data.token);
        cloudBooted[p.id] = true;
        return cloudSync(p).then(function(r){
          return {ok:true, added:r.added||0, improved:r.improved||0};
        });
      });
  }

  /* Un compte vient d'être reconnu (connexion, inscription ou nouveau
     mot de passe) : on lui donne un profil local — le sien s'il en a
     déjà un sur cet appareil, un neuf sinon — puis on synchronise. */
  function adoptSession(acc, token, cible){
    var existing = cible || profileForEmail(acc.email);
    var neuf = !existing;
    var p;
    if(existing){
      account.activeId = existing.id;
      existing.cloud = existing.cloud || {};
      existing.cloud.email = acc.email;
      existing.cloud.token = token;
      existing.cloud.lastError = null;
      saveAccount();
      p = existing;
    }else{
      p = createProfile(acc.name, null, "bi");
      attachCloud(p, acc, token);
    }
    cloudBooted[p.id] = true;
    return cloudSync(p).then(function(r){
      return {ok:true, profile:p, cree:neuf, added:(r && r.added) || 0,
              improved:(r && r.improved) || 0};
    });
  }

  /* Connexion sur un appareil neuf : le compte amène son propre profil
     local, puis récupère sa progression. */
  function cloudLoginNewProfile(email, password){
    return cloudCall("POST", "/auth/login", {email:email, password:password})
      .then(function(res){
        if(res.status !== 200){
          return {ok:false, code:(res.data && res.data.error),
                  message:cloudFailText(res)};
        }
        return adoptSession(res.data.account, res.data.token);
      });
  }

  /* Inscription depuis la porte d'entrée : on n'écrit RIEN en local
     tant que le serveur n'a pas accepté, sinon un refus (adresse déjà
     prise, mot de passe trop court) laisserait derrière lui un profil
     fantôme que personne n'a demandé. */
  function cloudRegisterNew(name, email, password, lang){
    return cloudCall("POST", "/auth/register",
                     {email:email, name:name, password:password})
      .then(function(res){
        if(res.status !== 202) return {ok:false, message:cloudFailText(res)};
        /* Aucun profil local n'est créé ici : tant que l'adresse n'est
           pas confirmée, il ne servirait à rien et resterait en travers
           du chemin si la personne abandonne. */
        setPending(res.data.email, name, lang || "bi", null);
        return {ok:true, pending:true};
      });
  }

  /* ---------------- Mot de passe oublié ---------------- */

  /* Le serveur répond 204 quoi qu'il arrive — adresse connue ou non.
     L'interface doit donc dire exactement la même chose dans les deux
     cas, sinon elle réintroduit elle-même la fuite que le serveur
     s'applique à éviter. */
  function cloudForgot(email){
    return cloudCall("POST", "/auth/forgot", {email:email})
      .then(function(res){
        if(res.status === 204) return {ok:true};
        return {ok:false, message:cloudFailText(res)};
      });
  }

  function cloudResetWithToken(token, password){
    return cloudCall("POST", "/auth/reset", {token:token, password:password})
      .then(function(res){
        if(res.status !== 200){
          var code = res.data && res.data.error;
          if(code === "bad_token"){
            return {ok:false, message:TL(
              "Ce lien n'est plus valable — il expire au bout d'une heure. Demandes-en un nouveau.",
              "هذا الرابط لم يعد صالحا — ينتهي بعد ساعة. اطلب رابطا جديدا.")};
          }
          return {ok:false, message:cloudFailText(res)};
        }
        return adoptSession(res.data.account, res.data.token);
      });
  }

  /* Ouvrir le lien alors que l'application tourne déjà ne change que le
     fragment : le navigateur ne recharge pas la page, donc rien ne
     relirait le jeton. C'est le cas de quelqu'un qui a l'onglet ouvert
     et colle le lien reçu par courriel. */
  if(typeof window !== "undefined"){
    window.addEventListener("hashchange", function(){
      var conf = cloudPendingConfirm();
      if(conf) return showGate("confirming", conf);
      var jeton = cloudPendingReset();
      if(jeton) showGate("reset", jeton);
    });
  }

  /* Le jeton arrive dans le FRAGMENT de l'adresse : il n'est donc
     jamais parti vers un serveur, ni écrit dans un journal d'accès. On
     l'efface de la barre d'adresse dès qu'on l'a lu, pour qu'il ne
     reste pas dans l'historique du navigateur. */
  function cloudPendingReset(){
    var m = String(location.hash || "").match(/#reset=([A-Za-z0-9\-_]{16,128})/);
    if(!m) return null;
    try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
    return m[1];
  }

  function cloudLogout(p){
    var c = cloudOf(p);
    if(!c) return Promise.resolve();
    var token = c.token;
    detachCloud(p);
    return cloudCall("POST", "/auth/logout", null, token);
  }

  function cloudChangePassword(p, current, next){
    var c = cloudOf(p);
    if(!c) return Promise.resolve({ok:false, message:cloudErrorText("unauthorized")});
    return cloudCall("POST", "/auth/password", {current:current, next:next}, c.token)
      .then(function(res){
        if(res.status === 204) return {ok:true};
        return {ok:false, message:cloudFailText(res)};
      });
  }

  function cloudDeleteAccount(p, password){
    var c = cloudOf(p);
    if(!c) return Promise.resolve({ok:false, message:cloudErrorText("unauthorized")});
    return cloudCall("DELETE", "/account", {password:password}, c.token)
      .then(function(res){
        if(res.status === 204){ detachCloud(p); return {ok:true}; }
        return {ok:false, message:cloudFailText(res)};
      });
  }

  /* ---------------- Formulation de l'état ---------------- */

  /* Renvoie la PAIRE {fr, ar}, pas un texte déjà bilingue : en mode
     « les deux », TL() rend « fr — ar ». Coller deux TL() bout à bout
     donnerait « fr1 — ar1fr2 — ar2 », soit les deux langues entrelacées.
     Chaque phrase doit donc être composée entièrement dans sa langue,
     et passer par TL() une seule fois, à la fin. */
  function cloudSyncedAgo(c){
    if(!c || !c.lastSync) return {fr:"jamais", ar:"أبدا"};
    var mins = Math.floor((Date.now() - c.lastSync) / 60000);
    if(mins < 1)  return {fr:"à l'instant", ar:"الآن"};
    if(mins < 60) return {fr:"il y a " + mins + " min", ar:"قبل " + mins + " د"};
    var hours = Math.floor(mins/60);
    if(hours < 24) return {fr:"il y a " + hours + " h", ar:"قبل " + hours + " س"};
    var days = Math.floor(hours/24);
    return {fr:"il y a " + days + " j", ar:"قبل " + days + " ي"};
  }

  /* Une pastille sur l'avatar : reliée, en attente, ou déconnectée.
     Elle ne crie jamais — être hors ligne est un état normal. */
  function renderCloudBadge(){
    var btn = document.getElementById("profile-btn");
    if(!btn) return;
    var p = activeProfile();
    var c = cloudOf(p);
    btn.classList.remove("cloud-on", "cloud-stale");
    if(!c) return;
    if(!c.token){ btn.classList.add("cloud-stale"); return; }
    btn.classList.add(c.lastError ? "cloud-stale" : "cloud-on");
  }
