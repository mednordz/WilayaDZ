const { chromium } = require('playwright');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();

  // Arabic / RTL, light
  let ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  let page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.fill('#gate-name', 'سارة');
  await page.locator('.lang-opt[data-lang="ar"]').click();
  await page.locator('#gate-create').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const acc = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    acc.profiles[0].data.keyDone = true;
    localStorage.setItem('wilaya-account-v1', JSON.stringify(acc));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/wilayas/duo_ar_path.png' });
  await ctx.close();

  // Dark mode, French
  ctx = await b.newContext({ viewport: { width: 420, height: 900 }, colorScheme: 'dark' });
  page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.fill('#gate-name', 'Karim');
  await page.locator('.lang-opt[data-lang="fr"]').click();
  await page.locator('#gate-create').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const acc = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    acc.profiles[0].data.keyDone = true;
    localStorage.setItem('wilaya-account-v1', JSON.stringify(acc));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/wilayas/duo_dark_path.png' });
  await ctx.close();

  await b.close();
})();
