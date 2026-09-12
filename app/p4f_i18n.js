
  /* ============================================================
     BILINGUE SIMULTANÉ — « la colonne vertébrale »
     Aucun réglage de langue : les deux langues vivent ensemble.
     Le français est toujours ancré au bord GAUCHE, l'arabe
     toujours au bord DROIT, séparés par un filet vertical.
     Chaque lecteur commence par SON bord et lit vers le centre :
     les deux sens de lecture opposés deviennent la mise en page.
     ============================================================ */

  /* Le mode vit sur le profil : "fr", "ar", ou "bi" (les deux).
     Le DOM porte toujours les deux langues ; c'est le CSS qui
     masque la moitié non choisie. Une seule source de vérité,
     et le contenu (.bi-keep) échappe toujours au masquage. */
  var LANG = "bi";
  function applyLang(lang){
    LANG = (lang === "fr" || lang === "ar") ? lang : "bi";
    var r = document.documentElement;
    r.setAttribute("data-lang", LANG);
    r.setAttribute("dir", LANG === "ar" ? "rtl" : "ltr");
    r.setAttribute("lang", LANG === "ar" ? "ar" : "fr");
    if(typeof renderSoundBtn === "function")renderSoundBtn();
    if(typeof renderLanguageButton === "function")renderLanguageButton();
  }

  /* Isole une plage de codes du sens de lecture ambiant. */
  function num(txt){ return "<bdi dir='ltr'>" + txt + "</bdi>"; }
  /* N'isole que les chaînes purement numériques (codes, plages,
     écarts) : une prose arabe ne doit surtout pas passer en LTR. */
  function numIf(txt){ return /^[\d\s\u2013\-\/]+$/.test(String(txt)) ? num(txt) : txt; }
  function plain(html){ return String(html).replace(/<[^>]*>/g, ""); }

  /* Échappement complet (texte ET attributs) : les guillemets sont
     inclus car esc() sert aussi à construire des valeurs d'attribut
     (ex. aria-label="...") — sans eux, un nom de profil contenant
     un guillemet casserait hors de l'attribut (injection HTML). */
  function esc(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  /* Paire côte à côte : titres, libellés, boutons, options. */
  function T(fr, ar, cls){
    if(!ar) return "<span lang='fr'>" + fr + "</span>";
    return "<span class='bi " + (cls||"") + "'>" +
             "<span class='bf' lang='fr'>" + fr + "</span>" +
             "<span class='bs' aria-hidden='true'></span>" +
             "<span class='ba' lang='ar' dir='rtl'>" + ar + "</span>" +
           "</span>";
  }
  /* Paire empilée : paragraphes, textes longs. */
  function TS(fr, ar){
    if(!ar) return "<span lang='fr'>" + fr + "</span>";
    return "<span class='bis'>" +
             "<span class='bf2' lang='fr'>" + fr + "</span>" +
             "<span class='ba2' lang='ar' dir='rtl'>" + ar + "</span>" +
           "</span>";
  }
  /* Version texte pur, pour aria-label et annonces vocales.
     Les deux langues sont séparées par un tiret : les lecteurs
     d'écran changent de voix grâce aux attributs lang/dir du DOM,
     et ici on garde les deux pour ne priver personne. */
  function TL(fr, ar){
    if(!ar) return fr;
    if(LANG === "fr") return fr;
    if(LANG === "ar") return ar;
    return fr + " — " + ar;
  }

  /* Nom de wilaya : toujours les deux écritures. */
  /* Les noms de wilayas restent bilingues quel que soit le mode :
     c'est la matière de l'application, pas de l'habillage. Et la
     règle alphabétique n'a aucun sens sans l'arabe sous les yeux. */
  function wname(w){ return T(w.n, ARABIC[w.c] || "", "bi-keep"); }
  function wnameL(w){ var a = ARABIC[w.c]; return a ? (w.n + " — " + a) : w.n; }
  function wnameBig(w){ return T(w.n, ARABIC[w.c] || "", "bi-lg bi-keep"); }

  /* Libellés d'unités du parcours */
  var UNIT_AR = {
    u1:"أدرار ← البويرة", u2:"تمنراست ← جيجل", u3:"سطيف ← قسنطينة",
    u4:"المدية ← وهران", u5:"البيض ← خنشلة", u6:"سوق أهراس ← غليزان",
    u7:"ولايات الجنوب (2019)", u8:"الأحدث (2025)"
  };
