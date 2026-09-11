const { chromium } = require('playwright');
const { seedSignedIn } = require('./seed_profile');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

  await seedSignedIn(page, URL, { name: 'Yasmine', lang: 'fr', data: { keyDone: true } });
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/wilayas/duo_path.png' });

  // Zoom on topbar to check sound button
  const topbar = page.locator('.topbar');
  await topbar.screenshot({ path: '/tmp/wilayas/duo_topbar.png' });

  // Complete "La Clé" quickly? Skip -> start unit 1 lesson directly isn't possible until key done.
  // Instead force keyDone via localStorage to reach the path with colored units, then start a lesson.
  // keyDone part avec la graine (voir seed_profile.js) : l'injecter
  // apres coup puis recharger ne tiendrait pas, la page reecrit sa
  // memoire vive en se dechargeant.
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/wilayas/duo_path_units.png' });

  // Start first unit lesson
  await page.locator('.node.current').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/wilayas/duo_lesson_start.png' });

  // Answer several questions correctly to trigger combo popup (pick correct answer each time via data-correct)
  for (let i = 0; i < 5; i++) {
    const correctBtn = page.locator('[data-correct="1"]').first();
    const hasChoice = await correctBtn.count();
    if (hasChoice) {
      await correctBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(150);
      if (i === 2) await page.screenshot({ path: '/tmp/wilayas/duo_combo.png' }); // after 3rd correct, combo pop may show
      const cont = page.locator('#lesson-continue-btn');
      if (await cont.count()) { await cont.click({ force: true }); await page.waitForTimeout(250); }
    } else {
      // type-in exercise: skip by finding submit disabled or type input
      const typeInput = page.locator('#lesson-type-input');
      if (await typeInput.count()) {
        // can't easily know answer here in test harness; just leave it, continue button may not exist
      }
      break;
    }
  }

  await page.screenshot({ path: '/tmp/wilayas/duo_lesson_footer.png' });

  console.log('ERRORS:', errs.length ? JSON.stringify(errs, null, 2) : 'none');
  await b.close();
})();
