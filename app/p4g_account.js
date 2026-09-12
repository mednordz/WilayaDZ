
  /* ============================================================
     PROFILS & SYNCHRONISATION
     Un compte est désormais obligatoire pour se servir de
     l'application : c'est lui qui porte la progression d'un appareil à
     l'autre (voir p4k_cloud.js). Il n'est exigé qu'UNE fois — ensuite
     la session reste sur l'appareil et tout fonctionne hors ligne.

     Ce fichier reste le dépôt local, et il garde son rôle :
       · plusieurs profils sur un même appareil, chacun sa mémoire,
         chacun son compte — un téléphone de famille marche toujours ;
       · un code d'accès local facultatif, qui verrouille un profil sur
         CET appareil et ne remplace pas le mot de passe du compte ;
       · un code de transfert d'appareil à appareil, qui FUSIONNE au
         lieu d'écraser — la même fusion que la synchronisation.
     ============================================================ */
  var ACCOUNT_KEY = "wilaya-account-v1";
  var PROFILE_COLORS = ["var(--accent)","var(--teal)","var(--slate)","var(--olive)","var(--rose)","var(--gold)"];
  var account = { profiles: [], activeId: null };

  function newId(){
    return "p" + Date.now().toString(36) + Math.floor(Math.random()*1e6).toString(36);
  }
  function blankData(){
    return { progress:{}, confusions:{}, crowns:{}, xp:0,
             streak:{count:0,last:null}, keyDone:false, bestBlitz:0,
             /* L'invitation à mettre une photo a été écartée. Rangé
                avec la progression, donc synchronisé : refusée sur le
                téléphone, elle ne revient pas sur la tablette. */
             photoNon:false, resetAt:0 };
  }

  /* Code d'accès local. Ce n'est pas de la cryptographie :
     crypto.subtle n'existe pas dans un contexte file:// (l'APK).
     C'est un verrou domestique — il empêche quelqu'un d'ouvrir ou
     d'effacer ton profil, rien de plus. L'interface le dit. */
  function hashPin(pin, salt){
    var h = 0x811c9dc5, s = String(salt) + "|" + String(pin) + "|wilaya";
    for(var round=0; round<3000; round++){
      for(var i=0;i<s.length;i++){
        h ^= s.charCodeAt(i);
        h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0;
      }
      h = (h ^ round) >>> 0;
    }
    return h.toString(36);
  }

  function loadAccount(){
    try{
      var raw = localStorage.getItem(ACCOUNT_KEY);
      if(raw){
        var a = JSON.parse(raw);
        if(a && a.profiles){ account = a; return; }
      }
      /* Migration : les versions précédentes stockaient une seule
         progression, sans profil. On la récupère telle quelle. */
      var old = localStorage.getItem("wilaya-progress-v4") || localStorage.getItem("wilaya-progress-v3");
      if(old){
        var d = JSON.parse(old);
        var prof = {
          id:newId(), name:"Moi", pin:null, salt:null, lang:"bi", color:0, created:Date.now(), lastSeen:Date.now(),
          data:{ progress:d.progress||{}, confusions:d.confusions||{}, crowns:d.crowns||{},
                 xp:d.xp||0, streak:d.streak||{count:0,last:null},
                 keyDone:!!d.keyDone, bestBlitz:d.bestBlitz||0 }
        };
        account = { profiles:[prof], activeId:prof.id };
        saveAccount();
      }
    }catch(e){ account = { profiles:[], activeId:null }; }
  }
  var storageFailureShown = false;
  function saveAccount(){
    try{
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      storageFailureShown=false; return true;
    }catch(e){
      if(!storageFailureShown && typeof toast === 'function'){
        storageFailureShown=true;
        toast(TL("Le stockage de cet appareil est indisponible. Exporte ta sauvegarde avant de fermer l’application.",
                 "التخزين على هذا الجهاز غير متاح. صدّر نسخة احتياطية قبل إغلاق التطبيق."));
      }
      return false;
    }
  }
  function activeProfile(){
    for(var i=0;i<account.profiles.length;i++){
      if(account.profiles[i].id === account.activeId) return account.profiles[i];
    }
    return null;
  }
  function createProfile(name, pin, lang){
    var salt = Math.random().toString(36).slice(2);
    var prof = {
      id:newId(), name:name, salt:salt, pin: pin ? hashPin(pin, salt) : null, lang: lang || "bi",
      color: account.profiles.length % PROFILE_COLORS.length,
      created:Date.now(), lastSeen:Date.now(), data:blankData()
    };
    account.profiles.push(prof);
    account.activeId = prof.id;
    saveAccount();
    return prof;
  }

  /* Quel profil l'état de travail contient-il réellement ? Tant que
     personne n'a franchi la porte d'entrée, `state` est vide : l'écrire
     dans un profil effacerait sa progression. Ce garde-fou a été posé
     après exactement cet accident, lors du rattachement d'un profil
     existant à un compte tout neuf. */
  var loadedProfileId = null;

  /* Charge le profil actif dans l'état de travail. */
  function loadState(){
    var p = activeProfile();
    loadedProfileId = p ? p.id : null;
    applyLang(p ? (p.lang || "bi") : "bi");
    applyProgressState(p ? p.data : blankData());
  }
  function applyProgressState(d){
    state.progress   = d.progress || {};
    state.confusions = d.confusions || {};
    state.crowns     = d.crowns || {};
    state.xp         = d.xp || 0;
    state.streak     = d.streak || {count:0,last:null};
    state.keyDone    = !!d.keyDone;
    state.bestBlitz  = d.bestBlitz || 0;
    state.photoNon   = !!d.photoNon;
    state.resetAt    = d.resetAt || 0;
  }
  /* Réécrit l'état dans le profil actif, à chaque réponse. */
  function persist(skipSync){
    var p = activeProfile();
    if(!p) return;
    /* On n'écrit que ce qui a été chargé depuis CE profil. Sans cela,
       toute écriture faite avant le premier loadState() — ou juste
       après un changement de profil — remplacerait une progression
       réelle par un état de travail vide. */
    if(p.id !== loadedProfileId) return;
    p.data = {
      progress:state.progress, confusions:state.confusions, crowns:state.crowns,
      xp:state.xp, streak:state.streak, keyDone:state.keyDone, bestBlitz:state.bestBlitz,
      photoNon:state.photoNon, resetAt:state.resetAt||0
    };
    p.lastSeen = Date.now();
    saveAccount();
    /* Si ce profil est relié à un compte, la poussée part toute seule
       un peu plus tard — jamais à chaque réponse. Sans compte, cette
       ligne ne fait rien du tout. */
    if(!skipSync && typeof cloudScheduleSync === "function") cloudScheduleSync();
  }

  function profileInitial(p){
    var n = (p.name||"?").trim();
    return n ? n.charAt(0).toUpperCase() : "?";
  }
  function profileStats(p){
    var d = p.data || blankData();
    var tracked = Object.keys(d.progress||{}).length;
    var anchored = Object.keys(d.progress||{}).filter(function(c){ return (d.progress[c].box||0) >= 5; }).length;
    return { tracked:tracked, anchored:anchored, xp:d.xp||0, streak:(d.streak&&d.streak.count)||0 };
  }

  /* ---------------- Code de transfert ---------------- */
  function b64urlEncode(str){
    var utf8 = unescape(encodeURIComponent(str));
    return btoa(utf8).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }
  function b64urlDecode(str){
    var s = str.replace(/-/g,"+").replace(/_/g,"/");
    while(s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  }
  function checksum(str){
    var h = 5381;
    for(var i=0;i<str.length;i++){ h = ((h*33) ^ str.charCodeAt(i)) >>> 0; }
    return h.toString(36).slice(0,6);
  }

  /* La progression sous sa forme compacte. C'est exactement ce qui
     voyage, que ce soit dans un code de transfert ou vers le compte en
     ligne : un seul format à maintenir, une seule fusion à vérifier. */
  function packProfile(p){
    var d = p.data || blankData();
    var packed = {};
    Object.keys(d.progress||{}).forEach(function(c){
      var r = d.progress[c] || {};
      packed[c] = [r.box||0, (r.due||0)/DAY, r.updatedAt||0];
    });
    /* Les anciennes questions de blocs pouvaient produire des identifiants
       négatifs. Ils ne doivent pas bloquer l'export d'un profil valide. */
    var confusions = {};
    function validWilayaKey(k){ return /^(?:[1-9]|[1-5][0-9]|6[0-9])$/.test(k); }
    Object.keys(d.confusions||{}).forEach(function(a){
      if(!validWilayaKey(a)) return;
      var pairs = {};
      Object.keys(d.confusions[a]||{}).forEach(function(b){
        var count = d.confusions[a][b];
        if(validWilayaKey(b) && a !== b && Number.isSafeInteger(count) && count >= 0) pairs[b] = count;
      });
      if(Object.keys(pairs).length) confusions[a] = pairs;
    });
    return {
      v:1, sv:2, ra:d.resetAt||0, n:p.name, x:d.xp||0,
      sc:(d.streak&&d.streak.count)||0, sl:(d.streak&&d.streak.last)||null,
      k:d.keyDone?1:0, bb:d.bestBlitz||0,
      cr:d.crowns||{}, p:packed, cf:confusions, pn:d.photoNon?1:0,
      /* L'avatar n'est pas cumulable comme une progression : c'est le
         plus récent qui gagne, d'où l'horodatage qui l'accompagne. */
      av:p.avatar||null, avt:p.avatarAt||0
    };
  }

  function exportCode(p, compact){
    var payload = packProfile(p);
    if(compact){ delete payload.av; delete payload.avt; }
    var json = JSON.stringify(payload);
    return "WLY1." + b64urlEncode(json) + "." + checksum(json);
  }

  function parseCode(code){
    if(typeof code !== "string" || code.length > 750000) return {error:"format"};
    var clean = code.replace(/\s+/g,"");
    var m = clean.match(/^WLY1\.([A-Za-z0-9\-_]+)\.([a-z0-9]+)$/);
    if(!m) return {error:"format"};
    var json;
    try{ json = b64urlDecode(m[1]); }catch(e){ return {error:"illisible"}; }
    if(checksum(json) !== m[2]) return {error:"abime"};
    var obj;
    try{ obj = JSON.parse(json); }catch(e){ return {error:"illisible"}; }
    if(!validPayload(obj)) return {error:"version"};
    return {obj:obj};
  }

  /* Même schéma que server/payload.py. Les anciens codes v1 restent lisibles. */
  function validPayload(o){
    function dict(x){ return !!x && typeof x === "object" && !Array.isArray(x); }
    function number(x, max){ return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max; }
    function integer(x, max){ return number(x,max) && Math.floor(x) === x; }
    function code(k){ return /^(?:[1-9]|[1-5][0-9]|6[0-9])$/.test(k); }
    function keys(x, key, value){ return dict(x) && Object.keys(x).every(function(k){ return key(k) && value(x[k]); }); }
    if(!dict(o) || o.v !== 1 || !dict(o.p)) return false;
    var allowed = ['v','sv','ra','n','x','sc','sl','k','bb','cr','p','cf','pn','av','avt'];
    if(Object.keys(o).some(function(k){ return allowed.indexOf(k) < 0; })) return false;
    if(o.sv !== undefined && o.sv !== 2) return false;
    if(o.n !== undefined && (typeof o.n !== 'string' || o.n.length > 100)) return false;
    if(!['x','sc','bb','ra','avt'].every(function(k){ return o[k] === undefined || integer(o[k],Number.MAX_SAFE_INTEGER); })) return false;
    if(!['k','pn'].every(function(k){ return o[k] === undefined || o[k] === 0 || o[k] === 1; })) return false;
    if(o.sl != null && (typeof o.sl !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.sl) || isNaN(Date.parse(o.sl)) || (o.sl.slice(0,4) === '0000') || new Date(o.sl).toISOString().slice(0,10) !== o.sl)) return false;
    if(!keys(o.p,code,function(r){ return Array.isArray(r) && (r.length === 2 || r.length === 3) && integer(r[0],5) && number(r[1],1e7) && (r.length === 2 || integer(r[2],Number.MAX_SAFE_INTEGER)); })) return false;
    if(o.cr !== undefined && !keys(o.cr,function(k){return /^u[1-8]$/.test(k);},function(v){return integer(v,5);})) return false;
    if(o.cf !== undefined && !keys(o.cf,code,function(m){return keys(m,code,function(v){return integer(v,Number.MAX_SAFE_INTEGER);});})) return false;
    if(o.av != null){
      var a=o.av;
      if(!dict(a) || Object.keys(a).some(function(k){return k !== 'k' && k !== 'v';})) return false;
      if(a.k === 'm'){ if(['fennec','chameau','cigogne','palmier'].indexOf(a.v)<0) return false; }
      else if(a.k !== 'p' || typeof a.v !== 'string' || a.v.length > 61440 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.v)) return false;
    }
    return true;
  }

  /* Une remise à zéro ouvre une nouvelle génération. À génération égale,
     la réponse la plus récente gagne, même si elle diminue la maîtrise.
     Sans date (ancien code), conserver la règle historique de fusion. */
  function mergeInto(p, obj){
    if(!validPayload(obj)) return {error:'bad_payload', added:0, improved:0, changed:false};
    var before = JSON.stringify(packProfile(p));
    var d = p.data || (p.data = blankData());
    var incomingReset = obj.ra||0, localReset = d.resetAt||0;
    if(incomingReset < localReset) return {added:0, improved:0, changed:false};
    if(incomingReset > localReset){
      var photoNon = d.photoNon;
      d = p.data = blankData(); d.resetAt = incomingReset; d.photoNon = photoNon;
    }
    d.progress = d.progress || {}; d.crowns = d.crowns || {}; d.confusions = d.confusions || {};
    var added = 0, improved = 0;
    Object.keys(obj.p).forEach(function(c){
      var inc=obj.p[c], at=inc[2]||0, due=Math.round(inc[1]*DAY), cur=d.progress[c];
      if(!cur){ d.progress[c]={box:inc[0],due:due,updatedAt:at,seen:0,ok:0,best:0}; added++; return; }
      var oldAt=cur.updatedAt||0;
      var newer = at > oldAt || (at === oldAt && (at ?
        (inc[0] < cur.box || (inc[0] === cur.box && due < cur.due)) :
        (inc[0] > cur.box || (inc[0] === cur.box && due > cur.due))));
      if(newer){ cur.box=inc[0]; cur.due=due; cur.updatedAt=at; improved++; }
    });
    d.xp = Math.max(d.xp||0, obj.x||0);
    d.bestBlitz = Math.max(d.bestBlitz||0, obj.bb||0);
    d.keyDone = !!d.keyDone || !!obj.k;
    d.photoNon = !!d.photoNon || !!obj.pn;
    Object.keys(obj.cr||{}).forEach(function(u){ d.crowns[u]=Math.max(d.crowns[u]||0,obj.cr[u]); });
    Object.keys(obj.cf||{}).forEach(function(a){
      d.confusions[a]=d.confusions[a]||{};
      Object.keys(obj.cf[a]).forEach(function(b){d.confusions[a][b]=Math.max(d.confusions[a][b]||0,obj.cf[a][b]);});
    });
    if(Object.prototype.hasOwnProperty.call(obj,'av') && (obj.avt||0) > (p.avatarAt||0)){
      p.avatar=obj.av; p.avatarAt=obj.avt;
    }
    d.streak=d.streak||{count:0,last:null};
    if(obj.sl && (!d.streak.last || obj.sl > d.streak.last)) d.streak={count:obj.sc||0,last:obj.sl};
    else if(obj.sl && obj.sl === d.streak.last) d.streak.count=Math.max(d.streak.count||0,obj.sc||0);
    return {added:added, improved:improved, changed:before !== JSON.stringify(packProfile(p))};
  }

  function resetProgress(){
    var next=Math.max(Date.now(),(state.resetAt||0)+1), photoNon=state.photoNon;
    applyProgressState(blankData()); state.resetAt=next; state.photoNon=photoNon;
    persist();
  }
