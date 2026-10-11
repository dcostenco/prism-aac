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
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('dinosaur', 'en', 'symbols-ai');
    await getPictogramUrl('Kiganja', 'sw', 'symbols-ai');
    expect(urls(fetchSpy).length).toBeGreaterThan(0);
    expect(urls(fetchSpy).every((u) => u.includes(AI_PATH))).toBe(true);
    expect(urls(fetchSpy).some((u) => /arasaac/i.test(u))).toBe(false);
  });

  it('returns null when the portal fails', async () => {
    stubAI(() => new Response('', { status: 500 }));
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

  it('deletes the old pictogram database and miss list once', async () => {
    localStorage.clear();
    await seedLegacyDatabase();
    localStorage.setItem('prism-arasaac-misses', JSON.stringify(['en:xyz']));
    expect(await databaseNames()).toContain('prism-aac-pictograms');

    const { clearLegacyPictogramCache } = await import('@/services/pictogramService');
    clearLegacyPictogramCache();

    await vi.waitFor(async () => expect(await databaseNames()).not.toContain('prism-aac-pictograms'));
    expect(localStorage.getItem('prism-arasaac-misses')).toBeNull();
    await vi.waitFor(() => expect(localStorage.getItem('prism-legacy-pictograms-cleared')).toBe('1'));
  });

  it('does nothing once it has run', async () => {
    localStorage.setItem('prism-legacy-pictograms-cleared', '1');
    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase');
    const { clearLegacyPictogramCache } = await import('@/services/pictogramService');
    clearLegacyPictogramCache();
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
