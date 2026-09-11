const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';
const axeSrc = fs.readFileSync('/tmp/wilayas/node_modules/axe-core/axe.min.js', 'utf8');
const T = 8000;

async function setupProfile(page, name, lang) {
  await page.goto(URL, { timeout: 20000, waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ timeout: 20000, waitUntil: 'domcontentloaded' });
  await page.fill('#gate-name', name, { timeout: T });
  await page.locator(`.lang-opt[data-lang="${lang}"]`).click({ timeout: T });
  await page.locator('#gate-create').click({ timeout: T });
  await page.waitForTimeout(400);
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
      await page.locator('.node-info').first().click({ force: true, timeout: T });
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
      await page.locator('.node').nth(1).click({ force: true, timeout: T });
      await page.waitForTimeout(400);
      await runAxe(page, `Lecon MCQ (${lang})`, results);
    } catch (e) { console.log('lesson step failed:', e.message); }

    await ctx.close();
  }

  fs.writeFileSync('/tmp/wilayas/axe_results.json', JSON.stringify(results, null, 2));
  await b.close();
  console.log('\nDONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
