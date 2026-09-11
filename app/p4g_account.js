
  /* ============================================================
     PROFILS & SYNCHRONISATION
     Il n'y a pas de serveur derrière cette application : elle
     fonctionne hors ligne, y compris dans l'APK Android. Donc
     pas de compte en ligne — ce serait mentir que d'en afficher un.
     À la place :
       · plusieurs profils sur un même appareil, chacun sa mémoire ;
       · un code d'accès local facultatif par profil ;
       · un code de transfert qui déplace une progression d'un
         appareil à l'autre, et qui FUSIONNE au lieu d'écraser.
     ============================================================ */
  var ACCOUNT_KEY = "wilaya-account-v1";
  var PROFILE_COLORS = ["var(--accent)","var(--teal)","var(--slate)","var(--olive)","var(--rose)","var(--gold)"];
  var account = { profiles: [], activeId: null };

  function newId(){
    return "p" + Date.now().toString(36) + Math.floor(Math.random()*1e6).toString(36);
  }
  function blankData(){
    return { progress:{}, confusions:{}, crowns:{}, xp:0,
             streak:{count:0,last:null}, keyDone:false, bestBlitz:0 };
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
  function saveAccount(){
    try{ localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); }catch(e){}
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

  /* Charge le profil actif dans l'état de travail. */
  function loadState(){
    var p = activeProfile();
    applyLang(p ? (p.lang || "bi") : "bi");
    var d = p ? p.data : blankData();
    state.progress   = d.progress || {};
    state.confusions = d.confusions || {};
    state.crowns     = d.crowns || {};
    state.xp         = d.xp || 0;
    state.streak     = d.streak || {count:0,last:null};
    state.keyDone    = !!d.keyDone;
    state.bestBlitz  = d.bestBlitz || 0;
  }
  /* Réécrit l'état dans le profil actif, à chaque réponse. */
  function persist(){
    var p = activeProfile();
    if(!p) return;
    p.data = {
      progress:state.progress, confusions:state.confusions, crowns:state.crowns,
      xp:state.xp, streak:state.streak, keyDone:state.keyDone, bestBlitz:state.bestBlitz
    };
    p.lastSeen = Date.now();
    saveAccount();
    /* Si ce profil est relié à un compte, la poussée part toute seule
       un peu plus tard — jamais à chaque réponse. Sans compte, cette
       ligne ne fait rien du tout. */
    if(typeof cloudScheduleSync === "function") cloudScheduleSync();
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
      packed[c] = [r.box||0, Math.round((r.due||0)/DAY)];
    });
    return {
      v:1, n:p.name, x:d.xp||0,
      sc:(d.streak&&d.streak.count)||0, sl:(d.streak&&d.streak.last)||null,
      k:d.keyDone?1:0, bb:d.bestBlitz||0,
      cr:d.crowns||{}, p:packed, cf:d.confusions||{}
    };
  }

  function exportCode(p){
    var json = JSON.stringify(packProfile(p));
    return "WLY1." + b64urlEncode(json) + "." + checksum(json);
  }

  function parseCode(code){
    var clean = String(code).replace(/\s+/g,"");
    var m = clean.match(/^WLY1\.([A-Za-z0-9\-_]+)\.([a-z0-9]+)$/);
    if(!m) return {error:"format"};
    var json;
    try{ json = b64urlDecode(m[1]); }catch(e){ return {error:"illisible"}; }
    if(checksum(json) !== m[2]) return {error:"abime"};
    var obj;
    try{ obj = JSON.parse(json); }catch(e){ return {error:"illisible"}; }
    if(!obj || obj.v !== 1 || !obj.p) return {error:"version"};
    return {obj:obj};
  }

  /* Fusion, pas écrasement : pour chaque wilaya on garde la
     meilleure des deux mémoires. C'est ce qui permet de faire
     l'aller-retour entre deux appareils sans jamais rien perdre. */
  function mergeInto(p, obj){
    var d = p.data || (p.data = blankData());
    d.progress = d.progress || {}; d.crowns = d.crowns || {}; d.confusions = d.confusions || {};
    var added = 0, improved = 0;

    Object.keys(obj.p).forEach(function(c){
      var inc = obj.p[c];
      var incBox = inc[0]||0, incDue = (inc[1]||0)*DAY;
      var cur = d.progress[c];
      if(!cur){
        d.progress[c] = {box:incBox, due:incDue, seen:0, ok:0, best:0};
        added++; return;
      }
      if(incBox > (cur.box||0) || (incBox === (cur.box||0) && incDue > (cur.due||0))){
        cur.box = incBox; cur.due = incDue; improved++;
      }
    });

    d.xp = Math.max(d.xp||0, obj.x||0);
    d.bestBlitz = Math.max(d.bestBlitz||0, obj.bb||0);
    d.keyDone = !!d.keyDone || !!obj.k;
    Object.keys(obj.cr||{}).forEach(function(u){
      d.crowns[u] = Math.max(d.crowns[u]||0, obj.cr[u]||0);
    });
    Object.keys(obj.cf||{}).forEach(function(a){
      d.confusions[a] = d.confusions[a] || {};
      Object.keys(obj.cf[a]).forEach(function(b){
        d.confusions[a][b] = Math.max(d.confusions[a][b]||0, obj.cf[a][b]||0);
      });
    });
    d.streak = d.streak || {count:0,last:null};
    if(obj.sl && (!d.streak.last || obj.sl > d.streak.last)){
      d.streak = {count:obj.sc||0, last:obj.sl};
    }else if(obj.sl && obj.sl === d.streak.last){
      d.streak.count = Math.max(d.streak.count||0, obj.sc||0);
    }
    return {added:added, improved:improved};
  }
