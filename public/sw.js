/*
 * Service Worker SmartDownload — v1
 *
 * Strategie de cache (volontairement conservatrice pour ne jamais casser
 * les mises a jour du site) :
 *  - Navigation (pages HTML)      : reseau d'abord -> cache en secours -> offline.html
 *  - Assets immuables /_next/static et icones : cache d'abord (ils sont hashees par Next.js)
 *  - Routes /api/*                : JAMAIS mises en cache (stats pub, telechargements)
 *  - Scripts pub tiers            : jamais mis en cache
 *
 * Mises a jour : skipWaiting + clients.claim() + caches versionnes purges a
 * l'activation -> une nouvelle version du site est toujours servie des que
 * disponible, jamais bloquee par un ancien cache.
 */

const VERSION = 'smartdownload-v1';
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // GET et meme origine uniquement — jamais d'API, jamais de POST, jamais de script pub tiers.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Pages : reseau d'abord, cache en secours, puis page hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Assets immuables (hashes par Next.js) + icones : cache d'abord.
  const cacheable =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';

  if (cacheable) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
