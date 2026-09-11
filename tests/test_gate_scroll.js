/*
 * La porte d'entree doit rester entierement atteignable.
 *
 * Le piege : `.gate` est un conteneur flex qui defile. Avec
 * `align-items:center`, un formulaire plus haut que l'ecran deborde des
 * DEUX cotes — et un conteneur defilant ne peut pas remonter au-dessus
 * de zero. Le haut du formulaire devient alors definitivement
 * inatteignable : ni la marque, ni le titre, ni meme le premier champ.
 *
 * Ca se voyait deja sur un telephone ordinaire, et ca devenait bloquant
 * des l'ouverture du clavier, qui reduit la zone visible a ~350 px.
 *
 * Depuis que le compte est obligatoire, ces ecrans sont les PREMIERS que
 * voit qui que ce soit : un formulaire dont on ne peut pas atteindre le
 * premier champ, c'est une application qu'on ne peut pas utiliser.
 *
 *   node tests/test_gate_scroll.js
 */
const { chromium } = require('playwright');
const { seedAccount } = require('./seed_profile');

const URL = 'file:///tmp/wilayas/wilaya-v6.html';

let checks = 0;
const failures = [];
function check(label, ok, detail) {
  checks++;
  if (ok) console.log('  ok   ' + label);
  else { console.log('  FAIL ' + label + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); failures.push(label); }
}

/* Mesure ce qui compte vraiment : le haut du contenu est-il au-dessus de
 * la zone (donc perdu), et peut-on descendre jusqu'au bout ? */
const mesure = (page) => page.evaluate(() => {
  const g = document.getElementById('gate');
  const b = document.getElementById('gate-box');
  if (!g || !b) return null;
  const avant = g.scrollTop;
  g.scrollTop = 0;
  const haut = b.getBoundingClientRect().top - g.getBoundingClientRect().top;
  g.scrollTop = 1e6;
  const bas = g.scrollTop;
  g.scrollTop = avant;
  return {
    haut: Math.round(haut),
    scrollMax: Math.round(g.scrollHeight - g.clientHeight),
    scrollAtteint: Math.round(bas),
    debordeEnHauteur: g.scrollHeight > g.clientHeight
  };
});

/* Le premier element focalisable du formulaire est-il atteignable ? */
const premierChampVisible = (page, sel) => page.evaluate((sel) => {
  const g = document.getElementById('gate');
  const i = document.querySelector(sel);
  if (!i) return null;
  g.scrollTop = 0;
  const r = i.getBoundingClientRect(), gr = g.getBoundingClientRect();
  return r.top >= gr.top && r.bottom <= gr.bottom + g.scrollHeight;
}, sel);

/* Chaque porte, avec le champ qui doit rester joignable. */
const PORTES = [
  { nom: 'creation de compte', ouvrir: async () => {}, champ: '#gate-name' },
  { nom: 'connexion', champ: '#glog-email',
    ouvrir: async (p) => { await p.locator('#gate-login').click(); await p.waitForTimeout(300); } },
  { nom: 'mot de passe oublie', champ: '#gfor-email',
    ouvrir: async (p) => {
      await p.locator('#gate-login').click(); await p.waitForTimeout(250);
      await p.locator('#glog-forgot').click(); await p.waitForTimeout(300);
    } },
];

/* Des tailles reelles. Les deux dernieres sont des claviers ouverts :
 * c'est la que tout se joue. */
const TAILLES = [
  { nom: 'iPhone 15',           w: 393, h: 852 },
  { nom: 'petit Android',       w: 360, h: 640 },
  { nom: 'clavier ouvert',      w: 390, h: 360 },
  { nom: 'clavier + petit ecran', w: 360, h: 290 },
];

(async () => {
  const browser = await chromium.launch();
  const errs = [];

  for (const taille of TAILLES) {
    console.log('\n=== ' + taille.nom + ' (' + taille.w + 'x' + taille.h + ') ===');
    for (const porte of PORTES) {
      const ctx = await browser.newContext({ viewport: { width: taille.w, height: taille.h } });
      const page = await ctx.newPage();
      page.on('pageerror', e => errs.push(e.message));

      await seedAccount(page, URL, { profiles: [], activeId: null }, 600);
      await porte.ouvrir(page);

      const m = await mesure(page);
      const etiquette = porte.nom + ' — ';
      check(etiquette + 'rien n\'est coupe en haut', m && m.haut >= 0, m);
      check(etiquette + 'on descend jusqu\'au bout',
            m && m.scrollAtteint === m.scrollMax, m);
      check(etiquette + 'le premier champ est atteignable',
            (await premierChampVisible(page, porte.champ)) === true);

      await ctx.close();
    }
  }

  /* Quand le contenu TIENT dans l'ecran, il doit rester centre : le
     correctif ne doit pas coller les portes courtes en haut. */
  console.log('\n=== centrage quand le contenu tient (390x900) ===');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await seedAccount(page, URL, { profiles: [], activeId: null }, 600);
  await page.locator('#gate-login').click(); await page.waitForTimeout(350);
  const centre = await page.evaluate(() => {
    const g = document.getElementById('gate');
    const b = document.getElementById('gate-box');
    const gr = g.getBoundingClientRect(), br = b.getBoundingClientRect();
    return {
      deborde: g.scrollHeight > g.clientHeight,
      dessus: Math.round(br.top - gr.top),
      dessous: Math.round(gr.bottom - br.bottom)
    };
  });
  check('la porte courte ne deborde pas', centre.deborde === false, centre);
  check('elle reste centree verticalement',
        Math.abs(centre.dessus - centre.dessous) <= 2, centre);
  await ctx.close();

  console.log('\nERREURS JS : ' + (errs.length ? errs.join(' | ') : 'aucune'));
  if (errs.length) failures.push('erreurs JS');

  await browser.close();
  console.log('\n' + checks + ' verifications, ' + failures.length + ' echec(s)');
  if (failures.length) { failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('Tout est vert.');
})();
