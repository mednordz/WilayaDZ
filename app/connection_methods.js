/* Server-confirmed authentication metadata; never infer methods from a session. */
function connectionCard(title, status, description, action, actionLabel){
  return '<section class="connection-card"><div class="connection-card-heading"><h2>'+title+'</h2><span class="connection-status">'+status+'</span></div><div class="connection-description">'+description+'</div>'+(action?'<button type="button" class="settings-back" data-connection-action="'+action+'">'+actionLabel+'</button>':'')+'</section>';
}
function loadConnectionMethods(){
  var root=document.getElementById('connection-methods'), p=activeProfile(), c=p && cloudOf(p), token=c && c.token;
  function live(){return root.isConnected && activeProfile()===p && cloudOf(p) && cloudOf(p).token===token;}
  function failure(expired){
    root.setAttribute('aria-busy','false');
    root.innerHTML='<p class="settings-note" role="status">'+TS(expired?'Reconnecte-toi pour vérifier tes moyens de connexion.':'Impossible de vérifier les moyens de connexion pour le moment. Réessaie avec une connexion internet.',expired?'أعد تسجيل الدخول للتحقق من طرق الدخول.':'تعذّر التحقق من طرق الدخول حاليا. أعد المحاولة عند توفر الإنترنت.')+'</p><button class="settings-back" type="button" id="connection-retry">'+T(expired?'Se reconnecter':'Réessayer',expired?'تسجيل الدخول مجددا':'إعادة المحاولة')+'</button>';
    root.querySelector('button').onclick=function(){if(expired)openCloudSheet();else openSettings('methods');};
  }
  if(!token){failure(true);return;}
  Promise.all([cloudCall('GET','/me',null,token),cloudCall('GET','/config',null)]).then(function(results){
    if(!live())return;
    var res=results[0], config=results[1];
    if(res.status!==200 || !res.data || !res.data.account){failure(res.status===401);return;}
    var a=res.data.account, pw=a.password_configured, knownGoogle=Object.prototype.hasOwnProperty.call(a,'google_email'), linked=knownGoogle && !!a.google_email;
    var googleReadyHere=config.status===200 && config.data && !!config.data.google && googleUsable();
    var passwordLabel=pw===true?T('Configuré','مُعدّ'):pw===false?T('Non configuré','غير مُعدّ'):T('À vérifier','بحاجة للتحقق');
    var passwordText=pw===true?TS('Connecte-toi avec l’adresse de ton compte et ton mot de passe WilayaDZ.','سجّل الدخول ببريد حسابك وكلمة سر WilayaDZ.'):pw===false?TS('Ajoute un mot de passe pour pouvoir aussi te connecter par e-mail.','أضف كلمة سر لتتمكن أيضا من الدخول بالبريد الإلكتروني.'):TS('L’historique de ce compte ne permet pas de confirmer ce point. Une connexion réussie par mot de passe ou sa réinitialisation actualisera cet état.','لا يتيح سجل هذا الحساب تأكيد هذه المعلومة. سيُحدّث هذا الوضع بعد الدخول بكلمة السر أو إعادة ضبطها.');
    var googleText=linked?'<p class="connection-address" dir="ltr">'+esc(a.google_email)+'</p>'+TS('Ce compte Google te reconnecte au même compte WilayaDZ et à la même progression.','يعيدك حساب Google هذا إلى نفس حساب WilayaDZ ونفس التقدّم.'):knownGoogle?TS('Tu peux associer Google à ce compte pour retrouver plus facilement ta progression.','يمكنك ربط Google بهذا الحساب لاسترجاع تقدّمك بسهولة.'):TS('Le serveur ne fournit pas encore cette information.','لا يقدم الخادم هذه المعلومة بعد.');
    if(!googleReadyHere)googleText+='<p>'+TS('La connexion Google est momentanément indisponible ici.','تسجيل الدخول عبر Google غير متاح هنا حاليا.')+'</p>';
    var pseudoStatus=a.pseudo_login_available===true?T('Disponible','متاح'):a.pseudo_login_available===false?T('Utilise ton e-mail','استخدم بريدك'):T('À vérifier','بحاجة للتحقق');
    var pseudoText='<p class="connection-address" dir="auto">'+esc(a.name || p.name)+'</p>'+TS('Ton pseudo peut remplacer ton e-mail à la connexion, avec ton mot de passe WilayaDZ. Si plusieurs comptes partagent ce pseudo, utilise ton e-mail ou choisis un pseudo distinct, sans @.','يمكن لاسمك أن يحل محل بريدك عند الدخول، مع كلمة سر WilayaDZ. إذا تشاركت حسابات عدة الاسم نفسه، استخدم بريدك أو اختر اسما مختلفا دون @.');
    root.setAttribute('aria-busy','false');
    root.innerHTML=connectionCard(T('Adresse du compte','بريد الحساب'),a.verified?T('Vérifiée','مؤكّد'):T('À confirmer','بانتظار التأكيد'),'<p class="connection-address" dir="ltr">'+esc(a.email)+'</p>'+TS('Ton adresse de connexion et de récupération de compte.','بريدك لتسجيل الدخول واسترجاع الحساب.'))+
      connectionCard(T('Connexion par pseudo','الدخول بالاسم'),pseudoStatus,pseudoText,'rename',T('Modifier mon pseudo','تغيير اسمي'))+
      connectionCard(T('Mot de passe','كلمة السر'),passwordLabel,passwordText,pw===true?'password':'recovery',pw===true?T('Modifier le mot de passe','تغيير كلمة السر'):pw===false?T('Créer un mot de passe','إنشاء كلمة سر'):T('Définir ou réinitialiser','تعيين كلمة السر أو إعادة ضبطها'))+
      connectionCard('Google',linked?T('Associé','مرتبط'):knownGoogle?T('Non associé','غير مرتبط'):T('À vérifier','بحاجة للتحقق'),googleText,!linked&&knownGoogle&&googleReadyHere?'google':null,T('Associer Google','ربط Google'))+
      '<p class="settings-note">'+TS('Le code de verrouillage de cet appareil est distinct du mot de passe de ton compte.','رمز قفل هذا الجهاز يختلف عن كلمة سر حسابك.')+'</p>';
    root.querySelectorAll('[data-connection-action]').forEach(function(b){b.onclick=function(){
      var action=b.dataset.connectionAction;
      if(action==='google')openGoogleLinkSheet();
      else if(action==='rename')openRenameSheet();
      else if(action==='password')openCloudForm('password');
      else openConnectionRecovery(p,a.email);
    };});
  });
}
function openConnectionRecovery(profile,email){
  openSheet('<h2 id="sheet-title">'+T('Recevoir un lien sécurisé','استلام رابط آمن')+'</h2><p class="sub">'+TS('Un lien te permettra de définir un nouveau mot de passe. Le changement conservera ta progression et demandera aux autres appareils de se reconnecter.','يتيح لك الرابط تعيين كلمة سر جديدة. سيُحفظ تقدّمك وسيُطلب من الأجهزة الأخرى تسجيل الدخول مجددا.')+'</p><p class="connection-address" dir="ltr">'+esc(email)+'</p><p id="connection-mail-status" role="status"></p><button class="btn" id="connection-send-link">'+T('Envoyer le lien','إرسال الرابط')+'</button><button class="btn ghost" id="sheet-close">'+T('Fermer','إغلاق')+'</button>');
  document.getElementById('sheet-close').onclick=closeSheet;
  var b=document.getElementById('connection-send-link'), status=document.getElementById('connection-mail-status');
  b.onclick=function(){
    if(activeProfile()!==profile)return;
    b.disabled=true;
    cloudForgot(email).then(function(r){
      if(!status.isConnected)return;
      if(r.ok){b.hidden=true;status.innerHTML=TS('Si cette adresse correspond à un compte, le lien a été envoyé. Pense à vérifier les courriers indésirables.','إذا كان هذا البريد مرتبطا بحساب، فقد أُرسل الرابط. تحقق أيضا من البريد غير المرغوب فيه.');}
      else{b.disabled=false;status.textContent=r.message;}
    });
  };
}
