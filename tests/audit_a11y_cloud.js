/*
 * Accessibilite des ecrans de compte.
 *
 * audit_a11y.js couvre l'application en file:// ; ces ecrans-la n'y
 * apparaissent jamais, puisqu'ils n'existent qu'avec une origine http.
 * Ils sont pourtant les seuls a comporter de vrais formulaires — c'est
 * exactement ce qu'un lecteur d'ecran a le plus de mal a traverser.
 *
 *   python3 tests/serve_test.py 8390 &
 *   node tests/audit_a11y_cloud.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:8390/';
const axeSrc = fs.readFileSync('/tmp/wilayas/node_modules/axe-core/axe.min.js', 'utf8');
const EMAIL = 'a11y-' + Date.now() + '@example.com';
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

(async () => {
  const browser = await chromium.launch();
  const errs = [];

  for (const lang of ['fr', 'ar']) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(lang + ': ' + e.message));

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Porte d'entree : connexion sur un appareil neuf.
    await page.locator('#gate-login').click({ timeout: T });
    await page.waitForTimeout(350);
    await runAxe(page, 'Porte d entree — connexion (' + lang + ')');

    // Retour, puis creation d'un profil local pour atteindre les feuilles.
    await page.locator('#gate-back').click({ timeout: T });
    await page.waitForTimeout(300);
    await page.fill('#gate-name', 'Amine', { timeout: T });
    await page.locator('.lang-opt[data-lang="' + lang + '"]').click({ timeout: T });
    await page.locator('#gate-create').click({ timeout: T });
    await page.waitForTimeout(600);

    await page.locator('#profile-btn').click({ timeout: T });
    await page.waitForTimeout(400);
    await runAxe(page, 'Feuille Profil, ligne compte (' + lang + ')');

    await page.locator('#prof-cloud').click({ timeout: T });
    await page.waitForTimeout(400);
    await runAxe(page, 'Compte — non relie (' + lang + ')');

    await page.locator('#cloud-go-register').click({ timeout: T });
    await page.waitForTimeout(400);
    await runAxe(page, 'Compte — creation (' + lang + ')');

    if (lang === 'fr') {
      await page.fill('#creg-email', EMAIL, { timeout: T });
      await page.fill('#creg-pw', PASSWORD, { timeout: T });
      await page.locator('#creg-go').click({ timeout: T });
      await page.waitForTimeout(2500);
      await runAxe(page, 'Compte — relie (fr)');

      await page.locator('#cloud-pw').click({ timeout: T });
      await page.waitForTimeout(400);
      await runAxe(page, 'Compte — changement de mot de passe (fr)');

      await page.locator('#sheet-close').click({ timeout: T });
      await page.waitForTimeout(400);
      await page.locator('#cloud-del').click({ timeout: T });
      await page.waitForTimeout(400);
      await runAxe(page, 'Compte — suppression (fr)');
    } else {
      await page.locator('#sheet-close').click({ timeout: T });
      await page.waitForTimeout(300);
      await page.locator('#cloud-go-login').click({ timeout: T });
      await page.waitForTimeout(400);
      await runAxe(page, 'Compte — connexion (ar)');
    }

    await ctx.close();
  }

  console.log('\nERREURS JS : ' + (errs.length ? errs.join(' | ') : 'aucune'));
  if (errs.length) bad.push('erreurs JS');

  await browser.close();
  console.log('\n' + total + ' ecrans audites, ' + bad.length + ' probleme(s)');
  if (bad.length) { bad.forEach(x => console.log('  - ' + x)); process.exit(1); }
  console.log('Tout est vert.');
})();
