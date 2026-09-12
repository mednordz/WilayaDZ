const { chromium } = require('playwright');
const { seedSignedIn } = require('./seed_profile');
const fs = require('fs');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';
const axeSrc = fs.readFileSync('/tmp/wilayas/node_modules/axe-core/axe.min.js', 'utf8');
const T = 8000;

/* Un profil DEJA EN ROUTE, et non un profil vierge : sur un profil
   vierge la moitie de l'ecran d'accueil n'existe pas (jauges, etats des
   unites, invitation a mettre une photo) et l'audit passait a cote. */
const EN_ROUTE = (() => {
  const d = { keyDone: true, xp: 298, streak: { count: 1, last: null },
              crowns: { u1: 5, u2: 3 }, progress: {}, confusions: {} };
  for (let c = 1; c <= 10; c++) d.progress[c] = { box: 5, due: 0, seen: 9, ok: 9, best: 1 };
  for (let c = 11; c <= 18; c++) d.progress[c] = { box: 3, due: 0, seen: 6, ok: 5, best: 1 };
  return d;
})();

async function setupProfile(page, name, lang) {
  await seedSignedIn(page, URL, { name: name, lang: lang, settle: 400, data: EN_ROUTE });
}

async function runAxe(page, label, results) {
  try {
    await page.addScriptTag({ content: axeSrc, timeout: T });
    const r = await Promise.race([
      page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('axe timeout')), 15000))
    ]);
    const violations = r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')),
      summaries: v.nodes.slice(0, 3).map(n => n.failureSummary),
      html: v.nodes.slice(0, 3).map(n => n.html)
    }));
    results.push({ label, violations });
    console.log(`\n=== ${label} ===`);
    if (!violations.length) console.log('  aucune violation');
    violations.forEach(v => console.log(`  [${v.impact}] ${v.id} (${v.nodes}x) — ${v.help}\n    ex: ${v.targets.join(' | ')}`));
  } catch (e) {
    console.log(`\n=== ${label} === SCAN FAILED: ${e.message}`);
    results.push({ label, error: e.message });
  }
}

(async () => {
  const b = await chromium.launch();
  const results = [];

  for (const lang of ['fr', 'ar']) {
    console.log(`\n########## LANG ${lang} ##########`);
    const ctx = await b.newContext({ viewport: { width: 400, height: 850 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(T);

    await setupProfile(page, 'Test', lang);
    await runAxe(page, `Parcours (${lang})`, results);

    try {
      await page.locator('.etape-corps').first().click({ force: true, timeout: T });
      await page.waitForTimeout(300);
      await runAxe(page, `Feuille info noeud (${lang})`, results);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (e) { console.log('node-sheet step failed:', e.message); }

    try {
      await page.locator('.tab-btn').nth(1).click({ force: true, timeout: T });
      await page.waitForTimeout(300);
      await runAxe(page, `Entrainement (${lang})`, results);
    } catch (e) { console.log('practice-tab step failed:', e.message); }

    try {
      await page.locator('.tab-btn').nth(2).click({ force: true, timeout: T });
      await page.waitForTimeout(300);
      await runAxe(page, `Infos (${lang})`, results);
    } catch (e) { console.log('info-tab step failed:', e.message); }

    try {
      await page.locator('.tab-btn').first().click({ force: true, timeout: T });
      await page.waitForTimeout(200);
      await page.locator('.noeud').nth(1).click({ force: true, timeout: T });
      await page.waitForTimeout(400);
      await runAxe(page, `Lecon MCQ (${lang})`, results);
    } catch (e) { console.log('lesson step failed:', e.message); }

    await ctx.close();
  }

  fs.writeFileSync('/tmp/wilayas/axe_results.json', JSON.stringify(results, null, 2));
  await b.close();
  console.log('\nDONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
