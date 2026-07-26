/**
 * pictogramService unit tests — military grade.
 *
 * Tests ARASAAC two-stage lookup (search + CDN), Synalux AI fallback,
 * mode='off' guard, 2MB blob cap, non-image content-type rejection,
 * memory cache deduplication, and pictureModeForProfile plan mapping.
 *
 * vi.resetModules() in beforeEach gives each test a fresh MEM_CACHE,
 * dbPromise, and arasaacMisses set — no cross-test cache pollution.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MOCK_BLOB_URL = 'blob:mock-pictogram-url';

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

beforeEach(() => {
  vi.resetModules();
  mockCreateObjectURL();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── pictureModeForProfile ──────────────────────────────────────────────────

describe('pictureModeForProfile — plan → mode mapping', () => {
  it('free plan returns "symbols" (no AI fallback for free tier)', async () => {
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
});

// ── Mode 'off' and empty phrase early exits ────────────────────────────────

describe('getPictogramUrl — early exits', () => {
  it('returns null immediately when mode is "off" — no network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('food', 'en', 'off')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when phrase contains only punctuation (normalize strips all chars, pickHeadWord → empty)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    // normalize() strips non-alpha/numeric; only punctuation → words=[] → token=''
    expect(await getPictogramUrl('!!! --- ???', 'en', 'symbols')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for empty string phrase', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('', 'en', 'symbols')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── ARASAAC happy path ─────────────────────────────────────────────────────

describe('getPictogramUrl — ARASAAC hit', () => {
  it('returns a blob object URL when ARASAAC search + CDN both succeed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([{ _id: 42, keywords: [{ keyword: 'food' }] }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('static.arasaac.org')) {
        return new Response(new ArrayBuffer(512), {
          status: 200, headers: { 'Content-Type': 'image/png' },
        });
      }
      return new Response('', { status: 404 });
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const url = await getPictogramUrl('food', 'en', 'symbols');
    expect(url).toBe(MOCK_BLOB_URL);
  });

  it('fetches CDN URL with the pictogram ID returned by the search', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([{ _id: 7777 }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('static.arasaac.org')) {
        return new Response(new ArrayBuffer(512), {
          status: 200, headers: { 'Content-Type': 'image/png' },
        });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('water', 'en', 'symbols');
    const cdnCalls = (fetchSpy.mock.calls as [string][]).filter(([u]) => u.includes('static.arasaac.org'));
    expect(cdnCalls.length).toBeGreaterThan(0);
    expect(cdnCalls[0][0]).toContain('7777');
  });

  it('passes the correct lang code to the ARASAAC search URL', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([{ _id: 1 }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('static.arasaac.org')) {
        return new Response(new ArrayBuffer(100), {
          status: 200, headers: { 'Content-Type': 'image/png' },
        });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('apă', 'ro-RO', 'symbols');
    const arasaacCalls = (fetchSpy.mock.calls as [string][]).filter(([u]) => u.includes('api.arasaac.org'));
    // Lang code is base code only: 'ro-RO' → 'ro'
    expect(arasaacCalls[0][0]).toContain('/ro/');
  });
});

// ── ARASAAC miss → Synalux AI fallback ────────────────────────────────────

describe('getPictogramUrl — ARASAAC miss', () => {
  function arasaacEmpty() {
    return vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('', { status: 404 });
    });
  }

  it('returns null for mode=symbols when ARASAAC misses — no AI fallback', async () => {
    vi.stubGlobal('fetch', arasaacEmpty());
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('xyzzy-unique-1', 'en', 'symbols')).toBeNull();
  });

  it('an anonymous profile miss never makes a Synalux AI request', async () => {
    const fetchSpy = arasaacEmpty();
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl, pictureModeForProfile } = await import('@/services/pictogramService');

    expect(await getPictogramUrl(
      'anonymous-arasaac-miss',
      'en',
      pictureModeForProfile(null),
    )).toBeNull();
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/prism-aac/pictogram')))
      .toBe(false);
  });

  it('calls Synalux AI when ARASAAC misses and mode=symbols-ai', async () => {
    let aiCalled = false;
    const base = arasaacEmpty();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/prism-aac/pictogram')) {
        aiCalled = true;
        return new Response(new ArrayBuffer(200), {
          status: 200, headers: { 'Content-Type': 'image/png' },
        });
      }
      return base(url);
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const result = await getPictogramUrl('xyzzy-unique-2', 'en', 'symbols-ai');
    expect(aiCalled).toBe(true);
    expect(result).toBe(MOCK_BLOB_URL);
  });

  it('returns null when both ARASAAC and Synalux AI fail for symbols-ai', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/prism-aac/pictogram')) {
        return new Response('', { status: 500 });
      }
      return new Response('', { status: 404 });
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('xyzzy-unique-3', 'en', 'symbols-ai')).toBeNull();
  });
});

// ── Synalux AI safety guards ───────────────────────────────────────────────

describe('getPictogramUrl — Synalux AI content safety', () => {
  function setupWithAI(handler: (url: string, init?: RequestInit) => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/prism-aac/pictogram')) {
        return handler(url, init);
      }
      return new Response('', { status: 404 });
    }));
  }

  it('returns null when Synalux AI sends non-image content-type', async () => {
    setupWithAI(async () => new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-ct-1', 'en', 'symbols-ai')).toBeNull();
  });

  it('returns null when Content-Length exceeds 2MB cap', async () => {
    setupWithAI(async () => new Response(new ArrayBuffer(100), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(2 * 1024 * 1024 + 1),
      },
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-cl-2', 'en', 'symbols-ai')).toBeNull();
  });

  it('returns null when actual blob exceeds 2MB (no Content-Length header)', async () => {
    // Build a 2MB+1KB buffer to exceed the cap even without a CL header
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1024);
    setupWithAI(async () => new Response(oversized.buffer, {
      status: 200, headers: { 'Content-Type': 'image/png' },
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-blob-3', 'en', 'symbols-ai')).toBeNull();
  });

  it('sends credentials: same-origin to avoid CORS block on Supabase redirects', async () => {
    let capturedCredentials: RequestCredentials | undefined;
    setupWithAI(async (_url, init) => {
      capturedCredentials = init?.credentials;
      return new Response(new ArrayBuffer(100), {
        status: 200, headers: { 'Content-Type': 'image/png' },
      });
    });
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('safety-creds-4', 'en', 'symbols-ai');
    expect(capturedCredentials).toBe('same-origin');
  });

  it('sends phrase truncated to 100 chars in request body', async () => {
    let capturedBody: { phrase?: string } = {};
    setupWithAI(async (_url, init) => {
      if (init?.body) capturedBody = JSON.parse(String(init.body)) as { phrase?: string };
      return new Response(new ArrayBuffer(100), {
        status: 200, headers: { 'Content-Type': 'image/png' },
      });
    });
    const longPhrase = 'a'.repeat(200);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl(longPhrase, 'en', 'symbols-ai');
    expect(capturedBody.phrase?.length).toBeLessThanOrEqual(100);
  });
});

// ── Memory cache deduplication ─────────────────────────────────────────────

describe('getPictogramUrl — MEM_CACHE deduplication', () => {
  it('coalesces concurrent callers for the same phrase + lang + mode', async () => {
    let releaseSearch!: () => void;
    const searchGate = new Promise<void>((resolve) => {
      releaseSearch = resolve;
    });
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        await searchGate;
        return new Response(JSON.stringify([{ _id: 6 }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('static.arasaac.org')) {
        return new Response(new ArrayBuffer(100), {
          status: 200, headers: { 'Content-Type': 'image/png' },
        });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');

    const first = getPictogramUrl('concurrent-cache-test', 'en', 'symbols');
    const second = getPictogramUrl('concurrent-cache-test', 'en', 'symbols');

    await vi.waitFor(() => {
      const searches = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes('api.arasaac.org'));
      expect(searches).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('api.arasaac.org'))).toHaveLength(1);

    releaseSearch();
    const [url1, url2] = await Promise.all([first, second]);
    expect(url1).toBe(MOCK_BLOB_URL);
    expect(url2).toBe(url1);
    expect(fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('static.arasaac.org'))).toHaveLength(1);
  });

  it('second call for same phrase + lang + mode returns cached URL without re-fetching', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([{ _id: 5 }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('static.arasaac.org')) {
        return new Response(new ArrayBuffer(100), {
          status: 200, headers: { 'Content-Type': 'image/png' },
        });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const url1 = await getPictogramUrl('cache-test-phrase', 'en', 'symbols');
    const url2 = await getPictogramUrl('cache-test-phrase', 'en', 'symbols');
    expect(url1).toBe(MOCK_BLOB_URL);
    expect(url2).toBe(url1);
    // Only the first call hits the network (ARASAAC search + CDN = 2 calls max)
    const networkCalls = (fetchSpy.mock.calls as [string][]).filter(([u]) => u.includes('arasaac.org'));
    expect(networkCalls.length).toBeLessThanOrEqual(2);
  });

  it('different phrases produce separate cache entries', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        callCount++;
        return new Response(JSON.stringify([{ _id: callCount }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('static.arasaac.org')) {
        return new Response(new ArrayBuffer(100), {
          status: 200, headers: { 'Content-Type': 'image/png' },
        });
      }
      return new Response('', { status: 404 });
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('apple', 'en', 'symbols');
    await getPictogramUrl('banana', 'en', 'symbols');
    // Both phrases triggered separate ARASAAC lookups
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});

// ── ARASAAC negative-cache misses ─────────────────────────────────────────

describe('getPictogramUrl — ARASAAC 404 handling', () => {
  it('returns null and does not throw when ARASAAC search returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response('Not found', { status: 404 });
      }
      return new Response('', { status: 404 });
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('xyzzy-404-a', 'en', 'symbols')).resolves.toBeNull();
  });

  it('returns null when CDN image fetch returns 404 (pictogram ID valid but image missing)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('api.arasaac.org')) {
        return new Response(JSON.stringify([{ _id: 99 }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('static.arasaac.org')) {
        return new Response('', { status: 404 });
      }
      return new Response('', { status: 404 });
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('xyzzy-404-b', 'en', 'symbols')).resolves.toBeNull();
  });
});
