const { chromium } = require('playwright');
const { seedSignedIn } = require('./seed_profile');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await seedSignedIn(p, 'file:///tmp/wilayas/wilaya-v6.html', { name: 'Amine', lang: 'ar', settle: 600 });

  console.log('marque:', (await p.locator('.brand').innerText()).trim());
  console.log('badge Clé:', (await p.locator('#cle-badge').innerText()).replace(/\n/g,' '));
  console.log('nœud unité:', (await p.locator('.noeud').nth(0).innerText()).trim());
  console.log('plages:', (await p.locator('.noeud').allInnerTexts()).slice(0,4).map(s=>String(s||'').trim()).join(' / '));
  console.log('hero:', (await p.locator('.hero-title').innerText()).replace(/\n/g,' '));

  await p.locator('.etape-corps').nth(0).click(); await p.waitForTimeout(350);
  console.log('feuille titre:', (await p.locator('#sheet-title').innerText()).trim());
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);

  // question bloc : la plage doit rester visible en mode arabe
  await p.locator('#hero-card').click(); await p.waitForTimeout(400);
  await p.locator('#tell-next').click(); await p.waitForTimeout(2100);
  await p.locator('#tell-next').click(); await p.waitForTimeout(400);
  console.log('options bloc (arabe):', (await p.locator('.lesson-choice').allInnerTexts()).map(s=>s.trim().replace(/\s+/g,' ')).join(' | '));
  console.log('ERREURS:', errs.length ? errs.join('|') : 'aucune');
  await p.screenshot({ path: '/tmp/wilayas/v6_ar_fixed.png' });
  await b.close();
})();
