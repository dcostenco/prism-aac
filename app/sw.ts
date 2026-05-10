import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// Force-invalidation marker — bumped 2026-05-08 after 6 stale-bundle
// reports where users heard chipmunk pitch from cached pre-fix JS
// (the 0.5+webRate rate-conversion code from commit 06c04f5). The
// Serwist precacheEntries hash already invalidates on file change,
// but this constant in the SW source forces the SW itself to be
// reinstalled so clients get a fresh activate event + clientsClaim
// takeover. If pitch / no-audio regressions return, bump this again.
const SW_VERSION = '2026-05-10-category-ui-v2';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Activate handler: clear ALL Cache Storage entries on activate so
// the new SW serves fresh content from the network instead of any
// stale runtime caches the prior SW left behind.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
  );
});

// Tagging the version so DevTools → Application → Service Workers
// shows the bump and operators can confirm clients picked up the
// new SW.
console.log(`[sw] activated ${SW_VERSION}`);
