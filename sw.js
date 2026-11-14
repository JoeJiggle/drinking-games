// Service Worker: App-Dateien offline verfügbar machen
// Bei jeder Änderung CACHE erhöhen (gleich wie APP_VERSION in js/version.js)
// und neue Dateien unten eintragen.
const CACHE = 'drinkinggames-v1.0.0';

const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/version.js',
  'js/db.js',
  'js/i18n.js',
  'js/router.js',
  'js/players.js',
  'js/core/random.js',
  'js/core/placeholders.js',
  'js/core/matching.js',
  'js/games/registry.js',
  'js/games/never/game.js',
  'js/ui/dom.js',
  'js/ui/shell.js',
  'js/ui/toast.js',
  'js/ui/hub.js',
  'js/ui/players-editor.js',
  'js/ui/players-view.js',
  'js/ui/settings.js',
  'js/ui/setup.js',
  'js/ui/play.js',
  'js/ui/update.js',
  'content/ui.de.json',
  'content/ui.en.json',
  'content/games/never/game.json',
  'content/games/never/cards.json',
  'content/games/never/specials.json',
  'content/games/partymix/game.json',
  'content/games/mostlikely/game.json',
  'content/games/truthordare/game.json',
];

// Fehler hier brechen die Installation nicht ab
const OPTIONAL = [
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // cache: 'reload' umgeht den HTTP-Cache, damit wirklich die neue Version geladen wird
      await cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })));
      await Promise.all(OPTIONAL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Fremde Adressen: nur Netzwerk (die App nutzt derzeit keine)
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(async (hit) => {
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === 'navigate') {
          const index = await caches.match('index.html');
          if (index) return index;
        }
        throw err;
      }
    }),
  );
});
