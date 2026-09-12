/*
 * La musique de fond.
 *
 * Ce qu'on veut prouver n'est pas « ça joue », mais que ça joue SANS
 * alourdir l'application :
 *   · rien n'est demandé au réseau tant que personne n'allume ;
 *   · ce qui l'est arrive en FLUX (requêtes Range, réponses 206), et non
 *     en un seul bloc de quinze mégaoctets ;
 *   · le service worker n'y touche pas ;
 *   · couper le son coupe aussi la musique ;
 *   · le réglage reste sur l'appareil et se retrouve au rechargement.
 *
 *   python3 tests/serve_test.py 8390 &
 *   node tests/test_musique.js
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8390/';
const T = 8000;

let ok = 0, ko = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ok   ' + nom); }
  else { ko++; console.log('  ECHEC ' + nom + (detail ? '  → ' + detail : '')); }
}

/* Chaque contexte a son propre localStorage : c'est donc bien un
   appareil, pas un onglet. L'adresse est propre a ce test : la limite
   de tentatives du service compte par IP, et deux suites lancees a la
   suite s'epuiseraient l'une l'autre. */
const RESEAU = '203.0.113.' + (1 + Math.floor(Math.random() * 250));
async function appareil(b) {
  const ctx = await b.newContext({
    viewport: { width: 415, height: 900 },
    extraHTTPHeaders: { 'X-Real-IP': RESEAU }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
  const audio = [];
  page.on('response', (r) => {
    if (r.url().includes('/media/')) audio.push({ url: r.url(), status: r.status() });
  });
  return { ctx, page, audio };
}

/* Un compte est obligatoire : on passe par la porte, comme tout le
   monde, pour que le test éprouve le vrai chemin. */
async function inscrire(page, email) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.locator('#gate-name').fill('Amine');
  await page.locator('#gate-email').fill(email);
  await page.locator('#gate-pw').fill('motdepassesolide');
  await page.locator('#gate-pw2').fill('motdepassesolide');
  await page.locator('#gate-create').click();
  await page.waitForTimeout(1200);
  const lien = await page.evaluate(async (base) => {
    const r = await fetch(base + '__essai__/dernier-lien?genre=confirm');
    return (await r.json()).lien;
  }, BASE);
  if (!lien) throw new Error('aucun lien de confirmation recu');
  await page.goto(lien, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  /* L'accueil qui suit la confirmation propose l'avatar et la langue ;
     on le referme comme n'importe qui le ferait. */
  for (const sel of ['#accueil-go', '#sheet-close', '#gate-box button.btn']) {
    const b = page.locator(sel);
    if (await b.count() && await b.first().isVisible().catch(() => false)) {
      await b.first().click(); await page.waitForTimeout(600); break;
    }
  }
}

async function ouvrirProfil(page) {
  await page.locator('#profile-btn').click();
  await page.waitForTimeout(350);
}

(async () => {
  const b = await chromium.launch();
  const { ctx, page, audio } = await appareil(b);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await inscrire(page, 'musique' + Date.now() + '@example.com');

  console.log('\nAvant tout allumage');
  verif("aucun element <audio> n'existe", await page.locator('audio#musique').count() === 0);
  verif('rien n a ete demande a /media/', audio.length === 0,
        audio.map((a) => a.url).join(' '));

  console.log('\nAllumer');
  await ouvrirProfil(page);
  const ligne = page.locator('#prof-musique');
  verif('la ligne « Musique de fond » est proposée', await ligne.count() === 1);
  verif('elle est éteinte au départ', await ligne.getAttribute('aria-pressed') === 'false');
  await ligne.click();
  await page.waitForTimeout(1600);

  const etat = await page.evaluate(() => {
    const a = document.getElementById('musique');
    if (!a) return null;
    return { paused: a.paused, loop: a.loop, volume: a.volume,
             src: a.currentSrc, t: a.currentTime };
  });
  verif('un <audio> a été créé', etat !== null);
  verif('il joue', etat && !etat.paused);
  verif('il boucle', etat && etat.loop);
  verif('à volume de fond, pas de premier plan', etat && etat.volume > 0 && etat.volume <= 0.4,
        etat && String(etat.volume));
  verif('la piste vient de /media/', !!(etat && /\/media\/musique\.(opus|m4a)$/.test(etat.src)),
        etat && etat.src);

  console.log('\nEn flux, pas en un bloc');
  verif('le réseau a bien été sollicité', audio.length > 0);
  const partielles = audio.filter((a) => a.status === 206);
  verif('au moins une réponse partielle (206) : le navigateur avance par morceaux',
        partielles.length > 0, audio.map((a) => a.status).join(','));
  const recu = await page.evaluate(() => {
    const a = document.getElementById('musique');
    /* Ce que le navigateur a réellement mis en mémoire tampon, en
       secondes. Sur une piste de 40 min, quelques dizaines de secondes
       suffisent à prouver qu'il ne l'a pas avalée en entier. */
    return { bufferisee: a.buffered.length ? a.buffered.end(0) : 0, duree: a.duration };
  });
  verif('la piste dure bien une quarantaine de minutes', recu.duree > 2000,
        String(recu.duree));
  verif('seule une fraction est chargée, pas les 40 minutes',
        recu.bufferisee < recu.duree * 0.5,
        recu.bufferisee + ' s sur ' + recu.duree);

  console.log('\nLe bouton son coupe tout');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('#sound-btn').click();
  await page.waitForTimeout(400);
  verif('son coupé → musique en pause',
        await page.evaluate(() => document.getElementById('musique').paused));
  await page.locator('#sound-btn').click();
  await page.waitForTimeout(600);
  verif('son rendu → la musique repart',
        !(await page.evaluate(() => document.getElementById('musique').paused)));

  console.log('\nLe réglage reste sur l appareil');
  const avant = await page.evaluate(() => localStorage.getItem('wilaya-musique-v1'));
  verif('rangé dans localStorage', avant === '1');
  const packed = await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    return JSON.stringify(a.profiles[0].data);
  });
  verif('et JAMAIS dans la progression du compte', !/musique/i.test(packed));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  /* Un navigateur refuse de jouer tant que rien n'a été touché : le
     premier geste doit relancer la lecture tout seul. On vise la
     marque, qui ne déclenche rien — cliquer au hasard tombait sur la
     carte de l'étape suivante et lançait une leçon. */
  await page.locator('.brand').click();
  await page.waitForTimeout(1400);
  verif('après rechargement et un premier geste, elle repart',
        !(await page.evaluate(() => {
          const a = document.getElementById('musique');
          return !a || a.paused;
        })));

  console.log('\nÉteindre');
  await ouvrirProfil(page);
  await page.locator('#prof-musique').click();
  await page.waitForTimeout(500);
  verif('musique en pause',
        await page.evaluate(() => document.getElementById('musique').paused));
  verif('le réglage suit',
        await page.evaluate(() => localStorage.getItem('wilaya-musique-v1')) === '0');

  console.log('\nLe service worker n y touche pas');
  const swSrc = await page.evaluate(async (base) => (await (await fetch(base + 'sw.js')).text()), BASE);
  verif('/media/ est dans la liste des chemins laissés passer', /NO_CACHE_PREFIX\s*=\s*\[[^\]]*\/media\//.test(swSrc));

  console.log('\nERREURS JS :', errs.length ? errs.join(' | ') : 'aucune');
  if (errs.length) ko++;

  console.log('\n' + (ok + ko) + ' verifications, ' + ko + ' echec(s)');
  console.log(ko ? 'A CORRIGER.' : 'Tout est vert.');
  await ctx.close();
  await b.close();
  process.exit(ko ? 1 : 0);
})();
