/* Carte d'exploration : état visuel uniquement, jamais de progression.
   Les tracés et l'illustration sont embarqués par build.py, sans réseau.
   Provenance et correspondance des codes : assets/maps/README.md. */
var mapSelection = 11;
var mapView = 'all';
var mapReady = false;
// Les chemins du fournisseur ont tous translate(-862.86 -943.66).
// Le décalage est porté par le viewBox pour conserver le repère natif
// de getBBox() pendant les zooms, sans déplacer ni tronquer le pays.
var mapFullBox = [862.86, 943.66, 10000, 9715];

function mapArabic(w){
  return ARABIC[w.c] || '';
}

function mapSetBox(box){
  document.getElementById('map-svg').setAttribute('viewBox', box.join(' '));
  document.getElementById('map-all').setAttribute('aria-pressed', String(mapView === 'all'));
  document.getElementById('map-north').setAttribute('aria-pressed', String(mapView === 'north'));
}

function mapFit(paths){
  var x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
  paths.forEach(function(path){
    var b = path.getBBox();
    x = Math.min(x, b.x); y = Math.min(y, b.y);
    right = Math.max(right, b.x + b.width); bottom = Math.max(bottom, b.y + b.height);
  });
  if(!isFinite(x) || right <= x || bottom <= y) return;
  var w = Math.max(420, (right - x) * 1.22), h = Math.max(410, (bottom - y) * 1.22);
  // Même rapport que le cadre : le zoom ne change pas la hauteur de page.
  w = Math.max(w, h * mapFullBox[2] / mapFullBox[3]);
  h = w * mapFullBox[3] / mapFullBox[2];
  mapSetBox([(x + right - w) / 2, (y + bottom - h) / 2, w, h]);
}

function mapSelect(code, follow){
  var w = byCode(Number(code));
  if(!w) return;
  mapSelection = w.c;
  var selected = null;
  document.querySelectorAll('#map-regions .map-region').forEach(function(path){
    var on = Number(path.getAttribute('data-code')) === w.c;
    path.classList.toggle('selected', on);
    path.setAttribute('aria-pressed', String(on));
    path.setAttribute('tabindex', on ? '0' : '-1');
    if(on) selected = path;
  });
  document.getElementById('map-picker').value = String(w.c);
  document.getElementById('map-caption').innerHTML =
    "<span class='map-code'>" + num(pad(w.c)) + "</span>" +
    "<span class='map-names'><span lang='fr'>" + esc(w.n) + "</span>" +
    "<span lang='ar' dir='rtl'>" + esc(mapArabic(w)) + "</span></span>";
  if(follow && mapView !== 'all' && selected){
    // Le choix d'une wilaya hors du zoom doit toujours la rendre visible.
    mapView = 'detail'; mapFit([selected]);
  }
}

function buildMap(){
  var svg = document.getElementById('map-svg');
  var group = document.getElementById('map-regions');
  var picker = document.getElementById('map-picker');
  if(!mapReady){
    WILAYA_SHAPES.forEach(function(shape){
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', shape.d);
      path.setAttribute('id', 'map-wilaya-' + pad(shape.code));
      path.setAttribute('class', 'map-region');
      path.setAttribute('data-code', shape.code);
      path.setAttribute('data-source-code', shape.sourceCode);
      path.setAttribute('role', 'button');
      path.addEventListener('click', function(){ mapSelect(shape.code, false); });
      path.addEventListener('keydown', function(e){
        var code = shape.code;
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault(); mapSelect(code, false); return;
        }
        if(e.key === 'ArrowRight' || e.key === 'ArrowDown') code = code % DATA.length + 1;
        else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp') code = (code + DATA.length - 2) % DATA.length + 1;
        else if(e.key === 'Home') code = 1;
        else if(e.key === 'End') code = DATA.length;
        else return;
        e.preventDefault(); mapSelect(code, true);
        document.getElementById('map-wilaya-' + pad(code)).focus({preventScroll:true});
      });
      group.appendChild(path);
    });
    picker.addEventListener('change', function(){ mapSelect(picker.value, true); });
    document.getElementById('map-all').addEventListener('click', function(){
      mapView = 'all'; mapSetBox(mapFullBox);
    });
    document.getElementById('map-north').addEventListener('click', function(){
      mapView = 'north';
      mapFit(DATA.filter(function(w){ return w.lat >= 35; }).map(function(w){
        return document.getElementById('map-wilaya-' + pad(w.c));
      }));
    });
    document.getElementById('map-detail').addEventListener('click', function(){
      mapView = 'detail';
      mapFit([document.getElementById('map-wilaya-' + pad(mapSelection))]);
    });
    document.getElementById('map-landscape').src = WILAYA_PANORAMA;
    mapReady = true;
  }
  // La carte reste complète, quel que soit le niveau des exercices libres.
  picker.innerHTML = DATA.map(function(w){
    return '<option value="' + w.c + '">' + pad(w.c) + ' · ' +
      esc(LANG === 'ar' ? mapArabic(w) : LANG === 'fr' ? w.n : w.n + ' — ' + mapArabic(w)) + '</option>';
  }).join('');
  group.querySelectorAll('path').forEach(function(path){
    var w = byCode(Number(path.getAttribute('data-code')));
    path.setAttribute('aria-label', pad(w.c) + ' · ' + w.n + ' — ' + mapArabic(w));
  });
  document.getElementById('map-all').innerHTML = T('Toute l’Algérie', 'كل الجزائر');
  document.getElementById('map-north').innerHTML = T('Zoom sur le Nord', 'تكبير الشمال');
  document.getElementById('map-detail').innerHTML = T('Agrandir cette wilaya', 'تكبير هذه الولاية');
  document.getElementById('map-picker-label').innerHTML = T('Choisir une wilaya', 'اختر ولاية');
  document.getElementById('map-landscape-caption').innerHTML = T('Du littoral au Sahara · illustration', 'من الساحل إلى الصحراء · رسم توضيحي');
  document.getElementById('map-source-title').innerHTML = T('À propos de la carte', 'عن الخريطة');
  document.getElementById('map-source-text').innerHTML = TS(
    'Tracés communautaires de Chemseddine Allioua (MIT), adaptés aux codes du parcours. Ce n’est pas une carte administrative officielle ; les codes 59–69 restent à confirmer. Le paysage est une illustration de lieux distincts.',
    'حدود من إعداد شمس الدين عليوة (MIT)، مرتبطة برموز المسار. ليست خريطة إدارية رسمية؛ الرموز 59–69 تحتاج إلى تأكيد. المشهد رسم يجمع أماكن مختلفة.');
  mapSelect(mapSelection, false);
}
