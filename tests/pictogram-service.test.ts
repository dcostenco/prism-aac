/**
 * pictogramService — generated pictures for typed words on paid plans.
 *
 * Built-in phrases use bundled symbols (tests/phrase-symbols.test.ts); this
 * module only serves custom phrases and predicted words that are not built-in
 * vocabulary. Pinned here: free and anonymous users never cause a request,
 * nothing ever goes to a third-party symbol service, sensitive phrases are
 * never sent for generation, and the 2 MB / content-type guards hold.
 *
 * vi.resetModules() in beforeEach gives each test a fresh MEM_CACHE and
 * dbPromise — no cross-test cache pollution.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MOCK_BLOB_URL = 'blob:mock-pictogram-url';
const AI_PATH = '/prism-aac/pictogram';

function mockCreateObjectURL(): void {
  // jsdom does not implement URL.createObjectURL — provide a stable mock
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => MOCK_BLOB_URL),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

function pngResponse(bytes = 200, headers: Record<string, string> = {}) {
  return new Response(new ArrayBuffer(bytes), {
    status: 200, headers: { 'Content-Type': 'image/png', ...headers },
  });
}

/** fetch stub that answers the Synalux AI route and records every URL. */
function stubAI(handler: (init?: RequestInit) => Promise<Response> | Response = () => pngResponse()) {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(AI_PATH)) return handler(init);
    return new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

const urls = (spy: ReturnType<typeof stubAI>) => spy.mock.calls.map(([u]) => String(u));

beforeEach(() => {
  vi.resetModules();
  mockCreateObjectURL();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── plan → mode ────────────────────────────────────────────────────────────

describe('pictureModeForProfile — plan → mode mapping', () => {
  it('free plan returns "symbols" (no generated pictures)', async () => {
    const { pictureModeForProfile } = await import('@/services/pictogramService');
    expect(pictureModeForProfile({ email: 'a@b.com', name: 'A', plan: 'free', isPlatformAdmin: false }))
      .toBe('symbols');
  });

  it('null profile returns "symbols" so anonymous visits never call the paid route', async () => {
    const { pictureModeForProfile } = await import('@/services/pictogramService');
    expect(pictureModeForProfile(null)).toBe('symbols');
  });

  it.each(['standard', 'advanced', 'enterprise'] as const)(
    '%s plan returns "symbols-ai"',
    async (plan) => {
      const { pictureModeForProfile } = await import('@/services/pictogramService');
      expect(pictureModeForProfile({ email: 'a@b.com', name: 'A', plan, isPlatformAdmin: false }))
        .toBe('symbols-ai');
    },
  );

  it('only "symbols-ai" gives typed words a generated picture', async () => {
    const { typedWordPicturesEnabled } = await import('@/services/pictogramService');
    expect(typedWordPicturesEnabled('symbols-ai')).toBe(true);
    expect(typedWordPicturesEnabled('symbols')).toBe(false);
    expect(typedWordPicturesEnabled('off')).toBe(false);
  });
});

// ── no request at all ──────────────────────────────────────────────────────

describe('getPictogramUrl — free, anonymous and off make no request', () => {
  it.each(['symbols', 'off'] as const)('mode "%s" returns null without touching the network', async (mode) => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('pizza with mushrooms', 'en', mode)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an anonymous profile never reaches the paid route', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl, pictureModeForProfile } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('my red bike', 'en', pictureModeForProfile(null))).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for an empty or punctuation-only phrase', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('', 'en', 'symbols-ai')).toBeNull();
    expect(await getPictogramUrl('!!! --- ???', 'en', 'symbols-ai')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never sends a phrase with a sensitive or profane word, even when it is not the head word', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    // "kill" is not the head word here ("want" is picked first), so a head-word
    // check alone would have sent the whole phrase for generation.
    expect(await getPictogramUrl('I want to kill time', 'en', 'symbols-ai')).toBeNull();
    expect(await getPictogramUrl('weed', 'en', 'symbols-ai')).toBeNull();
    expect(await getPictogramUrl('shit happens', 'en', 'symbols-ai')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps vowel signs when it checks a word: Hindi चूतिया is never sent', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('चूतिया', 'hi', 'symbols-ai')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sees a listed word glued by punctuation or inside unspaced Chinese', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('shit,dog', 'en', 'symbols-ai')).toBeNull();
    expect(await getPictogramUrl('banana,kill', 'en', 'symbols-ai')).toBeNull();
    expect(await getPictogramUrl('你是傻瓜', 'zh-Hant', 'symbols-ai')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never sends an English request for a phrase whose shown text is listed in its own language', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('buttock', 'en', 'symbols-ai', { text: 'tako', lang: 'sw' })).toBeNull();
    expect(await getPictogramUrl('dry', 'en', 'symbols-ai', { text: '幹', lang: 'zh-Hant' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    // a clean shown text still gets its picture
    expect(await getPictogramUrl('dog', 'en', 'symbols-ai', { text: 'mbwa', lang: 'sw' })).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalled();
  });
});

// ── paid: Synalux AI ───────────────────────────────────────────────────────

describe('getPictogramUrl — paid plans', () => {
  it('asks the Synalux portal and returns a blob URL', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('grandma garden', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    expect(urls(fetchSpy)).toHaveLength(1);
    expect(urls(fetchSpy)[0]).toContain(AI_PATH);
  });

  it('never contacts a third-party symbol service', async () => {
    const fetchSpy = stubAI(() => new Response('', { status: 500 }));
    const { getPictogramUrl, PicturePendingError } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('dinosaur', 'en', 'symbols-ai')).rejects.toBeInstanceOf(PicturePendingError);
    await expect(getPictogramUrl('Kiganja', 'sw', 'symbols-ai')).rejects.toBeInstanceOf(PicturePendingError);
    expect(urls(fetchSpy).length).toBeGreaterThan(0);
    expect(urls(fetchSpy).every((u) => u.includes(AI_PATH))).toBe(true);
    expect(urls(fetchSpy).some((u) => /arasaac/i.test(u))).toBe(false);
  });

  it('returns null for a permanent portal rejection', async () => {
    stubAI(() => new Response('', { status: 403 }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('xyzzy-unique-3', 'en', 'symbols-ai')).toBeNull();
  });

  it('returns null for non-image content', async () => {
    stubAI(() => new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-ct-1', 'en', 'symbols-ai')).toBeNull();
  });

  it('returns null when Content-Length exceeds the 2MB cap', async () => {
    stubAI(() => pngResponse(100, { 'Content-Length': String(2 * 1024 * 1024 + 1) }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-cl-2', 'en', 'symbols-ai')).toBeNull();
  });

  it('returns null when the blob itself exceeds 2MB (no Content-Length header)', async () => {
    stubAI(() => new Response(new Uint8Array(2 * 1024 * 1024 + 1024).buffer, {
      status: 200, headers: { 'Content-Type': 'image/png' },
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-blob-3', 'en', 'symbols-ai')).toBeNull();
  });

  it('sends credentials: same-origin to avoid a CORS block on the storage redirect', async () => {
    let credentials: RequestCredentials | undefined;
    stubAI((init) => { credentials = init?.credentials; return pngResponse(); });
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('safety-creds-4', 'en', 'symbols-ai');
    expect(credentials).toBe('same-origin');
  });

  it('sends the phrase truncated to 100 chars', async () => {
    let body: { phrase?: string } = {};
    stubAI((init) => { body = JSON.parse(String(init?.body)); return pngResponse(); });
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('a'.repeat(200), 'en', 'symbols-ai');
    expect(body.phrase?.length).toBe(100);
  });
});

// ── caching ────────────────────────────────────────────────────────────────

describe('getPictogramUrl — portal generation switched off', () => {
  const generationOff = (marker: 'header' | 'body') => new Response(
    JSON.stringify({ error: 'Picture not found', styleVersion: 3, ...(marker === 'body' ? { generation: false } : {}) }),
    { status: 404, headers: { 'Content-Type': 'application/json', 'X-AAC-Picture-Version': '3',
      ...(marker === 'header' ? { 'X-AAC-Picture-Generation': 'off' } : {}) } },
  );

  it.each(['header', 'body'] as const)('a miss marked off (%s) shows the word after one cache probe, with no generation request', async marker => {
    const fetchSpy = stubAI(() => generationOff(marker));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('wales', 'en', 'symbols-ai')).toBeNull();
    expect(urls(fetchSpy)).toHaveLength(1);
    expect(urls(fetchSpy)[0]).toContain('cacheOnly=1');
  });

  it('the word is not asked again in the same session', async () => {
    const fetchSpy = stubAI(() => generationOff('header'));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('wales', 'en', 'symbols-ai');
    await getPictogramUrl('wales', 'en', 'symbols-ai');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('an unmarked miss still asks for a new picture (generation on)', async () => {
    let call = 0;
    const fetchSpy = stubAI(() => (call++ === 0
      ? new Response(JSON.stringify({ styleVersion: 3 }), { status: 404, headers: { 'Content-Type': 'application/json', 'X-AAC-Picture-Version': '3' } })
      : pngResponse()));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('wales', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    expect(urls(fetchSpy)).toHaveLength(2);
    expect(urls(fetchSpy)[1]).not.toContain('cacheOnly=1');
  });
});

describe('getPictogramUrl — caching', () => {
  it('coalesces concurrent callers for the same word into one request', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchSpy = stubAI(async () => { await gate; return pngResponse(); });
    const { getPictogramUrl } = await import('@/services/pictogramService');

    const first = getPictogramUrl('concurrent-cache-test', 'en', 'symbols-ai');
    const second = getPictogramUrl('concurrent-cache-test', 'en', 'symbols-ai');
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(MOCK_BLOB_URL);
    expect(b).toBe(a);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('serves a repeat from memory without another request', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('cache-test-phrase', 'en', 'symbols-ai');
    await getPictogramUrl('cache-test-phrase', 'en', 'symbols-ai');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps different words apart', async () => {
    const fetchSpy = stubAI();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('apple', 'en', 'symbols-ai');
    await getPictogramUrl('banana', 'en', 'symbols-ai');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('persists on the device: a fresh session reads IndexedDB instead of asking again', async () => {
    const first = stubAI();
    const service = await import('@/services/pictogramService');
    expect(await service.getPictogramUrl('persisted-word', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    expect(first).toHaveBeenCalledTimes(1);

    vi.resetModules();
    const second = stubAI();
    const fresh = await import('@/services/pictogramService');
    expect(await fresh.getPictogramUrl('persisted-word', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    expect(second).not.toHaveBeenCalled();
  });

  // Pictures drawn before the neutral-figure rule (children, unsafe or lettered
  // pictures) were retired on the server; a device copy must not outlive that.
  const DB = 'prism-aac-generated-pictures';
  const resetDb = () => new Promise<void>((resolve, reject) => {
    const del = indexedDB.deleteDatabase(DB);
    del.onsuccess = () => resolve(); del.onerror = () => reject(del.error); del.onblocked = () => resolve();
  });
  const seed = (dbVersion: number, key: string) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(DB, dbVersion);
    open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('blobs')) open.result.createObjectStore('blobs'); };
    open.onsuccess = () => {
      const tx = open.result.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(new Blob([new Uint8Array(200)], { type: 'image/png' }), key);
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });

  it('does not show a picture saved under cache version 4; it asks the portal for the redrawn one', async () => {
    await resetDb();
    const service = await import('@/services/pictogramService');
    await seed(service.DB_VERSION, await service.pictureCacheKey('retired-picture-word', 'en', 'symbols-ai', 4));
    const fetchSpy = stubAI();
    expect(await service.getPictogramUrl('retired-picture-word', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('loads from the network instead of waiting when an older tab blocks the database upgrade', async () => {
    await resetDb();
    // An older tab: version 1 open, with no handler that would close it on request.
    const held = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('blobs');
      open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
    });
    try {
      const service = await import('@/services/pictogramService');
      const fetchSpy = stubAI();
      expect(await service.getPictogramUrl('blocked-upgrade-word', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally { held.close(); }
  });

  it('after a version-4 picture is ignored, a 429 reports the portal wait and the retry shows the redrawn picture', async () => {
    await resetDb();
    const service = await import('@/services/pictogramService');
    await seed(service.DB_VERSION, await service.pictureCacheKey('rate-limited-word', 'en', 'symbols-ai', 4));
    let calls = 0;
    stubAI(() => (++calls === 1
      ? new Response(JSON.stringify({ error: 'Rate limit exceeded', retryAfter: 60 }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } })
      : pngResponse()));
    const first = await service.getPictogramUrl('rate-limited-word', 'en', 'symbols-ai').catch(error => error);
    expect(first).toBeInstanceOf(service.PicturePendingError);
    expect(first.retryAfterMs).toBe(60_000);
    // The tile's retry after that wait gets the redrawn picture, not the version-4 copy.
    expect(await service.getPictogramUrl('rate-limited-word', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    expect(calls).toBe(2);
  });

  it('doubles the reported wait across words after each consecutive failure and resets it on success', async () => {
    await resetDb();
    const service = await import('@/services/pictogramService');
    let failing = true;
    stubAI(() => (failing ? new Response('down', { status: 503 }) : pngResponse()));
    const waitOf = async (word: string) => (await service.getPictogramUrl(word, 'en', 'symbols-ai').catch(error => error)).retryAfterMs;
    // Different words share one backoff, so waiting tiles spread out instead of
    // all asking again every second.
    expect(await waitOf('outage-a')).toBe(1_000);
    expect(await waitOf('outage-b')).toBe(2_000);
    expect(await waitOf('outage-c')).toBe(4_000);
    failing = false;
    expect(await service.getPictogramUrl('outage-d', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    failing = true;
    expect(await waitOf('outage-e')).toBe(1_000);
  });

  it('frees the space of pictures saved before the redraw when the device database upgrades', async () => {
    await resetDb();
    const service = await import('@/services/pictogramService');
    // Even an entry under the current key is gone after the upgrade from database version 1.
    await seed(1, await service.pictureCacheKey('upgrade-cleared-word', 'en', 'symbols-ai'));
    const fetchSpy = stubAI();
    expect(await service.getPictogramUrl('upgrade-cleared-word', 'en', 'symbols-ai')).toBe(MOCK_BLOB_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ── cache left by earlier versions ─────────────────────────────────────────

describe('clearLegacyPictogramCache', () => {
  async function seedLegacyDatabase() {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('prism-aac-pictograms', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('blobs'); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put(new Blob(['old picture']), 'some-key');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  const databaseNames = async () => (await indexedDB.databases()).map((d) => d.name);

  it('deletes the retired pictogram database and miss list', async () => {
    localStorage.clear();
    await seedLegacyDatabase();
    localStorage.setItem('prism-arasaac-misses', JSON.stringify(['en:xyz']));
    expect(await databaseNames()).toContain('prism-aac-pictograms');

    const { clearLegacyPictogramCache } = await import('@/services/pictogramService');
    await clearLegacyPictogramCache();

    await vi.waitFor(async () => expect(await databaseNames()).not.toContain('prism-aac-pictograms'));
    expect(localStorage.getItem('prism-arasaac-misses')).toBeNull();
    expect(localStorage.getItem('prism-legacy-pictograms-cleared')).toBe('2');
  });

  it('cleans stale legacy data again even after a previous completion marker', async () => {
    localStorage.setItem('prism-legacy-pictograms-cleared', '1');
    await seedLegacyDatabase();
    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase');
    const { clearLegacyPictogramCache } = await import('@/services/pictogramService');
    await clearLegacyPictogramCache();
    expect(deleteSpy).toHaveBeenCalledWith('prism-aac-pictograms');
    expect(await databaseNames()).not.toContain('prism-aac-pictograms');
  });
});
