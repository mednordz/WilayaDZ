const { chromium } = require('playwright');
const { seedAccount, signedInProfile } = require('./seed_profile');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  let xssFired = false;
  await page.exposeFunction('__xssProbe', () => { xssFired = true; });

  // Les deux profils sont semes d'un coup, aucun actif : c'est
  // exactement l'etat « appareil partage, personne n'a encore choisi »
  // que showGate("pick") doit rendre. Les injecter APRES le demarrage
  // ne marcherait pas : en se dechargeant, la page reecrit localStorage
  // depuis sa memoire vive et effacerait l'injection.
  const payload = 'X" onmouseover="window.__xssProbe && window.__xssProbe()" data-x="';
  await seedAccount(page, URL, {
    profiles: [
      signedInProfile({ id: 'sain', name: 'Amel', lang: 'fr', email: 'amel@example.com' }),
      signedInProfile({ id: 'evil', name: payload, lang: 'fr', email: 'evil@example.com', color: 1 })
    ],
    activeId: null
  });

  // Le nom vient d'un profil recu par code de transfert : il est
  // entierement controle par celui qui l'envoie.
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
