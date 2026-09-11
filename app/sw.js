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
const CACHE = "wilaya-shell-v2";

// Comptes et synchronisation : jamais de cache, jamais de rejeu. Ces
// réponses portent la progression du compte et dépendent d'un en-tête
// Authorization ; les servir depuis le cache renverrait un état périmé
// en boucle, et les y ranger laisserait des données de compte derrière
// soi après une déconnexion.
const NO_CACHE_PREFIX = "/api/";

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
  // Laisser passer l'API sans y toucher : pas de respondWith du tout,
  // donc le navigateur la traite comme si ce service worker n'existait pas.
  if (new URL(req.url).pathname.startsWith(NO_CACHE_PREFIX)) return;

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
