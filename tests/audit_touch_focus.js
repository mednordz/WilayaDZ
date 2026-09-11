const { chromium } = require('playwright');
const { seedSignedIn } = require('./seed_profile');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await seedSignedIn(page, URL, { name: 'Test', lang: 'fr' });
  await page.waitForTimeout(400);

  // Touch target sizes (WCAG 2.5.5: >= 44x44 CSS px) for all visible interactive elements
  const small = await page.evaluate(() => {
    const sel = 'button, a, input, [role="button"], [tabindex="0"]';
    const els = [...document.querySelectorAll(sel)].filter(e => {
      const r = e.getBoundingClientRect();
      const style = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    return els.map(e => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName, cls: e.className.toString().slice(0,40), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(e => e.w < 44 || e.h < 44);
  });
  console.log('Cibles < 44x44px:', small.length);
  small.slice(0, 20).forEach(s => console.log(' -', s.tag, s.cls, `${s.w}x${s.h}`));

  // Keyboard tab order sanity: tab through first 15 stops, check focus visibility (outline)
  console.log('\n--- Ordre de tabulation (15 premiers arrets) ---');
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      return {
        tag: e.tagName, id: e.id, cls: (e.className||'').toString().slice(0,30),
        outline: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow !== 'none'
      };
    });
    console.log(i+1, info);
  }

  await b.close();
})();
