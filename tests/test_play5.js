const { chromium } = require('playwright');
const { seedSignedIn } = require('./seed_profile');
const fs = require('fs');
const html = fs.readFileSync('/tmp/wilayas/wilaya-v6.html', 'utf8');
const DATA = eval(html.match(/var DATA = (\[[\s\S]*?\]);/)[1].replace(/(\w+):/g, '"$1":').replace(/"(\-?\d)/g, '$1'));
const CODE = {}; DATA.forEach(w => CODE[w.n] = w.c);
const pad = n => String(n).padStart(2, '0');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::/.test(m.text())) errs.push(m.text()); });

  // keyDone part avec la graine : l'injecter apres coup puis recharger
  // ne marcherait pas, la page reecrit sa memoire vive en se dechargeant.
  await seedSignedIn(p, 'file:///tmp/wilayas/wilaya-v6.html',
                     { name: 'Test', lang: 'bi', settle: 500, data: { keyDone: true } });

  const seen = {}; let lessons = 0, q = 0;
  for (let L = 0; L < 6; L++) {
    await p.locator('#hero-card').click(); await p.waitForTimeout(300);
    if (!(await p.locator('#lesson-overlay').evaluate(e => e.classList.contains('active')))) break;
    lessons++;
    let g = 0;
    while (g++ < 40) {
      if (await p.locator('#result-heading').count()) break;
      if (await p.locator('#chain-bank').count()) {
        seen.chain = (seen.chain || 0) + 1; q++;
        const codes = await p.evaluate(() => [...document.querySelectorAll('.chain-chip')]
          .map(c => +c.getAttribute('data-code')).sort((a, b) => a - b));
        for (const c of codes) { await p.locator(`.chain-chip[data-code="${c}"]`).click(); await p.waitForTimeout(80); }
      } else if (await p.locator('#lesson-type-input').count()) {
        seen.type = (seen.type || 0) + 1; q++;
        const nm = await p.locator('#lesson-prompt-focus .bf').first().innerText();
        await p.fill('#lesson-type-input', pad(CODE[nm.trim()] || 0));
        await p.click('#lesson-type-submit');
      } else if (await p.locator('.lesson-choice').count()) {
        const lbl = (await p.locator('.lesson-prompt-label .bf').innerText()).toLowerCase();
        const k = lbl.includes('bloc') ? 'block' : lbl.includes('séparent') ? 'gap'
                : lbl.includes('juste') ? 'neighbor' : lbl.includes('quelle wilaya') ? 'c2n' : 'n2c';
        seen[k] = (seen[k] || 0) + 1; q++;
        await p.locator('.lesson-choice[data-correct="1"]').first().click();
      } else break;
      await p.waitForTimeout(130);
      if (await p.locator('#lesson-continue-btn').count()) await p.locator('#lesson-continue-btn').click();
      await p.waitForTimeout(130);
    }
    const res = (await p.locator('#result-heading').innerText()).replace(/\n/g, ' | ');
    const stats = (await p.locator('.result-stats').innerText()).replace(/\n/g, ' ');
    console.log(`Leçon ${lessons}: ${res} | ${stats}`);
    await p.locator('#result-close').click(); await p.waitForTimeout(300);
  }
  console.log('\nTypes rencontrés:', JSON.stringify(seen), '| questions:', q);
  const st = await p.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('wilaya-account-v1'));
    const pr = a.profiles[0];
    const boxes = {}; Object.values(pr.data.progress).forEach(r => boxes[r.box] = (boxes[r.box] || 0) + 1);
    return { xp: pr.data.xp, couronnes: pr.data.crowns, boxes, suivies: Object.keys(pr.data.progress).length };
  });
  console.log('Profil:', JSON.stringify(st));
  console.log('Nœuds:', await p.evaluate(() => [...document.querySelectorAll('.noeud')].map(n => n.disabled ? 'X' : 'O').join('')));
  console.log('ERREURS:', errs.length ? errs.join(' | ') : 'aucune');
  await b.close();
})();
