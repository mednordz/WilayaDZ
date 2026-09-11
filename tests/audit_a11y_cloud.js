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
const axeSrc = fs.readFileSync('/tmp/wilayas/node_modules/axe-core/axe.min.js', 'utf8');
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
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(lang + ': ' + e.message));

    // --- Les trois portes que l'on peut rencontrer sans compte ---
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.locator('.lang-opt[data-lang="' + lang + '"]').click({ timeout: T });
    await page.waitForTimeout(250);
    await runAxe(page, 'Porte — creation de compte (' + lang + ')');

    await page.locator('#gate-login').click({ timeout: T });
    await page.waitForTimeout(350);
    await runAxe(page, 'Porte — connexion (' + lang + ')');

    await page.locator('#glog-forgot').click({ timeout: T });
    await page.waitForTimeout(350);
    await runAxe(page, 'Porte — mot de passe oublie (' + lang + ')');

    // Les ecrans atteints depuis un lien recu par courriel.
    await page.goto(BASE + '#reset=' + 'z'.repeat(43), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await runAxe(page, 'Porte — nouveau mot de passe (' + lang + ')');

    await page.goto(BASE + '#confirm=' + 'z'.repeat(43), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await runAxe(page, 'Porte — lien de confirmation perime (' + lang + ')');

    // --- Entrer pour de bon, puis auditer les feuilles ---
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.fill('#gate-name', 'Amine', { timeout: T });
    await page.fill('#gate-email', email, { timeout: T });
    await page.fill('#gate-pw', PASSWORD, { timeout: T });
    await page.locator('.lang-opt[data-lang="' + lang + '"]').click({ timeout: T });
    await page.locator('#gate-create').click({ timeout: T });

    // L'inscription mene desormais a l'attente de confirmation.
    await attendre(async () => await page.locator('#gpen-resend').isVisible());
    await runAxe(page, 'Porte — en attente de confirmation (' + lang + ')');

    let lien = '';
    await attendre(async () => {
      const r = await fetch(BASE + '__essai__/dernier-lien?genre=confirm');
      lien = (await r.json()).lien;
      return !!lien;
    });
    await page.goto(lien, { waitUntil: 'domcontentloaded' });
    await attendre(async () => await page.locator('#profile-btn').isVisible());

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
