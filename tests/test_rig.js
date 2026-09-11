const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'file:///tmp/wilayas/wilaya-v6.html';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.fill('#gate-name', 'Rig');
  await page.locator('.lang-opt[data-lang="fr"]').click();
  await page.locator('#gate-create').click();
  await page.waitForTimeout(500);

  // 1. les deux calques sont-ils présents et superposés ?
  const layers = await page.evaluate(() => {
    const st = document.querySelector('.mascot-stage');
    if (!st) return null;
    const bd = st.querySelector('.rig-body'), hd = st.querySelector('.rig-head');
    const rb = bd.getBoundingClientRect(), rh = hd.getBoundingClientRect();
    return {
      body: { w: Math.round(rb.width), h: Math.round(rb.height) },
      head: { w: Math.round(rh.width), h: Math.round(rh.height) },
      alignes: Math.abs(rb.x - rh.x) < 1 && Math.abs(rb.y - rh.y) < 1,
      origine: getComputedStyle(hd).transformOrigin
    };
  });
  console.log('calques :', JSON.stringify(layers));

  // 2. la tête bouge-t-elle indépendamment du corps ?
  const pairs = [];
  for (let i = 0; i < 16; i++) {
    pairs.push(await page.evaluate(() => {
      const st = document.querySelector('.mascot-stage');
      return {
        h: getComputedStyle(st.querySelector('.rig-head')).transform,
        r: getComputedStyle(st.querySelector('.mascot-rig')).transform,
        b: getComputedStyle(st.querySelector('.mascot-breathe')).transform
      };
    }));
    await page.waitForTimeout(200);
  }
  const uh = new Set(pairs.map(p => p.h)).size;
  const ub = new Set(pairs.map(p => p.b)).size;
  console.log('transformations distinctes — tête :', uh, '| respiration du corps :', ub);
  const independant = pairs.some((p, i) => i > 0 && p.h !== pairs[i - 1].h && p.b === pairs[i - 1].b);
  console.log('tête mobile alors que le corps ne bouge pas (donc indépendante) :', independant);

  // 3. pellicule : on force chaque geste et on photographie
  const stage = page.locator('.mascot-stage').first();
  const beats = [
    ['repos', null, null],
    ['regard', '.rig-head', 'beat-look'],
    ['acquiescement', '.rig-head', 'beat-nod'],
    ['inclinaison', '.rig-head', 'beat-tilt'],
    ['curiosite', '.rig-head', 'beat-perk'],
    ['saut', '.mascot-rig', 'beat-hop'],
  ];
  const shots = [];
  for (const [label, sel, cls] of beats) {
    if (cls) {
      await page.evaluate(([sel, cls]) => {
        const el = document.querySelector('.mascot-stage').querySelector(sel);
        el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      }, [sel, cls]);
      await page.waitForTimeout(cls === 'beat-hop' ? 260 : 330);
    }
    const p = `/tmp/wilayas/rig_${label}.png`;
    await stage.screenshot({ path: p });
    shots.push(p);
    if (cls) await page.evaluate(([sel, cls]) => {
      document.querySelector('.mascot-stage').querySelector(sel).classList.remove(cls);
    }, [sel, cls]);
    await page.waitForTimeout(120);
  }
  console.log('pellicule :', shots.length, 'poses');
  fs.writeFileSync('/tmp/wilayas/rig_shots.json', JSON.stringify(shots));

  console.log('ERREURS :', errs.length ? JSON.stringify(errs) : 'aucune');
  await b.close();
})();
