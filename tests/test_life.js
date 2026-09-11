const { chromium } = require('playwright');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.fill('#gate-name', 'Vie');
  await page.locator('.lang-opt[data-lang="fr"]').click();
  await page.locator('#gate-create').click();
  await page.waitForTimeout(500);

  // 1. la mascotte respire-t-elle ? on échantillonne la matrice de transformation
  const samples = [];
  for (let i = 0; i < 14; i++) {
    const t = await page.evaluate(() => {
      const el = document.querySelector('.mascot');
      return el ? getComputedStyle(el).transform : null;
    });
    samples.push(t);
    await page.waitForTimeout(220);
  }
  const uniq = [...new Set(samples.filter(Boolean))];
  console.log('transformations distinctes sur ~3 s :', uniq.length);
  console.log('  exemples :', uniq.slice(0, 3).join('  |  '));

  // 2. l'ombre au sol est-elle présente et dimensionnée ?
  const shadow = await page.evaluate(() => {
    const s = document.querySelector('.mascot-shadow');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(s).backgroundColor };
  });
  console.log('ombre :', JSON.stringify(shadow));

  // 3. les micro-gestes se déclenchent-ils ?
  let beats = 0;
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const cls = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.mascot').forEach(m => {
        m.classList.forEach(c => { if (c.startsWith('beat-')) out.push(c); });
      });
      return out;
    });
    cls.forEach(c => { seen.add(c); beats++; });
    await page.waitForTimeout(250);
  }
  console.log('micro-gestes observés sur ~10 s :', beats, '| variétés :', [...seen].join(', ') || 'aucune');

  // 4. chaque instance a-t-elle son propre décalage ?
  const delays = await page.evaluate(() =>
    [...document.querySelectorAll('.mascot')].map(m => m.style.animationDelay + '/' + m.style.animationDuration));
  console.log('décalages par instance :', JSON.stringify(delays));

  console.log('ERREURS :', errs.length ? JSON.stringify(errs) : 'aucune');
  await b.close();
})();
