const { chromium } = require('playwright');
const { seedSignedIn } = require('./seed_profile');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();

  // Arabic / RTL, light
  let ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  let page = await ctx.newPage();
  await seedSignedIn(page, URL, { name: 'سارة', lang: 'ar', data: { keyDone: true } });
  await page.waitForTimeout(400);
  // keyDone part avec la graine (voir seed_profile.js) : l'injecter
  // apres coup puis recharger ne tiendrait pas, la page reecrit sa
  // memoire vive en se dechargeant.
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/wilayas/duo_ar_path.png' });
  await ctx.close();

  // Dark mode, French
  ctx = await b.newContext({ viewport: { width: 420, height: 900 }, colorScheme: 'dark' });
  page = await ctx.newPage();
  await seedSignedIn(page, URL, { name: 'Karim', lang: 'fr', data: { keyDone: true } });
  await page.waitForTimeout(400);
  // keyDone part avec la graine (voir seed_profile.js) : l'injecter
  // apres coup puis recharger ne tiendrait pas, la page reecrit sa
  // memoire vive en se dechargeant.
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/wilayas/duo_dark_path.png' });
  await ctx.close();

  await b.close();
})();
