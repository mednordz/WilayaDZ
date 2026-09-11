const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///tmp/wilayas/wilaya-v4.html');
  await p.waitForTimeout(300);

  // Toutes les wilayas 1-10 en boîte 4 => l'échelle doit passer en saisie libre
  await p.evaluate(() => {
    const prog = {};
    for (let c = 1; c <= 10; c++) prog[c] = { box: 4, due: 0, seen: 9, ok: 9, best: 2000 };
    localStorage.setItem('wilaya-progress-v4', JSON.stringify({
      keyDone: true, progress: prog, confusions: {}, crowns: { u1: 2 }, xp: 100, streak: { count: 1, last: null }
    }));
  });
  await p.reload(); await p.waitForTimeout(400);

  await p.locator('.node').nth(1).click(); await p.waitForTimeout(300);
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

  // Fluence : bonne réponse LENTE ne doit pas promouvoir
  await p.goto('file:///tmp/wilayas/wilaya-v4.html'); await p.waitForTimeout(300);
  await p.evaluate(() => localStorage.setItem('wilaya-progress-v4', JSON.stringify({
    keyDone: true, progress: {}, confusions: {}, crowns: {}, xp: 0, streak: { count: 0, last: null } })));
  await p.reload(); await p.waitForTimeout(400);
  await p.locator('.node').nth(1).click(); await p.waitForTimeout(250);

  const promptName = await p.locator('#lesson-prompt-focus').innerText();
  const label = await p.locator('.lesson-prompt-label').innerText();
  await p.waitForTimeout(6500);                       // > 5 s => réponse lente
  const opts = await p.locator('.lesson-choice').allInnerTexts();
  // on clique la bonne réponse en la déduisant
  const html = require('fs').readFileSync('/tmp/wilayas/wilaya-v4.html', 'utf8');
  const DATA = eval(html.match(/var DATA = (\[[\s\S]*?\]);/)[1].replace(/(\w+):/g, '"$1":').replace(/"(\-?\d)/g, '$1'));
  const N = {}, C = {}; DATA.forEach(w => { N[w.c] = w.n; C[w.n] = w.c; });
  const pad = n => String(n).padStart(2, '0');
  let want = label.toLowerCase().includes('quelle wilaya') ? N[parseInt(promptName, 10)] : pad(C[promptName.split('\n')[0].trim()]);
  const idx = opts.map(s => s.trim()).indexOf(want);
  if (idx >= 0) {
    await p.locator('.lesson-choice').nth(idx).click();
    await p.waitForTimeout(250);
    const noteTxt = await p.locator('.lesson-footer-note').count() ? await p.locator('.lesson-footer-note').innerText() : '(aucune)';
    console.log('Réponse juste mais lente → message:', noteTxt.trim());
    const box = await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('wilaya-progress-v4'));
      return s.progress;
    });
    console.log('Boîtes après réponse lente:', JSON.stringify(box));
  } else console.log('bonne option introuvable, test sauté');

  console.log('ERREURS:', errs.length ? errs.join('|') : 'aucune');
  await b.close();
})();
