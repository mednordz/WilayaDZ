
  /* ============================================================
     AVATARS

     Trois formes, dans cet ordre de préférence :
       · une photo envoyée par la personne ;
       · une des quatre mascottes déjà embarquées — elles ne coûtent
         pas un octet de plus, leurs têtes sont déjà dans le fichier ;
       · à défaut, l'initiale sur un rond de couleur, comme avant.

     Une photo est redimensionnée DANS LE NAVIGATEUR avant d'être
     gardée. Sans cela, une photo de téléphone de 4 Mo partirait telle
     quelle dans la synchronisation, qui refuse au-delà de 512 Kio —
     et la personne ne comprendrait pas pourquoi.
     ============================================================ */

  var AVATAR_MASCOTTES = ["fennec", "chameau", "cigogne", "palmier"];

  /* 160 px suffisent : le plus grand endroit où un avatar s'affiche
     fait 66 px, soit 132 px sur un écran à double densité. */
  var AVATAR_TAILLE = 160;
  var AVATAR_QUALITE = 0.82;
  var AVATAR_MAX_OCTETS = 60 * 1024;

  function avatarDe(p){ return (p && p.avatar) || null; }

  /* Pose l'avatar sur un élément déjà rond (bouton, span…). */
  function applyAvatar(el, p){
    if(!el) return;
    var a = avatarDe(p);
    el.classList.remove("av-photo", "av-mascotte");
    if(a && a.k === "p"){
      el.classList.add("av-photo");
      el.style.background = "";
      el.style.backgroundImage = "url(" + a.v + ")";
      el.innerHTML = "";
      return;
    }
    el.style.backgroundImage = "";
    el.style.background = PROFILE_COLORS[(p && p.color) || 0];
    if(a && a.k === "m" && typeof MASCOTS !== "undefined" && MASCOTS[a.v]){
      el.classList.add("av-mascotte");
      el.innerHTML = "<img alt='' src='" + MASCOTS[a.v].head + "' />";
      return;
    }
    el.textContent = profileInitial(p);
  }

  /* La même chose en chaîne, pour les listes construites d'un bloc. */
  function avatarHtml(p, cls){
    var a = avatarDe(p);
    var base = "class='" + cls + (a && a.k === "p" ? " av-photo" : (a && a.k === "m" ? " av-mascotte" : "")) + "'";
    if(a && a.k === "p"){
      return "<span " + base + " style=\"background-image:url(" + a.v + ")\"></span>";
    }
    var fond = "style='background:" + PROFILE_COLORS[(p && p.color) || 0] + "'";
    if(a && a.k === "m" && typeof MASCOTS !== "undefined" && MASCOTS[a.v]){
      return "<span " + base + " " + fond + "><img alt='' src='" + MASCOTS[a.v].head + "' /></span>";
    }
    return "<span " + base + " " + fond + ">" + profileInitial(p) + "</span>";
  }

  /* L'horodatage sert à trancher entre deux appareils : c'est le plus
     récent qui gagne, comme pour tout ce qui n'est pas cumulable. */
  function setAvatar(p, avatar){
    if(!p) return;
    p.avatar = avatar;
    p.avatarAt = Date.now();
    saveAccount();
    renderAvatar();
    /* Tout de suite, pas dans dix secondes : c'est un geste délibéré et
       unique, pas une réponse de quiz. Quelqu'un qui choisit son avatar
       puis ouvre l'application sur sa tablette doit l'y retrouver. */
    if(typeof cloudFlushNow === "function") cloudFlushNow();
  }

  /* ---------------- Envoi d'une photo ---------------- */

  /* Renvoie une promesse de {ok, data} ou {ok:false, message}. */
  function avatarDepuisFichier(file){
    return new Promise(function(resolve){
      if(!file) return resolve({ok:false, message:TL("Aucune image choisie.","لم تُختر صورة.")});
      if(!/^image\//.test(file.type)){
        return resolve({ok:false, message:TL("Choisis une image.","اختر صورة.")});
      }
      /* 25 Mio : au-delà, c'est le décodage lui-même qui ferait
         trébucher un téléphone modeste — autant refuser tout de suite. */
      if(file.size > 25 * 1024 * 1024){
        return resolve({ok:false, message:TL("Cette image est trop lourde.","هذه الصورة ثقيلة جدا.")});
      }

      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){
        URL.revokeObjectURL(url);
        try{
          var c = document.createElement("canvas");
          c.width = AVATAR_TAILLE; c.height = AVATAR_TAILLE;
          var ctx = c.getContext("2d");
          /* Recadrage centré : on garde le carré du milieu plutôt que
             d'écraser la photo pour la faire entrer. */
          var cote = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2,
                        cote, cote, 0, 0, AVATAR_TAILLE, AVATAR_TAILLE);
          var data = c.toDataURL("image/jpeg", AVATAR_QUALITE);
          if(data.length > AVATAR_MAX_OCTETS){
            data = c.toDataURL("image/jpeg", 0.6);
          }
          if(data.length > AVATAR_MAX_OCTETS){
            return resolve({ok:false, message:TL("Cette image ne peut pas être réduite assez.",
                                                 "تعذّر تصغير هذه الصورة بما يكفي.")});
          }
          resolve({ok:true, data:data});
        }catch(e){
          resolve({ok:false, message:TL("Cette image n'a pas pu être lue.","تعذّرت قراءة هذه الصورة.")});
        }
      };
      img.onerror = function(){
        URL.revokeObjectURL(url);
        resolve({ok:false, message:TL("Cette image n'a pas pu être lue.","تعذّرت قراءة هذه الصورة.")});
      };
      img.src = url;
    });
  }

  /* ---------------- Le choix ---------------- */

  /* La grille, réutilisée par la feuille du profil ET par l'accueil qui
     suit la confirmation : un seul endroit à corriger. */
  function avatarPickerHtml(p){
    var a = avatarDe(p);
    var choisi = function(k, v){
      return (a && a.k === k && (v === undefined || a.v === v)) ? " on" : "";
    };
    var cases = AVATAR_MASCOTTES.map(function(nom){
      return "<button type='button' class='av-choix" + choisi("m", nom) + "' data-mascotte='" + nom + "' " +
        "aria-pressed='" + (a && a.k === "m" && a.v === nom ? "true" : "false") + "' " +
        "aria-label=\"" + TL("Mascotte " + nom, "شخصية " + nom) + "\">" +
        "<span class='av av-mascotte' style='background:" + PROFILE_COLORS[(p && p.color) || 0] + "'>" +
          "<img alt='' src='" + MASCOTS[nom].head + "' /></span>" +
      "</button>";
    }).join("");

    var initiale = "<button type='button' class='av-choix" + (!a ? " on" : "") + "' data-lettre='1' " +
      "aria-pressed='" + (!a ? "true" : "false") + "' " +
      "aria-label=\"" + TL("Ton initiale sur un rond de couleur","الحرف الأول على دائرة ملونة") + "\">" +
      "<span class='av' style='background:" + PROFILE_COLORS[(p && p.color) || 0] + "'>" +
        profileInitial(p) + "</span></button>";

    return "<div class='av-grille'>" + initiale + cases + "</div>" +
      "<label class='btn ghost av-envoi' for='av-fichier'>" +
        T("Envoyer une photo","أرسل صورة") + "</label>" +
      "<input type='file' id='av-fichier' accept='image/*' class='sr-only' />" +
      "<p class='gate-err' id='av-err' role='alert'></p>";
  }

  function wireAvatarPicker(root, p, onChange){
    Array.prototype.forEach.call(root.querySelectorAll(".av-choix"), function(b){
      b.addEventListener("click", function(){
        var m = b.getAttribute("data-mascotte");
        setAvatar(p, m ? {k:"m", v:m} : null);
        if(onChange) onChange();
      });
    });
    var champ = root.querySelector("#av-fichier");
    if(champ) champ.addEventListener("change", function(){
      var f = champ.files && champ.files[0];
      champ.value = "";
      cloudErrInto("av-err", "");
      avatarDepuisFichier(f).then(function(r){
        if(!r.ok) return cloudErrInto("av-err", r.message);
        setAvatar(p, {k:"p", v:r.data});
        if(onChange) onChange();
      });
    });
  }

  function openAvatarSheet(){
    var p = activeProfile();
    if(!p) return;
    openSheet(
      "<h2 id='sheet-title'>" + T("Ta photo","صورتك") + "</h2>" +
      "<p class='sub'>" + TS("Elle te suit sur tous tes appareils.",
                             "ستتبعك على كل أجهزتك.") + "</p>" +
      avatarPickerHtml(p) +
      "<button class='btn' id='sheet-close' style='margin-top:12px;'>" + T("Terminé","تم") + "</button>"
    );
    var boite = document.getElementById("sheet-box");
    wireAvatarPicker(boite, p, function(){ openAvatarSheet(); });
    document.getElementById("sheet-close").addEventListener("click", closeSheet);
  }
