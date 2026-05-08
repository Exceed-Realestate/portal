/* ========================================================================
   service-worker.js — Exceed Portal PWA (development-friendly mode)

   Strategy: pass-through. The SW is registered so the portal qualifies
   as an installable PWA (home-screen icon, splash screen, full-screen
   chrome) but it does NOT cache responses. Every fetch goes to the
   network. This means a deploy is visible after one normal refresh —
   no more "I pushed but Safari shows the old version".

   When the team's flow stabilises and we want offline-ish loads, flip
   this back to a precache strategy and bump CACHE_VERSION to invalidate.
   ======================================================================== */

const CACHE_VERSION = 'v5-2026-05-08-passthrough';

self.addEventListener('install', (event) => {
  // Don't precache anything. Just activate immediately so the new SW
  // takes over from any older cached version still resident on the
  // user's device.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Wipe ALL existing caches from previous SW versions — anything that
  // was holding stale shell HTML / CSS / JS gets purged in one shot.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass through. Don't intercept, don't cache. Browser HTTP cache +
  // GitHub Pages cache headers handle freshness on their own.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
