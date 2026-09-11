const { chromium } = require('playwright');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  let xssFired = false;
  await page.exposeFunction('__xssProbe', () => { xssFired = true; });

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Create profile #1: normal
  await page.fill('#gate-name', 'Amel');
  await page.locator('.lang-opt[data-lang="fr"]').click();
  await page.locator('#gate-create').click();
  await page.waitForTimeout(400);

  // Inject a malicious second profile directly into localStorage, simulating
  // a profile that arrived via an imported sync code (transfer code) with an
  // attacker-controlled name, then reload so the "pick a profile" screen renders it.
  const payload = 'X" onmouseover="window.__xssProbe && window.__xssProbe()" data-x="';
  await page.evaluate((payload) => {
    const acc = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    const clone = JSON.parse(JSON.stringify(acc.profiles[0]));
    clone.id = 'evil-' + Date.now();
    clone.name = payload;
    acc.profiles.push(clone);
    // Simulate the ordinary "shared device, nobody picked yet" state that
    // showGate("pick") is designed for: two profiles exist, none active.
    acc.activeId = null;
    localStorage.setItem('wilaya-account-v1', JSON.stringify(acc));
  }, payload);

  // Force the "pick" gate to render (simulate switching profiles from the profile sheet,
  // which calls showGate("pick") and rebuilds gate.innerHTML from account.profiles)
  await page.reload();
  await page.waitForTimeout(400);
  const hasGateName = await page.locator('#gate-name').count();
  if (hasGateName) {
    // only one profile existed at boot before injection; now two -> should show pick list
    console.log('Still on create screen, forcing pick via localStorage activeId trick not needed, reload should show pick list since 2 profiles now exist and none is active by pin-less default... checking DOM');
  }
  const html = await page.evaluate(() => document.getElementById('gate') ? document.getElementById('gate').innerHTML.length : -1);
  console.log('gate innerHTML length:', html);

  // Try to find the injected button and hover it to trigger onmouseover
  const evilBtn = page.locator('button.gate-profile[data-x]');
  const count = await evilBtn.count().catch(() => 0);
  console.log('evil button matched by injected attribute selector:', count);

  if (count > 0) {
    await evilBtn.hover({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  } else {
    // dump the gate HTML around the second profile to inspect manually
    const raw = await page.evaluate(() => {
      const g = document.getElementById('gate');
      return g ? g.innerHTML.slice(0, 4000) : 'NO GATE';
    });
    console.log('--- gate.innerHTML (first 4000 chars) ---');
    console.log(raw);
  }

  console.log('XSS FIRED:', xssFired);
  await b.close();
})();
