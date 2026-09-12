const { chromium } = require('playwright');
const { seedSignedIn, seedAccount, signedInProfile } = require('./seed_profile');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';
const log = (...a) => console.log(...a);

async function mk(page, name, lang) {
  await seedSignedIn(page, URL, { name: name, lang: lang, settle: 500 });
}

(async () => {
  const b = await chromium.launch();
  const errs = [];

  for (const [lang, label] of [['fr', 'FRANÇAIS'], ['ar', 'ARABE'], ['bi', 'LES DEUX']]) {
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(lang + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/net::/.test(m.text())) errs.push(lang + ': ' + m.text()); });

    log(`\n########## MODE ${label} ##########`);
    await mk(page, 'Test' + lang, lang);

    const root = await page.evaluate(() => ({
      dataLang: document.documentElement.getAttribute('data-lang'),
      dir: document.documentElement.getAttribute('dir'),
      lang: document.documentElement.getAttribute('lang')
    }));
    log('racine:', JSON.stringify(root));

    log('titre page:', (await page.locator('.banner-text h1').innerText()).replace(/\n/g, ' | '));
    log('hero:', (await page.locator('.hero-title').innerText()).replace(/\n/g, ' | '));
    log('onglets:', (await page.locator('.tabbar-inner').innerText()).replace(/\n/g, ' / '));

    // chrome masqué correctement ?
    const vis = await page.evaluate(() => {
      const shown = sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).length;
      return {
        chromeFrVisible: shown('.bi:not(.bi-keep) > .bf'),
        chromeArVisible: shown('.bi:not(.bi-keep) > .ba'),
        contenuFrVisible: shown('.bi-keep > .bf'),
        contenuArVisible: shown('.bi-keep > .ba')
      };
    });
    log('visibilité:', JSON.stringify(vis));

    // le contenu (noms de wilayas) doit rester bilingue dans TOUS les modes
    await page.locator('#hero-card').click(); await page.waitForTimeout(400);
    await page.locator('#tell-next').click(); await page.waitForTimeout(2100);
    log('blocs:', await page.locator('#key-strip .block-row.on').count(), '— 1er bloc:',
        (await page.locator('#key-strip .block-row').nth(1).innerText()).replace(/\n/g, ' | ').slice(0, 70));
    await page.locator('#tell-next').click(); await page.waitForTimeout(300);
    log('question:', (await page.locator('.lesson-prompt-label').innerText()).replace(/\n/g, ' | '));
    log('NOM DE WILAYA (doit être bilingue partout):', (await page.locator('#lesson-prompt-focus').innerText()).replace(/\n/g, ' | '));

    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    if (await page.locator('#confirm-ok').count()) {
      log('confirmation:', (await page.locator('#confirm-msg').innerText()).replace(/\n/g, ' | ').slice(0, 70));
      await page.locator('#confirm-ok').click(); await page.waitForTimeout(400);
    }

    await page.click('button[data-tab="practice"]'); await page.waitForTimeout(300);
    log('cartes:', (await page.locator('#act-blitz').innerText()).replace(/\n/g, ' | ').slice(0, 60));
    log('prévision:', (await page.locator('.forecast-row').nth(1).innerText()).replace(/\n/g, ' | '));

    await page.click('button[data-tab="info"]'); await page.waitForTimeout(300);
    log('boussole carte:', await page.evaluate(() => [...document.querySelectorAll('#map-compass text')].map(t => t.textContent).join(' / ')));
    log('en-têtes registre:', (await page.locator('#ledger-table thead').innerText()).replace(/\n/g, ' | '));
    log('1re ligne registre:', (await page.locator('#ledger-body tr').nth(1).innerText()).replace(/\n/g, ' | '));

    // débordement horizontal ?
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log('débordement horizontal (px):', ovf);

    await page.screenshot({ path: `v6_${lang}_info.png` });
    await page.click('button[data-tab="path"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: `v6_${lang}_path.png` });
    await ctx.close();
  }

  // changement de langue à chaud
  log('\n########## CHANGEMENT DE LANGUE À CHAUD ##########');
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('switch: ' + e.message));
  await mk(page, 'Switch', 'fr');
  log('avant:', await page.evaluate(() => document.documentElement.getAttribute('data-lang')),
      '|', (await page.locator('.hero-title').innerText()).replace(/\n/g, ' '));
  await page.locator('#profile-btn').click(); await page.waitForTimeout(350);
  log('sélecteur présent dans la feuille:', await page.locator('#sheet-box .lang-opt').count());
  await page.locator('#sheet-box .lang-opt[data-lang="ar"]').click(); await page.waitForTimeout(600);
  log('après:', await page.evaluate(() => document.documentElement.getAttribute('data-lang')),
      '| dir:', await page.evaluate(() => document.documentElement.getAttribute('dir')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  log('hero en arabe:', (await page.locator('.hero-title').innerText()).replace(/\n/g, ' '));
  const persisted = await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    return a.profiles.find(x => x.id === a.activeId).lang;
  });
  log('langue enregistrée sur le profil:', persisted);
  await page.reload(); await page.waitForTimeout(500);
  log('après rechargement:', await page.evaluate(() => document.documentElement.getAttribute('data-lang')));

  // Deux profils, deux langues. On ne peut plus en creer un second hors
  // ligne depuis que le compte est obligatoire : les deux sont semes
  // d'un coup, puis on bascule comme le ferait l'utilisateur.
  await seedAccount(page, URL, {
    profiles: [
      signedInProfile({ id: 'pseed1', name: 'Switch', lang: 'ar', email: 'switch@example.com' }),
      signedInProfile({ id: 'pseed2', name: 'Yacine', lang: 'fr', email: 'yacine@example.com', color: 1 })
    ],
    activeId: 'pseed1'
  }, 600);
  await page.locator('#profile-btn').click(); await page.waitForTimeout(400);
  await page.locator(".profile-row[data-id='pseed2']").click(); await page.waitForTimeout(700);
  log('profil 2 (fr):', await page.evaluate(() => document.documentElement.getAttribute('data-lang')));
  const both = await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    return a.profiles.map(p => p.name + '=' + p.lang);
  });
  log('les deux profils:', JSON.stringify(both));

  log('\nERREURS:', errs.length ? errs.join('\n') : 'aucune');
  await b.close();
})();
