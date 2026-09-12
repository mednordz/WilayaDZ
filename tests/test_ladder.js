const { chromium } = require('playwright');
const { seedSignedIn } = require('./seed_profile');

/* Depuis que le compte est obligatoire, la progression ne se pose plus
   dans `wilaya-progress-v4` : elle vit dans le profil, sous
   `wilaya-account-v1`. On sème donc un appareil deja connecte. */
const assert=require('assert'),path=require('path');
const URL = 'file://'+path.resolve(__dirname,'../app/wilaya-v6.html');
const prog4 = {};
for (let c = 11; c <= 18; c++) prog4[c] = { box: 4, due: 0, seen: 9, ok: 9, best: 2000 };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  // Toutes les wilayas 11-18 en boîte 4 => l'échelle doit passer en saisie libre
  await seedSignedIn(p, URL, { settle: 600, data: {
    keyDone: true, progress: prog4, confusions: {}, crowns: { u1:1, u2:2 },
    xp: 100, streak: { count: 1, last: null } } });

  await p.locator('.noeud').nth(1).click(); await p.locator(await p.locator('#sheet-train').count()?'#sheet-train':'#sheet-start').click(); await p.waitForTimeout(300);
  let type = 0, mcq = 0, chain = 0;
  for (let i = 0; i < 14; i++) {
    if (await p.locator('#result-heading').count()) break;
    if (await p.locator('#lesson-type-input').count()) { type++; await p.fill('#lesson-type-input', '99'); await p.click('#lesson-type-submit'); }
    else if (await p.locator('#chain-bank').count()) { chain++; let n = await p.locator('.chain-chip:not(.used)').count(); while (n--) { await p.locator('.chain-chip:not(.used)').nth(0).click(); await p.waitForTimeout(70); } }
    else if (await p.locator('.lesson-choice').count()) { mcq++; await p.locator('.lesson-choice').nth(0).click(); }
    else break;
    await p.waitForTimeout(120);
    if (await p.locator('#lesson-continue-btn').count()) await p.locator('#lesson-continue-btn').click();
    await p.waitForTimeout(120);
  }
  console.log('Boîte 4 => saisie libre:', type, '| QCM:', mcq, '| chaîne:', chain);

  // Une réponse lente reste correcte et bénéficie du premier intervalle.
  await seedSignedIn(p, URL, { settle: 600, data: {
    keyDone: true, progress: {}, confusions: {}, crowns: {u1:1}, xp: 0,
    streak: { count: 0, last: null } } });
  await p.locator('.noeud').nth(1).click(); await p.locator(await p.locator('#sheet-train').count()?'#sheet-train':'#sheet-start').click(); await p.waitForTimeout(250);

  const correct = p.locator('.lesson-choice[data-correct="1"]');
  assert.equal(await correct.count(),1,'Une réponse correcte doit être disponible');
  await p.waitForTimeout(5500);
  await correct.click();
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('wilaya-account-v1')).profiles[0].data.progress);
  assert(Object.keys(saved).length>0,'La réponse doit être enregistrée');
  assert(Object.values(saved).every(r=>r.box===1),'Une première réponse lente doit être reconnue comme correcte');
  assert(type>0,'La boîte 4 doit produire de la saisie libre');
  assert.deepEqual(errs,[]);
  console.log('Saisie libre en boîte 4 et réponse juste lente reconnue : validées');
  console.log('ERREURS:', errs.length ? errs.join('|') : 'aucune');
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
