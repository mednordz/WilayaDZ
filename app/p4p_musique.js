
  /* ============================================================
     MUSIQUE DE FOND

     Elle vit À CÔTÉ de l'application, jamais dedans. Tout le reste de
     WilayaDZ — polices, mascottes, illustrations — est en base64 dans
     l'unique fichier HTML ; c'est ce qui le fait s'ouvrir en 0,7 Mo sur
     un réseau mobile algérien. Quarante minutes de musique pèsent vingt
     fois ce fichier : les y mettre ruinerait la seule chose qu'on ait
     vraiment gagnée.

     Elle est donc servie en FLUX depuis /media/, et trois règles la
     tiennent à distance :
       · l'élément <audio> n'est créé qu'au moment où quelqu'un allume la
         la musique — sans cela le navigateur ouvrirait une connexion
         pour tout le monde, y compris ceux qui n'en veulent pas ;
       · le service worker laisse passer /media/ sans y toucher (voir
         sw.js) : la Cache API exige un corps entier, donc elle
         téléchargerait les quarante minutes avant la première note et
         avalerait les requêtes Range dont la lecture dépend ;
       · le réglage est LOCAL (localStorage), jamais synchronisé. Écouter
         de la musique sur son téléphone ne dit rien de ce qu'on veut sur
         la tablette du salon, et cela coûte des données.
     ============================================================ */

  var MUSIQUE_KEY = "wilaya-musique-v1";
  /* Un fond doit rester derrière : à ce niveau, les sons de l'app et une
     voix dans la pièce passent devant sans qu'on ait à baisser quoi que
     ce soit. La piste est déjà normalisée à −20 LUFS au ré-encodage. */
  var MUSIQUE_VOLUME = 0.32;
  var musiqueEl = null;
  var musiqueGesteArme = false;

  /* Il n'y a pas de serveur derrière un fichier ouvert en file:// —
     c'est le cas de l'APK. Proposer la musique y serait promettre
     quelque chose qui ne peut pas arriver. */
  function musiqueDisponible(){
    return location.protocol === "http:" || location.protocol === "https:";
  }

  function musiqueVoulue(){
    try{ return localStorage.getItem(MUSIQUE_KEY) === "1"; }catch(e){ return false; }
  }
  function setMusiqueVoulue(v){
    try{ localStorage.setItem(MUSIQUE_KEY, v ? "1" : "0"); }catch(e){}
  }

  function musiqueElement(){
    if(musiqueEl) return musiqueEl;
    var a = document.createElement("audio");
    a.id = "musique";
    a.loop = true;
    a.preload = "none";
    a.volume = appPrefs.volume / 100;
    /* Deux encodages, une seule qui sera téléchargée : le navigateur
       prend la première qu'il sait lire. Opus est plus léger d'un tiers
       et passe partout sauf sur les Safari d'avant 17.4 — d'où l'AAC
       derrière, qui lui se lit vraiment partout. */
    a.innerHTML =
      "<source src='/media/musique.opus' type='audio/ogg; codecs=opus'>" +
      "<source src='/media/musique.m4a' type='audio/mp4; codecs=\"mp4a.40.2\"'>";
    a.addEventListener("error", function(){ musiqueEchec(); }, true);
    document.body.appendChild(a);
    musiqueEl = a;
    return a;
  }

  function musiqueEchec(){
    /* On ne coupe PAS le réglage : une coupure de réseau ne doit pas
       faire oublier un choix. On le dit, et la lecture repartira au
       prochain passage. */
    toast(TL("La musique n'a pas pu être chargée.","تعذّر تحميل الموسيقى."));
  }

  /* Un navigateur refuse de jouer un son que personne n'a demandé. Au
     premier allumage ce n'est pas un problème — le clic EST le geste.
     Mais à la visite suivante, avec le réglage déjà sur « oui », la
     lecture est refusée tant que rien n'a été touché : on la réarme sur
     le premier geste venu, une seule fois. */
  function musiqueArmerGeste(){
    if(musiqueGesteArme) return;
    musiqueGesteArme = true;
    var relancer = function(){
      document.removeEventListener("pointerdown", relancer, true);
      document.removeEventListener("keydown", relancer, true);
      musiqueGesteArme = false;
      if(musiqueVoulue()) musiqueJouer();
    };
    document.addEventListener("pointerdown", relancer, true);
    document.addEventListener("keydown", relancer, true);
  }

  function musiqueJouer(){
    if(!musiqueDisponible()) return;
    var a = musiqueElement();
    var p = a.play();
    if(p && p.catch) p.catch(function(){ musiqueArmerGeste(); });
  }

  function musiqueArreter(){
    if(!musiqueEl) return;
    musiqueEl.pause();
  }

  /* La musique et les effets possèdent des réglages indépendants. */
  function musiqueAppliquer(){
    if(musiqueVoulue() && musiqueDisponible()) musiqueJouer();
    else musiqueArreter();
    renderSoundBtn();
  }

  function musiqueBascule(){
    var suivant = !musiqueVoulue();
    setMusiqueVoulue(suivant);
    musiqueAppliquer();
    return suivant;
  }

  /* La ligne dans la feuille Profil, rangée avec ce qui appartient à
     l'appareil et non au compte. */
  function musiqueRowHtml(){
    if(!musiqueDisponible()) return "";
    var on = musiqueVoulue();
    return "<button class='profile-row' id='prof-musique' aria-pressed='" + (on ? "true" : "false") + "'>" +
      "<span class='cloud-row-icon'>" + MUSIC_ICON + "</span>" +
      "<span class='gate-profile-body'>" +
        "<b>" + TL("Musique de fond","موسيقى خلفية") + "</b>" +
        "<span>" + (on
          ? TL("Allumée — une ambiance calme, en flux","مشغَّلة — أجواء هادئة، بثّا")
          : TL("Éteinte — environ 14 Mo pour 40 minutes","متوقفة — نحو 14 ميغا لأربعين دقيقة")) + "</span>" +
      "</span>" +
    "</button>";
  }

  function wireMusiqueRow(rerender){
    var b = document.getElementById("prof-musique");
    if(!b) return;
    b.addEventListener("click", function(){
      var on = musiqueBascule();
      if(rerender) rerender();
      toast(on ? TL("Musique allumée","الموسيقى مشغَّلة")
               : TL("Musique éteinte","الموسيقى متوقفة"));
    });
  }
