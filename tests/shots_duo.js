const { chromium } = require('playwright');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.fill('#gate-name', 'Yasmine');
  await page.locator('.lang-opt[data-lang="fr"]').click();
  await page.locator('#gate-create').click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/wilayas/duo_path.png' });

  // Zoom on topbar to check sound button
  const topbar = page.locator('.topbar');
  await topbar.screenshot({ path: '/tmp/wilayas/duo_topbar.png' });

  // Complete "La Clé" quickly? Skip -> start unit 1 lesson directly isn't possible until key done.
  // Instead force keyDone via localStorage to reach the path with colored units, then start a lesson.
  await page.evaluate(() => {
    const acc = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    acc.profiles[0].data.keyDone = true;
    localStorage.setItem('wilaya-account-v1', JSON.stringify(acc));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
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
