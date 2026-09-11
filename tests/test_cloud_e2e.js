/*
 * Deux appareils, un seul compte.
 *
 * Chaque contexte Playwright a son propre localStorage : c'est donc une
 * vraie simulation de deux telephones, pas deux onglets qui partagent
 * tout. Ce que le test prouve est exactement ce qui a ete demande —
 * qu'un profil retrouve sa progression partout ou l'on se connecte, et
 * que les deux sens fonctionnent.
 *
 *   python3 tests/serve_test.py 8390 &
 *   node tests/test_cloud_e2e.js
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8390/';
// Surchargeable pour pouvoir viser la production et supprimer ensuite le
// compte d'essai : node tests/test_cloud_e2e.js puis DELETE /account.
const EMAIL = process.env.EMAIL || ('e2e-' + Date.now() + '@example.com');
const PASSWORD = 'motdepassesolide';
const NEW_PASSWORD = 'unnouveaumotdepasse';

let checks = 0;
const failures = [];
function check(label, ok, detail) {
  checks++;
  if (ok) console.log('  ok   ' + label);
  else { console.log('  FAIL ' + label + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); failures.push(label); }
}

/* Un profil local deja garni, tel que l'application l'ecrit elle-meme. */
function seedAccount(codes) {
  const progress = {};
  codes.forEach((c, i) => { progress[c] = { box: 3 + (i % 3), due: 0, seen: 6, ok: 4, best: 2 }; });
  return {
    profiles: [{
      id: 'ptest1', name: 'Amine', salt: 'abc', pin: null, lang: 'bi', color: 0,
      created: 1757000000000, lastSeen: 1757000000000,
      data: {
        progress: progress, confusions: {}, crowns: { u1: 2 },
        xp: 340, streak: { count: 4, last: '2026-09-11' },
        keyDone: true, bestBlitz: 11
      }
    }],
    activeId: 'ptest1'
  };
}

/* Attendre une condition plutôt qu'une durée : contre la production, un
 * aller-retour réseau réel dure cent fois ce qu'il dure en local, et une
 * pause fixe suffisamment longue pour être fiable rendrait le test
 * interminable. */
async function waitFor(fn, ms, step) {
  const end = Date.now() + (ms || 20000);
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* page occupée */ }
    if (Date.now() > end) return false;
    await new Promise(r => setTimeout(r, step || 250));
  }
}

/* Le lien du dernier courriel, relu comme le ferait un client de
 * messagerie. Seul le serveur d'essai le capture ; contre la production
 * ce point d'entree n'existe pas. */
async function lienDuMail(genre) {
  let lien = '';
  await waitFor(async () => {
    const r = await fetch(BASE + '__essai__/dernier-lien?genre=' + genre);
    if (!r.ok) return false;
    lien = (await r.json()).lien;
    return !!lien;
  });
  return lien;
}
async function courrielLisible() {
  try { return (await fetch(BASE + '__essai__/dernier-lien')).ok; }
  catch (e) { return false; }
}

const countProgress = (page) => page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('wilaya-account-v1') || '{}');
  const p = (a.profiles || []).find(x => x.id === a.activeId) || (a.profiles || [])[0];
  return p ? Object.keys(p.data.progress || {}).length : -1;
});
const cloudEmail = (page) => page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('wilaya-account-v1') || '{}');
  const p = (a.profiles || []).find(x => x.id === a.activeId) || (a.profiles || [])[0];
  return p && p.cloud ? p.cloud.email : null;
});

(async () => {
  const browser = await chromium.launch();
  const errs = [];

  /* Depuis que l'adresse doit etre confirmee, le parcours complet exige
     de lire le courriel — ce que seul tests/serve_test.py permet. Contre
     la production on verifie donc ce qui est verifiable de l'exterieur,
     et on le DIT, plutot que d'echouer en laissant croire a un bug. */
  if (!(await courrielLisible())) {
    console.log('\nParcours reduit — le courriel n\'est lisible qu\'avec');
    console.log('tests/serve_test.py. Ce qui suit est tout ce qui se verifie');
    console.log('depuis l\'exterieur.\n');
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('prod: ' + e.message));
    await page.goto(BASE); await page.waitForTimeout(800);

    check('on ne peut pas entrer sans compte', await page.locator('#gate-create').isVisible());
    check('la connexion est proposee', await page.locator('#gate-login').isVisible());

    const reg = await fetch(BASE + 'api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, name: 'Essai', password: PASSWORD })
    });
    const regJson = await reg.json();
    check('l inscription ne donne aucun jeton', reg.status === 202 && !regJson.token,
          [reg.status, regJson]);

    const log = await fetch(BASE + 'api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const logJson = await log.json();
    check('la connexion est refusee tant que l adresse n est pas confirmee',
          log.status === 403 && logJson.error === 'not_verified', [log.status, logJson]);

    await page.locator('#gate-login').click(); await page.waitForTimeout(400);
    await page.fill('#glog-email', EMAIL);
    await page.fill('#glog-pw', PASSWORD);
    await page.locator('#glog-go').click();
    await waitFor(async () => await page.locator('#gpen-resend').isVisible());
    check('l application emmene vers la boite mail au lieu d une erreur',
          await page.locator('#gpen-resend').isVisible());

    await page.goto(BASE + '#reset=' + 'z'.repeat(43)); await page.waitForTimeout(900);
    check('un lien de reinitialisation invalide est refuse proprement',
          await page.locator('#gres-pw').isVisible());

    console.log('\nERREURS JS : ' + (errs.length ? errs.join(' | ') : 'aucune'));
    if (errs.length) failures.push('erreurs JS');
    await browser.close();
    console.log('\n' + checks + ' verifications, ' + failures.length + ' echec(s)');
    if (failures.length) { failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
    console.log('Tout est vert (parcours reduit).');
    return;
  }

  /* ---------------- Appareil A : cree le compte ---------------- */
  console.log('\nAppareil A — creation du compte');
  const ctxA = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const a = await ctxA.newPage();
  a.on('pageerror', e => errs.push('A: ' + e.message));

  await a.goto(BASE);
  await a.evaluate(seed => localStorage.setItem('wilaya-account-v1', JSON.stringify(seed)),
                   seedAccount(['16', '31', '09', '25', '48']));
  await a.reload();
  await a.waitForTimeout(700);

  check('A a bien sa progression locale', (await countProgress(a)) === 5, await countProgress(a));
  // Le compte est obligatoire : un profil d'avant les comptes ne peut
  // plus entrer sans etre rattache. Sa progression ne doit pas pour
  // autant disparaitre — c'est tout l'enjeu de ce passage.
  check('A est retenu par la porte tant qu il n a pas de compte',
        await a.locator('#gate-create').isVisible());
  check('le prenom du profil est deja rempli',
        (await a.locator('#gate-name').inputValue()) === 'Amine');

  await a.fill('#gate-email', EMAIL);
  await a.fill('#gate-pw', PASSWORD);
  const porteA = () => a.locator('#gate-box').isVisible().catch(() => false).then(v => !v);
  await a.locator('#gate-create').click();

  // Rien n'est acquis a l'inscription : on attend la confirmation.
  await waitFor(async () => await a.locator('#gpen-resend').isVisible());
  check('A est renvoye vers sa boite mail', await a.locator('#gpen-resend').isVisible());
  check('A n est PAS entre dans l application', !(await porteA()));
  check('aucun compte n est encore rattache', (await cloudEmail(a)) === null,
        await cloudEmail(a));
  check('la progression locale est intacte pendant l attente',
        (await countProgress(a)) === 5, await countProgress(a));

  const lienConf = await lienDuMail('confirm');
  check('un lien de confirmation a ete envoye', !!lienConf, lienConf);

  await a.goto(lienConf);
  await waitFor(async () => (await cloudEmail(a)) === EMAIL && (await porteA()));

  check('A est relie au compte apres confirmation',
        (await cloudEmail(a)) === EMAIL, await cloudEmail(a));
  check('la progression locale a survecu au rattachement',
        (await countProgress(a)) === 5, await countProgress(a));
  check('A est entre dans l application', await porteA());
  check('le jeton de confirmation est retire de la barre d adresse',
        !a.url().includes('confirm='), a.url());

  await a.locator('#profile-btn').click(); await a.waitForTimeout(400);
  check('A voit la ligne « Compte en ligne »', await a.locator('#prof-cloud').isVisible());
  await a.locator('#prof-cloud').click(); await a.waitForTimeout(400);
  const statusA = await a.locator('.cloud-status-body b').first().innerText().catch(() => '');
  check('la feuille affiche l adresse', statusA.trim() === EMAIL, statusA);
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);

  /* ---------------- Appareil B : se connecte ---------------- */
  console.log('\nAppareil B — appareil neuf, connexion');
  const ctxB = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const b = await ctxB.newPage();
  b.on('pageerror', e => errs.push('B: ' + e.message));

  await b.goto(BASE); await b.waitForTimeout(700);
  check('B demarre sans aucun profil', (await countProgress(b)) === -1);
  check('B ne peut pas entrer sans compte', await b.locator('#gate-create').isVisible());
  check('B propose « J ai deja un compte »', await b.locator('#gate-login').isVisible());

  await b.locator('#gate-login').click(); await b.waitForTimeout(400);
  await b.fill('#glog-email', EMAIL);
  await b.fill('#glog-pw', PASSWORD);
  const gateGone = () => b.locator('#gate-box').isVisible().catch(() => false).then(v => !v);
  await b.locator('#glog-go').click();
  // Les donnees arrivent pendant cloudSync ; la porte ne se ferme qu'une
  // fois la promesse resolue. Attendre les deux, pas seulement la
  // premiere des deux.
  await waitFor(async () => (await countProgress(b)) === 5 && (await gateGone()));

  check('B a recupere la progression', (await countProgress(b)) === 5, await countProgress(b));
  check('B est relie au meme compte', (await cloudEmail(b)) === EMAIL, await cloudEmail(b));
  check('B a bien quitte la porte d entree', await gateGone());

  const xpB = await b.evaluate(() => {
    const acc = JSON.parse(localStorage.getItem('wilaya-account-v1') || '{}');
    const p = acc.profiles[0];
    return { xp: p.data.xp, streak: p.data.streak.count, blitz: p.data.bestBlitz, crowns: p.data.crowns.u1 };
  });
  check('les XP ont suivi', xpB.xp === 340, xpB);
  check('la serie a suivi', xpB.streak === 4, xpB);
  check('le meilleur blitz a suivi', xpB.blitz === 11, xpB);
  check('les couronnes ont suivi', xpB.crowns === 2, xpB);

  /* ------------- Un 3e appareil progresse, A doit le voir -------------
     On ne peut pas garnir localStorage sous les pieds d'une page
     ouverte : en se déchargeant, elle réécrit ce qu'elle a en mémoire
     (cloudFlushNow sur visibilitychange) et l'injection disparaît. Ce
     comportement est voulu — la mémoire vive fait foi et part avant
     qu'on quitte. On monte donc un vrai troisième appareil, connecté au
     même compte et déjà plus avancé. */
  console.log('\nRetour : un 3e appareil progresse, A recupere');
  const accB = await b.evaluate(() => localStorage.getItem('wilaya-account-v1'));
  const ctxB2 = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const b2 = await ctxB2.newPage();
  b2.on('pageerror', e => errs.push('B2: ' + e.message));

  // Premier chargement sans aucun profil : la porte d'entrée s'affiche
  // et il n'y a rien en mémoire qui puisse écraser ce qu'on écrit.
  await b2.goto(BASE); await b2.waitForTimeout(500);
  await b2.evaluate((raw) => {
    const acc = JSON.parse(raw);
    const p = acc.profiles.find(x => x.id === acc.activeId);
    p.data.progress['06'] = { box: 5, due: 0, seen: 9, ok: 8, best: 4 };
    p.data.xp = 500;
    localStorage.setItem('wilaya-account-v1', JSON.stringify(acc));
  }, accB);
  await b2.reload();
  await waitFor(async () => (await countProgress(b2)) === 6 && (await cloudEmail(b2)) === EMAIL);
  check('le 3e appareil a bien 6 wilayas', (await countProgress(b2)) === 6, await countProgress(b2));
  check('le 3e appareil est sur le meme compte', (await cloudEmail(b2)) === EMAIL);

  await a.locator('#profile-btn').click(); await a.waitForTimeout(400);
  await a.locator('#prof-cloud').click(); await a.waitForTimeout(400);
  await a.locator('#cloud-now').click();
  await waitFor(async () => (await countProgress(a)) === 6);

  check('A a recupere la 6e wilaya', (await countProgress(a)) === 6, await countProgress(a));
  const xpA = await a.evaluate(() => {
    const acc = JSON.parse(localStorage.getItem('wilaya-account-v1') || '{}');
    const p = acc.profiles.find(x => x.id === acc.activeId);
    return { xp: p.data.xp, box06: p.data.progress['06'] ? p.data.progress['06'].box : null };
  });
  check('A a reçu les XP les plus eleves', xpA.xp === 500, xpA);
  check('A a reçu la bonne boite pour 06', xpA.box06 === 5, xpA);

  /* ------------- Le service worker ne doit pas toucher a l'API -------------
     Il intercepte tous les GET de meme origine : sans exclusion
     explicite, /api/sync serait servi depuis le cache — une progression
     perimee en boucle, et les donnees du compte laissees dans le cache
     du navigateur apres une deconnexion. */
  console.log('\nService worker');
  const swState = await b.evaluate(async () => {
    if (!navigator.serviceWorker) return { registered: false, cached: [] };
    const regs = await navigator.serviceWorker.getRegistrations();
    const cached = [];
    if (window.caches) {
      for (const n of await caches.keys()) {
        const c = await caches.open(n);
        for (const r of await c.keys()) {
          if (new URL(r.url).pathname.startsWith('/api/')) cached.push(r.url);
        }
      }
    }
    return { registered: regs.length > 0, cached: cached };
  });
  check('le service worker est bien actif (test significatif)', swState.registered, swState);
  check('aucune reponse de l API n est mise en cache', swState.cached.length === 0, swState.cached);

  /* ------------- Mauvais mot de passe ------------- */
  console.log('\nRefus');
  const ctxC = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const c = await ctxC.newPage();
  c.on('pageerror', e => errs.push('C: ' + e.message));
  await c.goto(BASE); await c.waitForTimeout(700);
  await c.locator('#gate-login').click(); await c.waitForTimeout(300);
  await c.fill('#glog-email', EMAIL);
  await c.fill('#glog-pw', 'pasbonnedutout');
  await c.locator('#glog-go').click();
  await waitFor(async () => (await c.locator('#glog-err').innerText()).trim().length > 0);
  const errC = (await c.locator('#glog-err').innerText()).trim();
  check('un mauvais mot de passe est refuse', errC.length > 0, errC);
  check('aucun profil n a ete cree au passage', (await countProgress(c)) === -1);

  /* ------------- Mot de passe oublie, de bout en bout -------------
     Le lien est relu dans le message capture par le serveur d'essai,
     exactement comme le ferait un client de messagerie. */
  console.log('\nMot de passe oublie');
  const ctxD = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const d = await ctxD.newPage();
  d.on('pageerror', e => errs.push('D: ' + e.message));

  await d.goto(BASE); await d.waitForTimeout(700);
  await d.locator('#gate-login').click(); await d.waitForTimeout(400);
  check('la connexion propose « Mot de passe oublié ? »',
        await d.locator('#glog-forgot').isVisible());
  await d.locator('#glog-forgot').click(); await d.waitForTimeout(400);

  await d.fill('#gfor-email', EMAIL);
  await d.locator('#gfor-go').click();
  await waitFor(async () => await d.locator('#gfor-done').isVisible());
  const neutre = (await d.locator('#gfor-done').innerText()).trim();
  check('la confirmation ne dit pas si le compte existe',
        /Si un compte existe/.test(neutre), neutre.slice(0, 60));

  // Lire le courriel n'est possible qu'avec le serveur d'essai, qui
  // capture les messages. Contre la production ce point d'entree
  // n'existe pas : on le dit au lieu de sauter en silence.
  const lisible = await courrielLisible();
  let lien = '';
  if (!lisible) {
    console.log('  --   suite du parcours non verifiable ici : le courriel');
    console.log('       n\'est lisible qu\'avec tests/serve_test.py.');
  } else {
    lien = await lienDuMail('reset');
    check('un lien de reinitialisation a ete envoye', !!lien, lien);
  }
  if (lisible) {

  await d.goto(lien);
  await d.waitForTimeout(900);
  check('le lien ouvre l ecran de nouveau mot de passe',
        await d.locator('#gres-pw').isVisible());
  check('le jeton est retire de la barre d adresse',
        !d.url().includes('reset='), d.url());

  await d.fill('#gres-pw', NEW_PASSWORD);
  await d.locator('#gres-go').click();
  await waitFor(async () => (await cloudEmail(d)) === EMAIL);
  check('la reinitialisation connecte directement',
        (await cloudEmail(d)) === EMAIL, await cloudEmail(d));
  check('la progression du compte est arrivee',
        (await countProgress(d)) === 6, await countProgress(d));

  const apres = await fetch(BASE + 'api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  check('l ancien mot de passe ne marche plus', apres.status === 401, apres.status);
  }

  /* ------------- Un lien perime ------------- */
  const ctxE = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const e2 = await ctxE.newPage();
  await e2.goto(BASE + '#reset=' + 'z'.repeat(43));
  await e2.waitForTimeout(900);
  await e2.fill('#gres-pw', 'unautremotdepasse');
  await e2.locator('#gres-go').click();
  await waitFor(async () => (await e2.locator('#gres-err').innerText()).trim().length > 0);
  check('un lien invalide est refuse et propose d en redemander un',
        await e2.locator('#gres-again').isVisible());

  console.log('\nERREURS JS : ' + (errs.length ? errs.join(' | ') : 'aucune'));
  if (errs.length) failures.push('erreurs JS');

  await browser.close();
  console.log('\n' + checks + ' verifications, ' + failures.length + ' echec(s)');
  if (failures.length) { failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('Tout est vert.');
})();
