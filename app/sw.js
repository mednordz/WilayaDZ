// Service worker — WilayaDZ
//
// L'app entière tient dans UN SEUL fichier HTML autonome (tout est en
// base64 inline : polices, images des mascottes — voir PROJECT_NOTES.md).
// Il n'y a donc qu'un seul document à mettre en cache, lui-même : pas de
// liste d'assets à énumérer ni à tenir à jour.
//
// Stratégie "stale-while-revalidate" : on sert depuis le cache tout de
// suite (l'app s'ouvre hors-ligne dès la deuxième visite, sans attendre
// le réseau), puis on revérifie en tâche de fond et on met à jour le
// cache pour la prochaine visite. Une modification de l'app se voit donc
// au chargement SUIVANT, jamais en repoussant celui en cours.
// Le numéro change quand la règle de mise en cache change, pas quand
// l'app change : « activate » purge alors tout ce qu'une version
// précédente aurait pu ranger sous d'autres règles.
const CACHE = "wilaya-shell-v3";

// Comptes et synchronisation : jamais de cache, jamais de rejeu. Ces
// réponses portent la progression du compte et dépendent d'un en-tête
// Authorization ; les servir depuis le cache renverrait un état périmé
// en boucle, et les y ranger laisserait des données de compte derrière
// soi après une déconnexion.
// Deux prefixes echappent au cache, pour deux raisons opposees.
//
// `/api/` : ces reponses portent la progression du compte et dependent
// d'un en-tete Authorization ; les servir depuis le cache renverrait un
// etat perime en boucle, et les y ranger laisserait des donnees de
// compte derriere soi apres une deconnexion.
//
// `/media/` : la musique de fond fait une quinzaine de mega-octets et se
// lit en FLUX. Y toucher casserait tout : la Cache API exige un corps
// entier, donc le service worker telechargerait les 40 minutes avant la
// premiere note, ferait exploser le quota de stockage, et surtout
// avalerait les requetes Range dont la lecture audio depend pour
// avancer dans la piste.
const NO_CACHE_PREFIX = ["/api/", "/media/"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(self.registration.scope, { cache: "reload" })))
      // Une pré-mise en cache ratée (mauvais chemin de déploiement,
      // req réseau qui échoue) ne doit jamais faire échouer l'install :
      // le fetch handler ci-dessous mettra en cache au premier passage.
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Uniquement les lectures same-origin : jamais d'appel réseau externe
  // de toute façon (voir plus haut), mais le garde-fou reste explicite.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Laisser passer sans y toucher : pas de respondWith du tout, donc le
  // navigateur les traite comme si ce service worker n'existait pas.
  const chemin = new URL(req.url).pathname;
  if (NO_CACHE_PREFIX.some((p) => chemin.startsWith(p))) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((fresh) => {
            if (fresh && fresh.ok) cache.put(req, fresh.clone());
            return fresh;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
