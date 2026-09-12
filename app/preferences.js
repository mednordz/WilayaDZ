/* Device comfort preferences never enter the profile/sync payload. */
var PREFS_KEY = 'wilaya-preferences-v1';
function defaultPrefs(){return {font:'nunito',size:100,theme:'auto',motion:false,vibration:true,effects:true,volume:32};}
function readPrefs(){
  var p=defaultPrefs(), saved;
  try{saved=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');}catch(e){saved={};}
  if(!saved || typeof saved!=='object') return p;
  ['motion','vibration','effects'].forEach(function(k){if(typeof saved[k]==='boolean') p[k]=saved[k];});
  if(['nunito','system'].indexOf(saved.font)>=0) p.font=saved.font;
  if([100,112,125].indexOf(saved.size)>=0) p.size=saved.size;
  if(['auto','light','dark'].indexOf(saved.theme)>=0) p.theme=saved.theme;
  if(typeof saved.volume==='number' && isFinite(saved.volume)) p.volume=Math.min(100,Math.max(0,saved.volume));
  return p;
}
var appPrefs=readPrefs();
function applyPrefs(){
  var root=document.documentElement;
  if(appPrefs.theme==='auto') root.removeAttribute('data-theme'); else root.dataset.theme=appPrefs.theme;
  root.style.fontSize=appPrefs.size+'%';
  if(appPrefs.font==='system'){
    root.style.setProperty('--font-body','system-ui, sans-serif');root.style.setProperty('--font-display','system-ui, sans-serif');
  }else{root.style.removeProperty('--font-body');root.style.removeProperty('--font-display');}
  root.classList.toggle('reduce-motion',appPrefs.motion);
  if(typeof musiqueEl!=='undefined' && musiqueEl) musiqueEl.volume=appPrefs.volume/100;
  document.dispatchEvent(new Event('wilaya-preferences'));
}
function savePrefs(){try{localStorage.setItem(PREFS_KEY,JSON.stringify(appPrefs));}catch(e){} applyPrefs();}
applyPrefs();
