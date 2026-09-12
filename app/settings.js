/* One settings room; the existing manual-transfer DOM keeps its event handlers. */
var settingsPage='home';
var settingsRoot=document.getElementById('settings-content');
var transfer=document.getElementById('settings-transfer');
transfer.appendChild(document.getElementById('sync-section'));
transfer.hidden=true;
function settingsLink(fr,ar,subFr,subAr,page){
 var icon={display:'Aa',language:'ع',audio:'♫',account:'◎',backup:'↻',about:'i'}[page];
 return '<button class="settings-row" type="button" data-settings="'+page+'">'+(icon?'<span class="settings-icon" aria-hidden="true">'+icon+'</span>':'')+'<span><b>'+T(fr,ar)+'</b><small>'+TS(subFr,subAr)+'</small></span><span class="settings-arrow" aria-hidden="true">›</span></button>';
}
function settingsSwitch(key,fr,ar,on,sub){
 return '<div class="settings-row"><span><b id="setting-label-'+key+'">'+T(fr,ar)+'</b><small id="setting-state-'+key+'">'+TL(on?'Activé':'Désactivé',on?'مفعّل':'معطّل')+(sub?' · '+sub:'')+'</small></span><button class="settings-switch" type="button" role="switch" aria-checked="'+on+'" aria-labelledby="setting-label-'+key+'" aria-describedby="setting-state-'+key+'" data-switch="'+key+'"></button></div>';
}
function settingsSelect(key,fr,ar,options){
 return '<label class="settings-row"><span><b>'+T(fr,ar)+'</b></span><select id="setting-'+key+'" data-pref="'+key+'">'+options.map(function(o){return '<option value="'+o[0]+'"'+(String(appPrefs[key])===String(o[0])?' selected':'')+'>'+TL(o[1],o[2])+'</option>';}).join('')+'</select></label>';
}
function openSettings(page){
 if(!activeProfile()) return;
 settingsPage=page||'home';
 var title=T('Réglages','الإعدادات'), html='';
 transfer.hidden=settingsPage!=='backup';
 transfer.querySelector('summary').textContent=TL('Transférer une sauvegarde manuellement','نقل نسخة احتياطية يدويا');
 if(settingsPage==='home'){
  html='<div class="settings-hero"><small>'+TL('DANS UN PATIO DE LA CASBAH','في فناء من القصبة')+'</small><h1>'+title+'</h1><p>'+TL('Un coin tranquille pour régler ton expérience.','ركن هادئ لضبط تجربتك.')+'</p></div><div class="settings-body"><h2>'+TL('Ton application','تطبيقك')+'</h2><div class="settings-group">'+
   settingsLink('Affichage et lecture','العرض والقراءة','Police, taille du texte et thème','الخط وحجم النص والمظهر','display')+
   settingsLink('Langue','اللغة','Français, العربية ou les deux','العربية أو الفرنسية أو الاثنتان','language')+
   settingsLink('Sons et musique','الأصوات والموسيقى','Volume, effets et vibrations','مستوى الصوت والمؤثرات والاهتزاز','audio')+'</div><h2>'+TL('Ton ambiance','أجواؤك')+'</h2><div class="settings-group">'+settingsAudioSwitches()+'</div><h2>'+TL('Ton compte et tes données','حسابك وبياناتك')+'</h2><div class="settings-group">'+
   settingsLink('Compte et connexion','الحساب وتسجيل الدخول','Profil, Google et sécurité','الملف وGoogle والأمان','account')+
   settingsLink('Sauvegarde et synchronisation','الحفظ والمزامنة','État du compte et transfert manuel','حالة الحساب والنقل اليدوي','backup')+
   settingsLink('À propos et assistance','حول التطبيق والمساعدة','Version et données sur cet appareil','الإصدار والبيانات على هذا الجهاز','about')+'</div><p class="settings-note">'+TL('Tes préférences de confort restent sur cet appareil. Ta progression se synchronise avec ton compte dès que la connexion le permet.','تبقى تفضيلات الراحة على هذا الجهاز. يُزامن تقدّمك مع حسابك عند توفر الاتصال.')+'</p></div>';
 }else{
  var titles={display:['Affichage et lecture','العرض والقراءة'],language:['Langue','اللغة'],audio:['Sons et musique','الأصوات والموسيقى'],account:['Compte et connexion','الحساب وتسجيل الدخول'],backup:['Sauvegarde et synchronisation','الحفظ والمزامنة'],about:['À propos et assistance','حول التطبيق والمساعدة']};
  titles.methods=['Moyens de connexion','طرق تسجيل الدخول'];
  var t=titles[settingsPage]||titles.about;
  html='<div class="settings-hero"><h1>'+TL(t[0],t[1])+'</h1></div><div class="settings-body"><button class="settings-back" data-settings="home">'+TL('Retour aux réglages','العودة إلى الإعدادات')+'</button>';
  if(settingsPage==='display') html+='<h2>'+TL('À ton rythme','حسب راحتك')+'</h2><div class="settings-group">'+settingsSelect('font','Police','الخط',[['nunito','Nunito — originale','Nunito — الأصلي'],['system','Police du téléphone','خط الجهاز']])+settingsSelect('size','Taille du texte','حجم النص',[[100,'Normale','عادي'],[112,'Grande','كبير'],[125,'Très grande','كبير جدا']])+settingsSelect('theme','Thème','المظهر',[['auto','Selon le téléphone','حسب الجهاز'],['light','Clair','فاتح'],['dark','Sombre','داكن']])+settingsSwitch('motion','Réduire les animations','تقليل الحركة',appPrefs.motion,TL('La préférence du téléphone reste respectée','نحترم أيضا تفضيل الجهاز'))+'</div><p class="settings-note">'+TL('Aperçu : chaque wilaya raconte une histoire.','معاينة: لكل ولاية حكاية.')+'</p><button class="settings-back" id="settings-reset">'+TL('Réinitialiser les préférences','إعادة ضبط التفضيلات')+'</button>';
  if(settingsPage==='methods') html+='<div id="connection-methods" aria-busy="true"><p class="settings-note" role="status">'+TS('Vérification des moyens de connexion…','جارٍ التحقق من طرق تسجيل الدخول…')+'</p></div>';
  if(settingsPage==='language') html+='<h2>'+TL('Langue de l’interface','لغة الواجهة')+'</h2><div class="settings-group">'+langPickerHtml(activeProfile().lang||'bi')+'</div><p class="settings-note">'+TL('Les noms des wilayas restent disponibles dans les deux langues.','تبقى أسماء الولايات متاحة باللغتين.')+'</p>';
  if(settingsPage==='audio') html+='<h2>'+TL('Ton ambiance','أجواؤك')+'</h2><div class="settings-group">'+settingsAudioSwitches()+'<label class="settings-volume" for="setting-volume">'+TL('Volume musical','مستوى الموسيقى')+' <output id="volume-value">'+appPrefs.volume+' %</output><input type="range" id="setting-volume" min="0" max="100" value="'+appPrefs.volume+'"'+(!musiqueVoulue()?' disabled':'')+'></label>'+settingsSwitch('vibration','Vibrations','الاهتزاز',appPrefs.vibration,TL('Sur les appareils compatibles','على الأجهزة المتوافقة'))+'</div><p class="settings-note">'+TL('La musique utilise une connexion internet. Le bouton son en haut reste une sourdine générale.','تحتاج الموسيقى إلى الإنترنت. يبقى زر الصوت في الأعلى لكتم جميع الأصوات.')+'</p>';
  if(settingsPage==='account') html+='<h2>'+TL('Ton identité','هويتك')+'</h2><div class="settings-group">'+settingsLink('Pseudo et photo','الاسم والصورة','Personnaliser ton profil','تخصيص ملفك','profile')+settingsLink('Compte en ligne','الحساب على الإنترنت','Mot de passe, déconnexion et suppression','كلمة السر وتسجيل الخروج والحذف','cloud')+settingsLink('Moyens de connexion','طرق تسجيل الدخول','E-mail, mot de passe et Google','البريد الإلكتروني وكلمة السر وGoogle','methods')+settingsLink('Verrouillage sur cet appareil','قفل الملف على هذا الجهاز','Code local, distinct du mot de passe','رمز محلي يختلف عن كلمة السر','pin')+'</div><p class="settings-note">'+esc((cloudOf(activeProfile())||{}).email||'')+'</p>';
  if(settingsPage==='backup'){
   var c=cloudOf(activeProfile()), ago=c?cloudSyncedAgo(c):null;
   html+='<h2>'+TL('Ton compte','حسابك')+'</h2><p class="settings-note" role="status">'+(!c||!c.token?TL('Reconnecte-toi pour synchroniser.','أعد تسجيل الدخول للمزامنة.'):c.lastError?TL('Synchronisation en attente. Ta progression reste sur cet appareil.','المزامنة معلقة. يبقى تقدّمك على هذا الجهاز.'):TL('Dernière synchronisation : '+ago.fr,'آخر مزامنة: '+ago.ar))+'</p><div class="settings-group">'+settingsLink('Synchroniser maintenant','المزامنة الآن','Voir le résultat et les éventuelles erreurs','عرض النتيجة والأخطاء المحتملة','syncnow')+'</div>';
   renderSyncPanel();
  }
  if(settingsPage==='about') html+='<h2>WilayaDZ</h2><p class="settings-note" id="settings-version">'+TL('Version installée : ','النسخة المثبتة: ')+esc(WILAYA_REVISION==='development'?TL('développement — Casbah 1','تطوير — القصبة 1'):WILAYA_REVISION.slice(0,8))+'</p><div class="settings-group">'+settingsLink('Aide à l’apprentissage','مساعدة في التعلم','Méthode et carte d’Algérie','المنهج وخريطة الجزائر','info')+'</div><p class="settings-note">'+TL('Cet appareil conserve ton profil, ta progression et tes préférences. Ton compte en ligne permet de retrouver ta progression ailleurs. Les transferts manuels contiennent des données personnelles : partage-les seulement avec tes propres appareils.','يحتفظ هذا الجهاز بملفك وتقدّمك وتفضيلاتك. يتيح حسابك استرجاع التقدّم على جهاز آخر. تحتوي النسخ اليدوية على بيانات شخصية: شاركها مع أجهزتك فقط.')+'</p>';
  html+='</div>';
 }
 settingsRoot.innerHTML=html;
 if(settingsPage==='methods') loadConnectionMethods();
 switchTab('settings');
 settingsRoot.querySelectorAll('[data-settings]').forEach(function(b){b.addEventListener('click',function(){settingsAction(b.dataset.settings);});});
 settingsRoot.querySelectorAll('[data-switch]').forEach(function(b){b.addEventListener('click',function(){
  var k=b.dataset.switch;
  if(k==='music'){musiqueBascule();}else{appPrefs[k]=!appPrefs[k];savePrefs();if(k==='effects'&&appPrefs.effects){setSoundEnabled(true);renderSoundBtn();}}
  var on=k==='music'?musiqueVoulue():appPrefs[k];b.setAttribute('aria-checked',String(on));
  var label=document.getElementById('setting-state-'+k);label.textContent=TL(on?'Activé':'Désactivé',on?'مفعّل':'معطّل');
  var volume=document.getElementById('setting-volume');if(volume) volume.disabled=!musiqueVoulue();
 });});
 settingsRoot.querySelectorAll('[data-pref]').forEach(function(s){s.addEventListener('change',function(){appPrefs[s.dataset.pref]=s.dataset.pref==='size'?Number(s.value):s.value;savePrefs();});});
 var vol=document.getElementById('setting-volume');if(vol) vol.addEventListener('input',function(){appPrefs.volume=Number(vol.value);savePrefs();document.getElementById('volume-value').textContent=vol.value+' %';});
 if(settingsPage==='language') wireLangPicker(settingsRoot,function(l){var p=activeProfile();p.lang=l;saveAccount();applyLang(l);bootProfile();openSettings('language');});
 var reset=document.getElementById('settings-reset');if(reset) reset.addEventListener('click',function(){confirmDialog(TL('Réinitialiser les préférences de cet appareil ? Ta progression et ta langue seront conservées.','إعادة ضبط تفضيلات هذا الجهاز؟ سيُحفظ تقدّمك ولغتك.'),TL('Réinitialiser','إعادة الضبط')).then(function(ok){if(!ok)return;appPrefs=defaultPrefs();savePrefs();setMusiqueVoulue(false);setSoundEnabled(true);musiqueAppliquer();renderSoundBtn();openSettings('display');});});
}
function settingsAudioSwitches(){return settingsSwitch('effects','Effets sonores','المؤثرات الصوتية',appPrefs.effects,'')+(musiqueDisponible()?settingsSwitch('music','Musique de fond','موسيقى الخلفية',musiqueVoulue(),''):'');}
function settingsAction(page){
 if(page==='profile') return openProfileSheet();
 if(page==='cloud') return openCloudSheet();
 if(page==='google') return openGoogleLinkSheet();
 if(page==='pin') return openPinSheet();
 if(page==='info') return switchTab('info');
 if(page==='syncnow'){
  var p=activeProfile(), c=cloudOf(p);if(!c||!c.token) return openCloudSheet();
  var b=settingsRoot.querySelector('[data-settings="syncnow"]');b.disabled=true;
  cloudSync(p).then(function(){if(settingsPage==='backup'&&document.getElementById('view-settings').classList.contains('active'))openSettings('backup');});return;
 }
 openSettings(page);
}
document.getElementById('settings-btn').addEventListener('click',function(){openSettings('home');});
