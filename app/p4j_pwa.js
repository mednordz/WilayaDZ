
  /* ============================================================
     PWA — enregistrement du service worker (sw.js)
     Uniquement sur http(s) : file:// (l'APK, un double-clic local)
     n'autorise pas les service workers — l'enregistrement échouerait
     silencieusement de toute façon, mais autant ne pas le tenter.
     ============================================================ */
  if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("./sw.js").catch(function(){});
    });
  }
