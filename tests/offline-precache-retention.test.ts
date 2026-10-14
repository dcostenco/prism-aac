// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { AAC_PRECACHE_PREFIX, AAC_LEGACY_AAC_PRECACHE_PREFIX, AAC_CORE_NAVIGATION_CACHE, retireUnusedPrecache, isAacUrl } from '../lib/offlinePrecacheRetention';
import { AAC_OFFLINE_NAVIGATION_LOCK, handleCanonicalNavigation, type OfflineNavigationLocks } from '../lib/offlineNavigationState';

const ORIGIN = 'https://aac.example.test';
const APP = ORIGIN + '/prism-aac';
const asset = (build: string) => `${APP}/_next/static/chunks/webpack-${build}.js`;
const html = (build: string) => `<html><script src="${asset(build)}"></script></html>`;
const name = (build: string) => AAC_PRECACHE_PREFIX + build;

function fixture(builds: string[], documentBuild: string | null = builds.at(-1)!) {
  const stores = new Map<string, Map<string, string>>();
  for (const build of builds) stores.set(name(build), new Map([[asset(build), 'chunk']]));
  stores.set('serwist-precache-another-app', new Map([[ORIGIN + '/portal/chunk.js', 'other app']]));
  stores.set('synalux-pp-precache-v1', new Map([[ORIGIN + '/patient-portal', 'patient']]));
  if (documentBuild !== null) stores.set(AAC_CORE_NAVIGATION_CACHE, new Map([[APP, html(documentBuild)]]));
  const remove = vi.fn(async (key: string) => stores.delete(key));
  let tail = Promise.resolve();
  const locks: OfflineNavigationLocks = {
    request: vi.fn((_name, _options, callback) => {
      const operation = tail.then(() => callback({ name:AAC_OFFLINE_NAVIGATION_LOCK, mode:'exclusive' } as Lock));
      tail = operation.then(() => undefined, () => undefined);
      return operation;
    }) as OfflineNavigationLocks['request'],
  };
  const storage = {
    keys: async () => [...stores.keys()], delete: remove,
    match: async (request: string | Request, options?: CacheQueryOptions) => {
      const cacheName = options?.cacheName;
      const key = typeof request === 'string' ? request : request.url;
      const entries = cacheName ? stores.get(cacheName) : null;
      const value = entries?.get(key);
      return value === undefined ? undefined : new Response(value);
    },
    open: async (key: string) => {
      let entries = stores.get(key);
      if (!entries) { entries = new Map(); stores.set(key, entries); }
      return {
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        match: async (url: string) => entries.has(url) ? new Response(entries.get(url)) : undefined,
        put: async (url: string | Request, response: Response) => entries.set(typeof url === 'string' ? url : url.url, await response.text()),
      };
    },
  } as unknown as CacheStorage;
  return { stores, storage, remove, locks };
}

describe('safe AAC precache retirement', () => {
  it('retires successive old builds once the current document and clients use the current build', async () => {
    const { stores, storage, locks } = fixture(['one']);
    for (const build of ['two', 'three', 'four']) {
      stores.set(name(build), new Map([[asset(build), 'chunk']]));
      stores.get(AAC_CORE_NAVIGATION_CACHE)!.set(APP, html(build));
      await retireUnusedPrecache(storage, ORIGIN, name(build), [build, build], async () => true, locks);
      expect([...stores.keys()].filter(key => key.startsWith(AAC_PRECACHE_PREFIX))).toEqual([name(build)]);
    }
    expect(stores.has('serwist-precache-another-app')).toBe(true);
    expect(stores.has('synalux-pp-precache-v1')).toBe(true);
  });

  it('keeps the old document usable when its replacement cannot be fetched', async () => {
    const { stores, storage, locks } = fixture(['one', 'two', 'three'], 'one');
    expect(await retireUnusedPrecache(storage, ORIGIN, name('three'), ['three'], async () => true, locks)).toEqual([name('two')]);
    expect(stores.has(name('one'))).toBe(true);
    expect(stores.has(name('three'))).toBe(true);
  });

  it('preserves older open-tab builds until those tabs update', async () => {
    const { stores, storage, locks } = fixture(['one', 'two', 'three']);
    expect(await retireUnusedPrecache(storage, ORIGIN, name('three'), ['one', 'three'], async () => true, locks)).toEqual([name('two')]);
    expect(stores.has(name('one'))).toBe(true);
  });

  it('prefers the current cache when obsolete builds contain the same document assets', async () => {
    const { stores, storage, locks } = fixture(['one', 'two']);
    stores.set(name('old-copy'), new Map([[asset('two'), 'same immutable chunk']]));
    await retireUnusedPrecache(storage, ORIGIN, name('two'), ['two'], async () => true, locks);
    expect(stores.has(name('old-copy'))).toBe(false);
  });

  it('retains caches for unreported or unidentifiable open clients', async () => {
    const { remove, storage, locks } = fixture(['one', 'two']);
    expect(await retireUnusedPrecache(storage, ORIGIN, name('two'), [null], async () => true, locks)).toEqual([]);
    expect(await retireUnusedPrecache(storage, ORIGIN, name('two'), ['unidentified'], async () => true, locks)).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([null, 'unavailable'])('retains all old builds without a complete usable cached document: %s', async documentBuild => {
    const { remove, storage, locks } = fixture(['one', 'two'], documentBuild);
    await retireUnusedPrecache(storage, ORIGIN, name('two'), ['two'], async () => true, locks);
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps legacy pictures under storage pressure until the approved pack becomes durable', async () => {
    const { stores, storage, locks } = fixture(['one', 'two']);
    const legacy = 'serwist-precache-legacy-pictures';
    stores.set(legacy, new Map([[`${APP}/symbols/cw-in.png?__WB_REVISION__=old`, 'legacy image']]));
    await retireUnusedPrecache(storage, ORIGIN, name('two'), ['two'], async () => false, locks);
    expect(stores.has(legacy)).toBe(true);
    await retireUnusedPrecache(storage, ORIGIN, name('two'), ['two'], async () => true, locks);
    expect(stores.has(legacy)).toBe(false);
  });

  it('preserves old cached data when the replacement worker has not completed installation', async () => {
    const { remove, storage } = fixture(['one']);
    await retireUnusedPrecache(storage, ORIGIN, name('two'), ['two'], async () => true);
    expect(remove).not.toHaveBeenCalled();
  });

  it('retains old caches when cross-worker Web Locks are unavailable', async () => {
    const { remove, storage } = fixture(['one', 'two']);
    expect(await retireUnusedPrecache(storage, ORIGIN, name('two'), ['two'], async () => true)).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not let a delayed old document overwrite the canonical document after retirement deletes its build', async () => {
    const { stores, storage, locks } = fixture(['a', 'b'], 'b');
    let releaseNetwork!: (response: Response) => void;
    const pending = handleCanonicalNavigation({
      request: new Request(`${APP}?launch=old`), canonicalUrl:APP,
      precacheName:name('a'), storage, locks,
      fetchResponse:() => new Promise(resolve => { releaseNetwork = resolve; }),
      timeoutMs:1_000,
    });
    await Promise.resolve();
    expect(await retireUnusedPrecache(storage, ORIGIN, name('b'), ['b'], async () => true, locks)).toEqual([name('a')]);
    releaseNetwork(new Response(html('a'), { headers:{'content-type':'text/html; charset=utf-8'} }));
    const result = await pending;
    expect(result.stored).toBe(false);
    expect(await result.response.text()).toBe(html('b'));
    expect(stores.has(name('a'))).toBe(false);
    expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('b'));
  });

  it('keeps the previous working document when a replacement graph is incomplete', async () => {
    const { stores, storage, locks } = fixture(['old', 'new'], 'old');
    stores.set(name('new'), new Map());
    const result = await handleCanonicalNavigation({
      request:new Request(`${APP}?v=new`), canonicalUrl:APP,
      precacheName:name('new'), storage, locks,
      fetchResponse:async () => new Response(html('new'), {headers:{'content-type':'text/html'}}),
    });
    expect(result.stored).toBe(false);
    expect(await result.response.text()).toBe(html('old'));
    expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('old'));
  });

  it('reports the retained graph without exposing asset query parameters', async () => {
    const { stores, storage, locks } = fixture(['old', 'new'], 'old');
    stores.set(name('new'), new Map());
    const reportState = vi.fn();
    const replacement = `<html><script src="${asset('new')}?private-query=value"></script></html>`;
    const result = await handleCanonicalNavigation({
      request:new Request(APP), canonicalUrl:APP, precacheName:name('new'), storage, locks, reportState,
      fetchResponse:async () => new Response(replacement, { headers:{'content-type':'text/html'} }),
    });
    expect(await result.response.text()).toBe(html('old'));
    expect(reportState).toHaveBeenCalledWith({ outcome:'incomplete-static', precacheName:name('new'),
      requiredCount:1, missingAssets:[new URL(asset('new')).pathname] });
  });

  it('diagnostic delivery cannot interrupt a complete app document save', async () => {
    const { stores, storage, locks } = fixture(['new']);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await handleCanonicalNavigation({
        request:new Request(APP), canonicalUrl:APP, precacheName:name('new'), storage, locks,
        reportState:() => { throw new Error('delivery unavailable'); },
        fetchResponse:async () => new Response(html('new'), { headers:{'content-type':'text/html'} }),
      });
      expect(result.stored).toBe(true);
      expect(await result.response.text()).toBe(html('new'));
      expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('new'));
    } finally { warning.mockRestore(); }
  });

  it.each(['prism-core-navigation', 'prism-navigation'])('reads the pre-v2 saved document from %s without creating or changing caches', async legacyName => {
    const { stores, storage } = fixture(['legacy'], null);
    stores.set(legacyName, new Map([[APP, html('legacy')]]));
    const beforeNames = [...stores.keys()];
    const result = await handleCanonicalNavigation({
      request: new Request(`${APP}?offline=1`), canonicalUrl: APP,
      precacheName: name('new'), storage,
      fetchResponse: async () => { throw new Error('offline'); },
    });
    expect(await result.response.text()).toBe(html('legacy'));
    expect(result.stored).toBe(false);
    expect([...stores.keys()]).toEqual(beforeNames);
    expect(stores.get(legacyName)?.get(APP)).toBe(html('legacy'));
  });

  it('serves a legacy saved document when a network replacement graph is incomplete and no v2 document exists', async () => {
    const { stores, storage } = fixture(['new'], null);
    stores.get(name('new'))!.clear();
    stores.set('prism-core-navigation', new Map([[APP, html('legacy')]]));
    const result = await handleCanonicalNavigation({
      request: new Request(`${APP}?version=new`), canonicalUrl: APP,
      precacheName: name('new'), storage,
      fetchResponse: async () => new Response(html('new'), { headers: { 'content-type': 'text/html' } }),
    });
    expect(result.stored).toBe(false);
    expect(await result.response.text()).toBe(html('legacy'));
    expect(stores.has(AAC_CORE_NAVIGATION_CACHE)).toBe(false);
    expect(stores.get('prism-core-navigation')?.get(APP)).toBe(html('legacy'));
  });

  it('keeps late unlocked v1 navigation and precache writes outside v2 retirement', async () => {
    const { stores, storage, locks } = fixture(['old', 'new'], null);
    const oldV1Cache = AAC_LEGACY_AAC_PRECACHE_PREFIX + 'old';
    stores.set(oldV1Cache, new Map([[asset('old'), 'old v1 chunk']]));
    const saved = await handleCanonicalNavigation({
      request: new Request(`${APP}?version=new`), canonicalUrl: APP,
      precacheName: name('new'), storage, locks,
      fetchResponse: async () => new Response(html('new'), { headers: { 'content-type': 'text/html' } }),
    });
    expect(saved.stored).toBe(true);

    // A pre-v2 worker cannot participate in the new lock queue.
    stores.set('prism-core-navigation', new Map([[APP, html('old')]]));
    const removed = await retireUnusedPrecache(storage, ORIGIN, name('new'), ['new'], async () => true, locks);
    expect(removed).toContain(name('old'));
    expect(removed).not.toContain(oldV1Cache);
    expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('new'));
    expect(stores.get('prism-core-navigation')?.get(APP)).toBe(html('old'));
    expect(stores.has(oldV1Cache)).toBe(true);

    const offline = await handleCanonicalNavigation({
      request: new Request(`${APP}?offline=1`), canonicalUrl: APP,
      precacheName: name('new'), storage, locks,
      fetchResponse: async () => { throw new Error('offline'); },
    });
    expect(await offline.response.text()).toBe(html('new'));
  });

  it('requires the entire worker static precache graph, including assets not linked directly in the document', async () => {
    const { stores, storage, locks } = fixture(['old', 'new'], 'old');
    const result = await handleCanonicalNavigation({
      request:new Request(`${APP}?v=new`), canonicalUrl:APP,
      precacheName:name('new'), precacheAssets:[asset('lazy')], storage, locks,
      fetchResponse:async () => new Response(html('new'), {headers:{'content-type':'text/html'}}),
    });
    expect(result.stored).toBe(false);
    expect(await result.response.text()).toBe(html('old'));
    expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('old'));
  });

  it('stores a replacement only after every document asset is present in its precache', async () => {
    const { stores, storage, locks } = fixture(['old', 'new'], 'old');
    const result = await handleCanonicalNavigation({
      request:new Request(`${APP}?v=new`), canonicalUrl:APP,
      precacheName:name('new'), storage, locks,
      fetchResponse:async () => new Response(html('new'), {headers:{'content-type':'text/html; charset=utf-8'}}),
    });
    expect(result.stored).toBe(true);
    expect(await result.response.text()).toBe(html('new'));
    expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('new'));
  });

  it('can save a first working offline document without locks while retaining every old graph', async () => {
    const { stores, storage, remove } = fixture(['old', 'new'], 'old');
    stores.get(AAC_CORE_NAVIGATION_CACHE)!.clear();
    const result = await handleCanonicalNavigation({ request:new Request(APP), canonicalUrl:APP,
      precacheName:name('new'), storage,
      fetchResponse:async () => new Response(html('new'), {headers:{'content-type':'text/html'}}) });
    expect(result.stored).toBe(true);
    expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('new'));
    expect(await retireUnusedPrecache(storage, ORIGIN, name('new'), ['new'], async () => true)).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps a valid online response usable when offline storage or locking is unavailable', async () => {
    const { storage } = fixture(['new'], 'new');
    const unavailable = { ...storage, open:async () => { throw new Error('storage unavailable'); } } as CacheStorage;
    const result = await handleCanonicalNavigation({ request:new Request(APP), canonicalUrl:APP,
      precacheName:name('new'), storage:unavailable,
      fetchResponse:async () => new Response(html('new'), {headers:{'content-type':'text/html'}}) });
    expect(result.stored).toBe(false);
    expect(await result.response.text()).toBe(html('new'));
  });

  it('falls back to the cached document on timeout or server failure and never stores a 5xx', async () => {
    const { stores, storage, locks } = fixture(['build'], 'build');
    const base = { request:new Request(APP), canonicalUrl:APP,
      precacheName:name('build'), storage, locks, timeoutMs:1 };
    const timeout = await handleCanonicalNavigation({ ...base, fetchResponse:() => new Promise<Response>(() => {}) });
    expect(await timeout.response.text()).toBe(html('build'));
    const unavailable = await handleCanonicalNavigation({
      ...base, fetchResponse:async () => new Response('unavailable', {status:503}),
    });
    expect(await unavailable.response.text()).toBe(html('build'));
    expect(stores.get(AAC_CORE_NAVIGATION_CACHE)?.get(APP)).toBe(html('build'));
  });

  it('matches only the AAC origin and exact path boundary', () => {
    expect(isAacUrl(APP, ORIGIN)).toBe(true);
    expect(isAacUrl(APP + '/docs', ORIGIN)).toBe(true);
    expect(isAacUrl(APP + '-unrelated', ORIGIN)).toBe(false);
    expect(isAacUrl('https://elsewhere.example.test/prism-aac', ORIGIN)).toBe(false);
    expect(isAacUrl('invalid', ORIGIN)).toBe(false);
  });
});
