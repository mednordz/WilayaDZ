/* The three existing profile languages, without a reload or a new preference store. */
function renderLanguageButton(){
 var b=document.getElementById('language-btn'), mode=document.getElementById('language-current');
 if(!b || !mode)return;
 var labels={fr:'FR',ar:'ع',bi:'FR / ع'}, names={fr:'Français',ar:'العربية',bi:'Français et العربية'},next={fr:'ar',ar:'bi',bi:'fr'};
 mode.textContent=labels[LANG]||labels.bi;
 b.setAttribute('aria-label',TL('Langue : '+names[LANG]+'. Passer à '+names[next[LANG]]+'.','اللغة: '+names[LANG]+'. الانتقال إلى '+names[next[LANG]]+'.'));
 b.title=b.getAttribute('aria-label');
}
document.getElementById('language-btn').addEventListener('click',function(){
 var p=activeProfile();if(!p)return;
 var current=document.querySelector('.view.active'), page=current?current.id.replace('view-',''):'path', category=settingsPage;
 p.lang={fr:'ar',ar:'bi',bi:'fr'}[p.lang||'bi'];
 saveAccount();applyLang(p.lang);bootProfile();
 if(page==='settings')openSettings(category);else switchTab(page);
 renderLanguageButton();
 document.getElementById('language-announcement').textContent={fr:'Français activé',ar:'تم تفعيل العربية',bi:'Mode bilingue activé — تم تفعيل الوضع الثنائي'}[p.lang];
 document.getElementById('language-btn').focus({preventScroll:true});
});
