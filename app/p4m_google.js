
  /* ============================================================
     CONTINUER AVEC GOOGLE

     Volontairement SANS le script de Google (accounts.google.com/gsi).
     L'application est un fichier unique et autonome : y greffer un
     script tiers la rendrait dépendante d'un serveur extérieur pour
     s'afficher, et ferait suivre chaque ouverture à Google — y compris
     pour quelqu'un qui ne veut rien avoir à faire avec lui.

     À la place, la redirection OAuth, qui ne demande rien de plus que
     le navigateur : on envoie la personne chez Google, elle revient
     avec un jeton d'identité dans le FRAGMENT de l'adresse (jamais
     envoyé à un serveur), et c'est notre service qui le fait vérifier
     par Google.
     ============================================================ */

  var GOOGLE_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#4285F4" d="M21.6 12.2c0-.7-.06-1.35-.18-2H12v3.8h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.75 3-4.32 3-7.3z"/>' +
    '<path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.6-2.43l-3.2-2.5c-.9.6-2.04.95-3.4.95-2.6 0-4.8-1.76-5.6-4.12H3.1v2.58A10 10 0 0012 22z"/>' +
    '<path fill="#FBBC05" d="M6.4 13.9a6 6 0 010-3.83V7.5H3.1a10 10 0 000 9l3.3-2.6z"/>' +
    '<path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.84-2.84C16.95 2.98 14.7 2 12 2A10 10 0 003.1 7.5l3.3 2.57C7.2 7.7 9.4 5.95 12 5.95z"/>' +
    '</svg>';

  /* null = pas encore su, "" = pas configuré, sinon l'identifiant. */
  var googleClientId = null;
  var googleWaiters = [];

  function googleUsable(){
    /* La redirection suppose une vraie adresse : dans l'APK (file://)
       il n'y a pas d'origine à laquelle revenir. */
    return /^https?:$/.test(location.protocol) && cloudAvailable();
  }

  function googleReady(cb){
    if(googleClientId !== null) return cb(googleClientId);
    googleWaiters.push(cb);
  }

  function loadCloudConfig(){
    if(!googleUsable()){ googleClientId = ""; return; }
    cloudCall("GET", "/config", null, null).then(function(res){
      googleClientId = (res.status === 200 && res.data && res.data.google) || "";
      var attente = googleWaiters; googleWaiters = [];
      attente.forEach(function(cb){ try{ cb(googleClientId); }catch(e){} });
    });
  }

  /* ---------------- Le bouton ---------------- */

  /* Rendu masqué : on ne sait pas encore si Google est configuré, et un
     bouton qui apparaît puis disparaît est pire qu'un bouton qui arrive
     une demi-seconde plus tard. */
  function googleButtonHtml(prefix){
    if(!googleUsable()) return "";
    return "<button class='btn ghost google-btn' id='" + prefix + "-google' " +
             "style='display:none' type='button'>" +
             GOOGLE_ICON + "<span>" + TL("Continuer avec Google","تابع مع Google") + "</span>" +
           "</button>";
  }

  function wireGoogleButton(root, attachTo){
    var b = root.querySelector(".google-btn");
    if(!b) return;
    googleReady(function(id){ if(id) b.style.display = ""; });
    b.addEventListener("click", function(){
      googleStart(attachTo ? attachTo.id : null);
    });
  }

  /* ---------------- Aller et retour ---------------- */

  var GOOGLE_STATE_KEY = "wilaya-google-v1";

  function googleStart(profileId, link){
    googleReady(function(id){
      if(!id) return;
      var nonce = link ? link.nonce : randomToken();
      var state = randomToken();
      try{
        sessionStorage.setItem(GOOGLE_STATE_KEY,
          JSON.stringify({nonce:nonce, state:state, profileId:profileId || null, challenge:link ? link.challenge : null, created:Date.now()}));
      }catch(e){ toast(TL("Autorise le stockage de session pour continuer avec Google.","اسمح بتخزين الجلسة للمتابعة مع Google.")); return; }

      var retour = location.origin + location.pathname;
      location.href = "https://accounts.google.com/o/oauth2/v2/auth" +
        "?client_id="     + encodeURIComponent(id) +
        "&redirect_uri="  + encodeURIComponent(retour) +
        "&response_type=id_token" +
        "&scope="         + encodeURIComponent("openid email profile") +
        "&nonce="         + encodeURIComponent(nonce) +
        "&state="         + encodeURIComponent(state) +
        "&prompt=select_account";
    });
  }

  function randomToken(){
    if(window.crypto && crypto.getRandomValues){
      var a = new Uint8Array(24);
      crypto.getRandomValues(a);
      return Array.prototype.map.call(a, function(x){
        return ("0" + x.toString(16)).slice(-2);
      }).join("");
    }
    return String(Date.now()) + Math.random().toString(36).slice(2);
  }

  /* Le retour de Google : #state=...&id_token=... */
  function googlePendingReturn(){
    var h = String(location.hash || "");
    if(h.indexOf("id_token=") < 0) return null;
    var params = {};
    h.replace(/^#/, "").split("&").forEach(function(bout){
      var i = bout.indexOf("=");
      if(i > 0) params[decodeURIComponent(bout.slice(0, i))] = decodeURIComponent(bout.slice(i + 1));
    });
    try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
    if(!params.id_token) return null;

    var garde = null;
    try{ garde = JSON.parse(sessionStorage.getItem(GOOGLE_STATE_KEY) || "null"); }catch(e){}
    try{ sessionStorage.removeItem(GOOGLE_STATE_KEY); }catch(e){}

    /* `state` doit revenir tel qu'on l'a envoyé : c'est ce qui
       distingue un retour de NOTRE demande d'un jeton qu'on nous
       glisserait par un lien fabriqué. */
    if(!garde || !garde.state || !garde.nonce || params.state !== garde.state || !garde.created || Date.now()-garde.created>600000) return null;
    return { credential: params.id_token,
             nonce: garde ? garde.nonce : "",
             profileId: garde.profileId, challenge:garde.challenge || null };
  }

  function cloudGoogle(retour){
    if(retour.challenge){
      var p=account.profiles.find(function(x){return x.id===retour.profileId;});
      var c=p && cloudOf(p);
      if(!c || !c.token) return Promise.resolve({ok:false,message:TL('Reconnecte-toi avant d’associer Google.','أعد الدخول قبل ربط Google.')});
      return cloudCall('POST','/auth/google/link',{credential:retour.credential,nonce:retour.nonce,challenge:retour.challenge},c.token).then(function(res){
        if(res.status!==200) return {ok:false,message:res.status===409?TL('Ce compte Google est déjà associé à un autre compte WilayaDZ. Aucun compte n’a été fusionné.','حساب Google مرتبط بحساب WilayaDZ آخر. لم يُدمج أي حساب.'):TL('Association impossible ou expirée. Recommence depuis les réglages.','تعذّر الربط أو انتهت صلاحيته. أعد المحاولة من الإعدادات.')};
        c.googleEmail=res.data.account.google_email;account.activeId=p.id;saveAccount();
        return {ok:true,profile:p,linked:true};
      });
    }
    return cloudCall("POST", "/auth/google",
                     {credential:retour.credential, nonce:retour.nonce})
      .then(function(res){
        if(res.status !== 200){
          var code = res.data && res.data.error;
          if(code === "google_off"){
            return {ok:false, message:TL("La connexion Google n'est pas configurée ici.",
                                         "الدخول عبر Google غير مُعدّ هنا.")};
          }
          return {ok:false, message:TL(
            "Google n'a pas pu confirmer ton identité. Réessaie.",
            "تعذّر على Google تأكيد هويتك. أعد المحاولة.")};
        }
        var cible = null;
        if(retour.profileId){
          for(var i=0;i<account.profiles.length;i++){
            if(account.profiles[i].id === retour.profileId) cible = account.profiles[i];
          }
        }
        return adoptSession(res.data.account, res.data.token, cible)
          .then(function(r){ clearPending(); return r; });
      });
  }

  function openGoogleLinkSheet(){
    var p=activeProfile(), c=p && cloudOf(p);
    if(!c || !c.token) return openCloudSheet();
    openSheet('<h2 id="sheet-title">'+T('Associer Google','ربط Google')+'</h2><p class="sub">'+TS('La liaison conserve ton compte et ta progression, même si ton adresse Google est différente. Confirme avec ton mot de passe WilayaDZ, puis choisis ton compte chez Google.','يحافظ الربط على حسابك وتقدّمك حتى إن اختلف بريد Google. أكّد بكلمة سر WilayaDZ ثم اختر حسابك لدى Google.')+'</p><p id="google-link-status" role="status"></p><label for="google-link-password">'+TL('Mot de passe WilayaDZ','كلمة سر WilayaDZ')+'</label><input class="gate-input" id="google-link-password" type="password" autocomplete="current-password" maxlength="1024"><p class="gate-err" id="google-link-error" role="alert"></p><button class="btn google-btn" id="google-link-start" disabled>'+GOOGLE_ICON+T('Choisir mon compte Google','اختيار حساب Google')+'</button><p class="gate-note">'+TS('Si tu utilises uniquement Google, définis d’abord un mot de passe avec « Mot de passe oublié » à la connexion.','إذا كنت تستخدم Google فقط، أنشئ كلمة سر عبر «نسيت كلمة السر» عند الدخول.')+'</p><button class="btn ghost" id="sheet-close">'+T('Fermer','إغلاق')+'</button>');
    var b=document.getElementById('google-link-start'), status=document.getElementById('google-link-status');
    document.getElementById('sheet-close').onclick=closeSheet;
    if(!googleUsable()){status.textContent=TL('Disponible depuis la version web connectée.','متاح من نسخة الويب المتصلة.');return;}
    googleReady(function(id){if(!b.isConnected)return;b.disabled=!id;status.textContent=id?'':TL('Google n’est pas configuré sur cette version.','Google غير مُعدّ في هذه النسخة.');});
    cloudCall('GET','/me',null,c.token).then(function(res){if(!status.isConnected)return;if(res.status===200 && res.data.account.google_email){status.textContent=TL('Google associé : ','Google مرتبط: ')+res.data.account.google_email;b.hidden=true;document.getElementById('google-link-password').disabled=true;}});
    b.onclick=function(){
      var input=document.getElementById('google-link-password'), password=input.value;
      if(!password){document.getElementById('google-link-error').textContent=TL('Saisis ton mot de passe.','أدخل كلمة السر.');input.focus();return;}
      b.disabled=true;var nonce=randomToken();
      cloudCall('POST','/auth/google/prepare',{password:password,nonce:nonce},c.token).then(function(res){
        password='';if(!b.isConnected)return;input.value='';b.disabled=false;
        if(res.status!==200){document.getElementById('google-link-error').textContent=TL('Vérifie ton mot de passe et ta connexion, puis réessaie.','تحقق من كلمة السر والاتصال ثم أعد المحاولة.');return;}
        googleStart(p.id,{nonce:nonce,challenge:res.data.challenge});
      });
    };
  }
