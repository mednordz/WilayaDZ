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

  check('A demarre sur le profil garni', (await countProgress(a)) === 5, await countProgress(a));

  await a.locator('#profile-btn').click(); await a.waitForTimeout(400);
  check('A voit la ligne « Compte en ligne »', await a.locator('#prof-cloud').isVisible());
  await a.locator('#prof-cloud').click(); await a.waitForTimeout(400);
  await a.locator('#cloud-go-register').click(); await a.waitForTimeout(400);

  check('le prenom est deja rempli', (await a.locator('#creg-name').inputValue()) === 'Amine');
  await a.fill('#creg-email', EMAIL);
  await a.fill('#creg-pw', PASSWORD);
  await a.locator('#creg-go').click();
  await waitFor(async () => (await cloudEmail(a)) === EMAIL);

  check('A est relie au compte', (await cloudEmail(a)) === EMAIL, await cloudEmail(a));
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

  console.log('\nERREURS JS : ' + (errs.length ? errs.join(' | ') : 'aucune'));
  if (errs.length) failures.push('erreurs JS');

  await browser.close();
  console.log('\n' + checks + ' verifications, ' + failures.length + ' echec(s)');
  if (failures.length) { failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('Tout est vert.');
})();
