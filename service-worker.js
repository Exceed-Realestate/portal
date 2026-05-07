/* ========================================================================
   service-worker.js — Exceed Portal PWA
   Strategy:
     - HTML pages: network-first, fall back to cache, fall back to offline
     - Static assets (CSS, JS, images, fonts, logo): cache-first with
       background revalidation
     - Firebase / Google APIs: pass-through (never cached) so auth, Firestore
       and Calendar stay live
   Bump CACHE_VERSION on every deploy with breaking shell changes.
   ======================================================================== */

const CACHE_VERSION = 'v2-2026-05-07-cards';
const SHELL_CACHE   = `exceed-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `exceed-runtime-${CACHE_VERSION}`;

/* Always-cached app shell — fetched immediately on install. */
const SHELL = [
  './',
  './index.html',
  './agent.html',
  './liquid.css',
  './theme-init.js',
  './firebase-init.js',
  './logo.jpg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './manifest.webmanifest'
];

/* Hosts whose responses we never cache — these change too fast or are
   security-sensitive (Firebase Auth, Firestore, Google APIs). */
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
  'apis.google.com',
  'fcm.googleapis.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept live Firebase / Google API traffic.
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  // HTML / navigation — network first, then cache, then fallback.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./agent.html'))
        )
    );
    return;
  }

  // Same-origin static assets — cache-first with background refresh.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
    return;
  }

  // Cross-origin (fonts, jsPDF, Firebase SDK) — stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

/* When the page sends a {type:'SKIP_WAITING'} message, activate the new
   worker immediately (no need to close every tab). Used by pwa-init.js. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
