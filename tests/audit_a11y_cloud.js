/*
 * Accessibilite des ecrans de compte.
 *
 * audit_a11y.js couvre l'application en file:// ; ces ecrans-la n'y
 * apparaissent jamais, puisqu'ils n'existent qu'avec une origine http.
 * Ce sont pourtant les seuls a comporter de vrais formulaires — et,
 * depuis que le compte est obligatoire, les premiers que voit qui que
 * ce soit en ouvrant l'application.
 *
 *   python3 tests/serve_test.py 8390 &
 *   node tests/audit_a11y_cloud.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:8390/';
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PASSWORD = 'motdepassesolide';
const T = 8000;

let total = 0;
const bad = [];

async function runAxe(page, label) {
  await page.addScriptTag({ content: axeSrc, timeout: T });
  const r = await page.evaluate(async () => await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
  }));
  total++;
  console.log('\n=== ' + label + ' ===');
  if (!r.violations.length) { console.log('  aucune violation'); return; }
  r.violations.forEach(v => {
    bad.push(label + ' / ' + v.id);
    console.log('  [' + v.impact + '] ' + v.id + ' (' + v.nodes.length + 'x) — ' + v.help);
    v.nodes.slice(0, 3).forEach(n => console.log('     ' + n.target.join(' ') + '\n       ' + n.html.slice(0, 160)));
  });
}

/* Chaque contexte a son IP : les compteurs de debit du service sont par
 * client, et sans cela deux essais lances a la suite s'epuisent
 * mutuellement le quota d'inscriptions. En production c'est nginx qui
 * impose cet en-tete, un client ne peut pas le choisir. */
let _ip = 0;
/* Tiree au sort a chaque execution, pas seulement par contexte : avec
 * une adresse fixe, deux lancements successifs du meme essai
 * s'epuiseraient mutuellement le quota d'inscriptions. */
const _reseau = '10.' + (1 + Math.floor(Math.random() * 250)) +
                 '.' + (1 + Math.floor(Math.random() * 250)) + '.';
function contexteNeuf(browser, extra) {
  _ip++;
  return browser.newContext(Object.assign({
    viewport: { width: 420, height: 900 },
    extraHTTPHeaders: { 'X-Real-IP': _reseau + ((_ip % 250) + 1) }
  }, extra || {}));
}

const attendre = async (fn, ms) => {
  const fin = Date.now() + (ms || 20000);
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* page occupée */ }
    if (Date.now() > fin) return false;
    await new Promise(r => setTimeout(r, 250));
  }
};

(async () => {
  const browser = await chromium.launch();
  const errs = [];

  for (const lang of ['fr', 'ar']) {
    const email = 'a11y-' + lang + '-' + Date.now() + '@example.com';
    const ctx = await contexteNeuf(browser);
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(lang + ': ' + e.message));

    /* Avant d'avoir un compte, ces portes s'affichent toujours dans les
       DEUX langues : il n'y a pas encore de profil dont lire la
       préférence, et c'est justement pour ça que l'application est
       bilingue. La langue se choisit ensuite, dans le profil. */
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await runAxe(page, 'Porte — creation de compte (bilingue)');

    await page.locator('#gate-login').click({ timeout: T });
    await page.waitForTimeout(350);
    await runAxe(page, 'Porte — connexion (bilingue)');

    await page.locator('#glog-forgot').click({ timeout: T });
    await page.waitForTimeout(350);
    await runAxe(page, 'Porte — mot de passe oublie (bilingue)');

    // Les ecrans atteints depuis un lien recu par courriel.
    await page.goto(BASE + '#reset=' + 'z'.repeat(43), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await runAxe(page, 'Porte — nouveau mot de passe (bilingue)');

    await page.goto(BASE + '#confirm=' + 'z'.repeat(43), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await runAxe(page, 'Porte — lien de confirmation perime (bilingue)');

    // --- Entrer pour de bon, puis auditer les feuilles ---
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.fill('#gate-name', 'Amine', { timeout: T });
    await page.fill('#gate-email', email, { timeout: T });
    await page.fill('#gate-pw', PASSWORD, { timeout: T });
    await page.fill('#gate-pw2', PASSWORD, { timeout: T });
    await page.locator('#gate-create').click({ timeout: T });

    // L'inscription mene desormais a l'attente de confirmation.
    // Chaque etape est verifiee : un `attendre` qui expire en silence
    // ferait echouer une etape suivante sans dire pourquoi.
    if (!await attendre(async () => await page.locator('#gpen-resend').isVisible())) {
      bad.push('inscription (' + lang + ')');
      console.log('  ECHEC inscription : ' +
        (await page.locator('#gate-err').innerText().catch(() => '(pas de message)')));
      await ctx.close(); continue;
    }
    await runAxe(page, 'Porte — en attente de confirmation (' + lang + ')');

    let lien = '';
    if (!await attendre(async () => {
      const r = await fetch(BASE + '__essai__/dernier-lien?genre=confirm');
      lien = (await r.json()).lien;
      return !!lien;
    })) { bad.push('aucun lien de confirmation (' + lang + ')'); await ctx.close(); continue; }

    await page.goto(lien, { waitUntil: 'domcontentloaded' });
    // La confirmation mene a l'accueil : avatar et langue. C'est le
    // premier ecran d'un compte tout neuf, il merite d'etre audite.
    if (!await attendre(async () => await page.locator('#gwel-go').isVisible())) {
      bad.push('confirmation (' + lang + ')');
      console.log('  ECHEC confirmation : ' +
        (await page.locator('#gcon-err').innerText().catch(() => '(pas de message)')));
      await ctx.close(); continue;
    }
    await runAxe(page, 'Porte — accueil, avatar et langue (' + lang + ')');
    await page.locator('#gwel-go').click({ timeout: T });
    if (!await attendre(async () => await page.locator('#profile-btn').isVisible())) {
      bad.push('entree dans l application (' + lang + ')');
      await ctx.close(); continue;
    }

    // La langue se choisit ici, dans le profil : c'est desormais le seul
    // endroit, et les feuilles doivent tenir dans les deux.
    await page.locator('#profile-btn').click({ timeout: T });
    await page.waitForTimeout(400);
    await page.locator('#sheet-box .lang-opt[data-lang="' + lang + '"]').click({ timeout: T });
    await page.waitForTimeout(600);
    // La feuille reste ouverte apres le choix de langue, et son fond
    // recouvre l'avatar : il faut la fermer avant de le recliquer.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.locator('#profile-btn').click({ timeout: T });
    await page.waitForTimeout(400);
    await runAxe(page, 'Feuille Profil, ligne compte (' + lang + ')');

    await page.locator('#prof-cloud').click({ timeout: T });
    await page.waitForTimeout(400);
    await runAxe(page, 'Compte — relie (' + lang + ')');

    await page.locator('#cloud-pw').click({ timeout: T });
    await page.waitForTimeout(400);
    await runAxe(page, 'Compte — changement de mot de passe (' + lang + ')');

    await page.locator('#sheet-close').click({ timeout: T });
    await page.waitForTimeout(400);
    await page.locator('#cloud-del').click({ timeout: T });
    await page.waitForTimeout(400);
    await runAxe(page, 'Compte — suppression (' + lang + ')');

    await ctx.close();
  }

  console.log('\nERREURS JS : ' + (errs.length ? errs.join(' | ') : 'aucune'));
  if (errs.length) bad.push('erreurs JS');

  await browser.close();
  console.log('\n' + total + ' ecrans audites, ' + bad.length + ' probleme(s)');
  if (bad.length) { bad.forEach(x => console.log('  - ' + x)); process.exit(1); }
  console.log('Tout est vert.');
})();
