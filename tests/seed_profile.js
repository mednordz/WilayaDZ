/*
 * Partir d'un appareil deja connecte.
 *
 * Depuis que le compte est obligatoire, on ne peut plus creer un profil
 * par la porte d'entree sans joindre le service de comptes — ce que les
 * tests qui tournent en file:// ne peuvent pas faire, et ne doivent
 * surtout pas essayer : ils taperaient sur la production.
 *
 * Ce module fait donc deux choses, et les deux comptent :
 *   1. il coupe tout appel vers /api/ au niveau du navigateur, pour
 *      qu'aucun test ne puisse joindre un vrai serveur par accident ;
 *   2. il ecrit dans localStorage un etat de comptes complet, dans la
 *      forme exacte que l'application y met elle-meme.
 *
 * ATTENTION — l'ordre des rechargements n'est pas decoratif. En se
 * dechargeant, une page qui a un profil actif rattache ecrit sa memoire
 * vive par-dessus localStorage (cloudFlushNow sur visibilitychange).
 * Ecrire puis recharger sans precaution ferait donc disparaitre ce
 * qu'on vient d'ecrire. On vide d'abord, on recharge pour que
 * l'application reparte SANS aucun profil en memoire, et seulement
 * ensuite on seme : plus rien ne peut alors ecraser la graine.
 */

const BLANK = {
  progress: {}, confusions: {}, crowns: {}, xp: 0,
  streak: { count: 0, last: null }, keyDone: false, bestBlitz: 0
};

/* Un profil tel que l'application l'ecrit apres une inscription. */
function signedInProfile(opts) {
  opts = opts || {};
  return {
    id: opts.id || 'pseed1',
    name: opts.name || 'Amine',
    salt: 'seedsalt', pin: opts.pin || null,
    lang: opts.lang || 'bi',
    color: opts.color || 0,
    created: 1757000000000, lastSeen: 1757000000000,
    cloud: {
      email: opts.email || 'amine@example.com',
      name: opts.name || 'Amine',
      token: 'jetondetestquinesertaaucunserveur00000000',
      version: 1, lastSync: 1757000000000, lastError: null
    },
    data: Object.assign({}, BLANK, opts.data || {})
  };
}

/* Seme un etat de comptes complet, puis laisse l'application demarrer
   dessus. `account` est l'objet range sous wilaya-account-v1. */
async function seedAccount(page, url, account, settle) {
  await page.route('**/api/**', route => route.abort());
  await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });

  // Empecher la page de reecrire localStorage en se dechargeant.
  // L'application sauvegarde sa memoire vive sur « visibilitychange »
  // (cloudFlushNow), ce qui est exactement ce qu'on veut en vrai — et
  // exactement ce qui rend impossible de semer un etat par-dessus une
  // page deja demarree : le rechargement restaure l'ancien juste apres.
  // Un ecouteur en phase de capture s'execute avant celui de
  // l'application et l'empeche de s'executer du tout.
  await page.evaluate(() => {
    document.addEventListener('visibilitychange',
                              (e) => e.stopImmediatePropagation(), true);
  });

  await page.evaluate((a) => {
    localStorage.clear();
    localStorage.setItem('wilaya-account-v1', JSON.stringify(a));
  }, account);
  await page.reload({ timeout: 20000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(settle || 500);
}

async function seedSignedIn(page, url, opts) {
  opts = opts || {};
  const p = signedInProfile(opts);
  await seedAccount(page, url, { profiles: [p], activeId: p.id }, opts.settle);
}

module.exports = { seedSignedIn, seedAccount, signedInProfile, BLANK };
