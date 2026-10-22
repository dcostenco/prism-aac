import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, NetworkFirst, CacheFirst, NetworkOnly, ExpirationPlugin } from 'serwist';
import { PRISM_AAC_BASE_PATH, PRISM_AAC_STATIC_PATH, PRISM_AAC_OFFLINE_NAVIGATION_HEADER } from '@/lib/appPaths';
import { PICTURE_PACK_API_PATH } from '@/lib/pictogramSources';
import { AAC_PRECACHE_PREFIX, AAC_BUILD_REPORT, AAC_BUILD_REQUEST, AAC_BUILD_ID, isAacUrl, retireUnusedPrecache } from '@/lib/offlinePrecacheRetention';
import { handleCanonicalNavigation } from '@/lib/offlineNavigationState';
import { hasDurablePicturePack } from '@/lib/durablePicturePack';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const SW_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
const AAC_IDENTITY_PATH = /\/api\/v1\/prism-aac\/(?:billing|session)(?:\/|$)/;
const currentPrecache = AAC_PRECACHE_PREFIX + SW_VERSION;
const precacheEntries = self.__SW_MANIFEST;
const currentStaticPrecacheAssets = (precacheEntries ?? []).flatMap(entry => {
  const value = typeof entry === 'string' ? entry : entry.url;
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && url.pathname.startsWith(PRISM_AAC_STATIC_PATH) ? [url.href] : [];
  } catch { return []; }
});
const clientBuilds = new Map<string, string>();
let retirement = Promise.resolve();

function retireOldBuilds(): Promise<void> {
  retirement = retirement.then(async () => {
    const clients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(client => isAacUrl(client.url, self.location.origin));
    const activeIds = new Set(clients.map(client => client.id));
    for (const id of clientBuilds.keys()) if (!activeIds.has(id)) clientBuilds.delete(id);
    for (const client of clients) if (!clientBuilds.has(client.id)) client.postMessage({ type: AAC_BUILD_REQUEST });
    await retireUnusedPrecache(caches, self.location.origin, currentPrecache,
      clients.map(client => clientBuilds.get(client.id) ?? null), hasDurablePicturePack, self.navigator?.locks);
  }).catch(error => { console.warn('[service-worker] old builds retained:', error); });
  return retirement;
}

const serwist = new Serwist({
  precacheEntries,
  // Older documents may still reference their immutable chunks while offline.
  precacheOptions: { cacheName: currentPrecache, cleanupOutdatedCaches: false },
  skipWaiting: true,    // activate new SW immediately on install
  clientsClaim: true,   // take control of all open tabs immediately
  navigationPreload: true,
  runtimeCaching: [
    // Identity must come from the server, never a previous account's API cache.
    // Match both the canonical portal URL and the standalone app's rewrite.
    {
      matcher: ({ url }) => AAC_IDENTITY_PATH.test(url.pathname),
      handler: new NetworkOnly(),
    },
    // Access grants and partial chunks never replace the complete offline pack.
    {
      matcher: ({ url }) => url.pathname.includes(PICTURE_PACK_API_PATH),
      handler: new NetworkOnly(),
    },
    // Keep one canonical app document regardless of launch query parameters.
    // Online navigation refreshes it; time spent offline must not expire it.
    {
      matcher: ({ request, url }) => url.origin === self.location.origin
        && (url.pathname === PRISM_AAC_BASE_PATH || url.pathname === `${PRISM_AAC_BASE_PATH}/`)
        && (request.mode === 'navigate' || request.headers.get(PRISM_AAC_OFFLINE_NAVIGATION_HEADER) === '1'),
      handler: {
        handle: async ({ event, request }) => {
          const canonicalUrl = self.location.origin + PRISM_AAC_BASE_PATH;
          const result = await handleCanonicalNavigation({
            request,
            canonicalUrl,
            precacheName: currentPrecache,
            precacheAssets: currentStaticPrecacheAssets,
            storage: caches,
            locks: self.navigator?.locks,
            fetchResponse: async networkRequest => {
              const preloadResponse = 'preloadResponse' in event
                ? await (event as FetchEvent).preloadResponse
                : undefined;
              return preloadResponse ?? fetch(networkRequest);
            },
            reportState: state => {
              if (!('clientId' in event)) return;
              const id = (event as FetchEvent).clientId || (event as FetchEvent).resultingClientId;
              if (!id) return;
              event.waitUntil(self.clients.get(id).then(client => {
                if (client && isAacUrl(client.url, self.location.origin)) {
                  client.postMessage({ type: 'aac-offline-navigation-state', buildId: SW_VERSION, ...state });
                }
              }).catch(() => { console.warn('[service-worker] navigation state delivery unavailable'); }));
            },
          });
          if (result.stored) event.waitUntil(retireOldBuilds());
          return result.response;
        },
      },
    },
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
      matcher: ({ url }) => url.pathname.startsWith(PRISM_AAC_STATIC_PATH),
      handler: new CacheFirst({
        cacheName: 'prism-static',
        plugins: [
          { cachedResponseWillBeUsed: async ({ request, cachedResponse }) => cachedResponse
            ?? await caches.match(request, { ignoreSearch: true }) ?? null },
          new ExpirationPlugin({ maxEntries: 256 }),
        ],
      }),
    },
    // ── Everything else — use the Serwist defaults ────────────────────
    ...defaultCache,
  ],
});

serwist.addEventListeners();

self.addEventListener('message', event => {
  const source = event.source;
  if (event.data?.type !== AAC_BUILD_REPORT || typeof event.data?.buildId !== 'string' || !AAC_BUILD_ID.test(event.data.buildId)
    || !source || !('id' in source) || !('url' in source) || !isAacUrl(source.url, self.location.origin)) return;
  clientBuilds.set(source.id, event.data.buildId);
  event.waitUntil(retireOldBuilds());
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    for (const client of clients) if (isAacUrl(client.url, self.location.origin)) client.postMessage({ type: AAC_BUILD_REQUEST });
  }));
});

// Activation must not delete the only working document or installed pictures.
// Content-hashed assets can serve older cached documents during an update.

if (process.env.NODE_ENV !== 'production') console.log(`[sw] ${SW_VERSION} activated`);
