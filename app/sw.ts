import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, NetworkFirst, CacheFirst, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const SW_VERSION = '2026-05-10-network-first-nav';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,    // activate new SW immediately on install
  clientsClaim: true,   // take control of all open tabs immediately
  navigationPreload: true,
  runtimeCaching: [
    // ── Navigation (HTML pages) — NetworkFirst ────────────────────────
    // Always try the network first so the page gets the latest killswitch
    // version and new JS references. Falls back to cache when offline so
    // the app works without internet.
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'prism-navigation',
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 24 * 60 * 60 }),
        ],
      }),
    },
    // ── Static Next.js assets — CacheFirst (content-hashed filenames) ─
    // These have immutable cache headers and content hashes in their
    // filenames, so CacheFirst is safe and gives the fastest repeat loads.
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'prism-static',
        plugins: [
          new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        ],
      }),
    },
    // ── Everything else — use the Serwist defaults ────────────────────
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// On activate: wipe all runtime caches from the previous SW so stale
// entries don't bleed through. Static assets will be re-fetched and
// re-cached with the new content-hashed filenames on the next load.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
  );
});

console.log(`[sw] ${SW_VERSION} activated`);
