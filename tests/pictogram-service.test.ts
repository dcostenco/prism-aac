/**
 * pictogramService unit tests.
 *
 * Third-party pictograms are retired: no lookup may reach their hosts, tiles
 * show words, and only prediction-bar words on paid plans ask the Synalux
 * portal for a generated picture. Also covers mode guards, the 2MB blob cap,
 * non-image content-type rejection, in-memory deduplication and the plan
 * mapping.
 *
 * vi.resetModules() in beforeEach gives each test a fresh in-memory cache.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MOCK_BLOB_URL = 'blob:mock-pictogram-url';
const RETIRED_HOSTS = ['api.arasaac.org', 'static.arasaac.org'];

function requestHostname(input: unknown): string {
  if (input instanceof URL) return input.hostname;
  if (typeof Request !== 'undefined' && input instanceof Request) return new URL(input.url).hostname;
  if (typeof input !== 'string') return '';
  return new URL(input, 'https://prism-aac.test').hostname;
}

const isRetiredRequest = (input: unknown) => {
  const hostname = requestHostname(input);
  return RETIRED_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host.split('.').slice(-2).join('.')}`));
};

function mockCreateObjectURL(): void {
  // jsdom does not implement URL.createObjectURL — provide a stable mock
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => MOCK_BLOB_URL) });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
}

/** Every request is recorded; the portal answers with `handler`, anything else 404s. */
function stubNetwork(handler: (url: string, init?: RequestInit) => Promise<Response> = async () =>
  new Response(new ArrayBuffer(100), { status: 200, headers: { 'Content-Type': 'image/png' } })) {
  const fetchSpy = vi.fn(async (url: string, init?: RequestInit) =>
    url.includes('/prism-aac/pictogram') ? handler(url, init) : new Response('', { status: 404 }));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

beforeEach(() => {
  vi.resetModules();
  mockCreateObjectURL();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('retired third-party pictograms', () => {
  it('matches the retired hosts and their subdomains, not lookalikes', () => {
    expect(isRetiredRequest('https://api.arasaac.org/v1/pictograms/en/search/food')).toBe(true);
    expect(isRetiredRequest('https://static.arasaac.org/pictograms/42/42_500.png')).toBe(true);
    expect(isRetiredRequest('https://api.arasaac.org.attacker.test/pictograms')).toBe(false);
    expect(isRetiredRequest('https://attacker.test/static.arasaac.org/42.png')).toBe(false);
  });

  it.each([
    ['tile, free plan', 'symbols', {}],
    ['tile, paid plan', 'symbols-ai', {}],
    ['prediction, free plan', 'symbols', { generated: true }],
    ['prediction, paid plan', 'symbols-ai', { generated: true }],
  ] as const)('never contacts a retired host (%s)', async (_case, mode, options) => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    for (const phrase of ['food', 'come here', 'how are you?', 'water', 'help']) {
      await getPictogramUrl(phrase, 'en', mode, options);
      await getPictogramUrl(phrase, 'es', mode, options);
    }
    expect(fetchSpy.mock.calls.filter(([url]) => isRetiredRequest(url))).toEqual([]);
  });

  it('shows words on tiles: no request at all, even on a paid plan', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('food', 'en', 'symbols-ai')).toBeNull();
    expect(await getPictogramUrl('water', 'en', 'symbols')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('free and anonymous predictions make no request', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('food', 'en', 'symbols', { generated: true })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('pictureModeForProfile — plan → mode mapping', () => {
  it('free plan returns "symbols" (no generated pictures for free tier)', async () => {
    const { pictureModeForProfile } = await import('@/services/pictogramService');
    expect(pictureModeForProfile({ email: 'a@b.com', name: 'A', plan: 'free', isPlatformAdmin: false })).toBe('symbols');
  });

  it('null profile returns "symbols" so anonymous visits never call the paid route', async () => {
    const { pictureModeForProfile } = await import('@/services/pictogramService');
    expect(pictureModeForProfile(null)).toBe('symbols');
  });

  it.each(['standard', 'advanced', 'enterprise'] as const)('%s plan returns "symbols-ai"', async (plan) => {
    const { pictureModeForProfile } = await import('@/services/pictogramService');
    expect(pictureModeForProfile({ email: 'a@b.com', name: 'A', plan, isPlatformAdmin: false })).toBe('symbols-ai');
  });
});

describe('getPictogramUrl — early exits', () => {
  it('returns null immediately when mode is "off" — no network call', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('food', 'en', 'off', { generated: true })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['!!! --- ???', ''])('returns null without a request for an empty head word (%j)', async (phrase) => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl(phrase, 'en', 'symbols-ai', { generated: true })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never requests a picture for a blocked or sensitive word', async () => {
    const fetchSpy = stubNetwork();
    const { PROFANITY, SENSITIVE } = await import('@/engine/ageBlocklist');
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const blocked = [...PROFANITY][0], sensitive = [...SENSITIVE][0];
    expect(await getPictogramUrl(blocked, 'en', 'symbols-ai', { generated: true })).toBeNull();
    expect(await getPictogramUrl(sensitive, 'en', 'symbols-ai', { generated: true })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getPictogramUrl — generated prediction pictures', () => {
  it('asks the Synalux portal once and returns a blob URL on a paid plan', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('cupboard', 'en', 'symbols-ai', { generated: true })).toBe(MOCK_BLOB_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/prism-aac\/pictogram$/);
    expect(JSON.parse(String(init?.body))).toMatchObject({ phrase: 'cupboard', lang: 'en', styleVersion: 2 });
  });

  it('returns null when the portal fails', async () => {
    stubNetwork(async () => new Response('', { status: 500 }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('cupboard', 'en', 'symbols-ai', { generated: true })).toBeNull();
  });
});

describe('getPictogramUrl — Synalux AI content safety', () => {
  it('returns null when Synalux AI sends non-image content-type', async () => {
    stubNetwork(async () => new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-ct-1', 'en', 'symbols-ai', { generated: true })).toBeNull();
  });

  it('returns null when Content-Length exceeds 2MB cap', async () => {
    stubNetwork(async () => new Response(new ArrayBuffer(100), {
      status: 200, headers: { 'Content-Type': 'image/png', 'Content-Length': String(2 * 1024 * 1024 + 1) },
    }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-cl-2', 'en', 'symbols-ai', { generated: true })).toBeNull();
  });

  it('returns null when actual blob exceeds 2MB (no Content-Length header)', async () => {
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1024);
    stubNetwork(async () => new Response(oversized.buffer, { status: 200, headers: { 'Content-Type': 'image/png' } }));
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('safety-blob-3', 'en', 'symbols-ai', { generated: true })).toBeNull();
  });

  it('sends credentials: same-origin to avoid CORS block on Supabase redirects', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('safety-creds-4', 'en', 'symbols-ai', { generated: true });
    expect(fetchSpy.mock.calls[0][1]?.credentials).toBe('same-origin');
  });

  it('sends phrase truncated to 100 chars in request body', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('a'.repeat(200), 'en', 'symbols-ai', { generated: true });
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).phrase.length).toBeLessThanOrEqual(100);
  });
});

describe('getPictogramUrl — in-memory deduplication', () => {
  it('coalesces concurrent callers for the same phrase + lang + mode', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fetchSpy = stubNetwork(async () => {
      await gate;
      return new Response(new ArrayBuffer(100), { status: 200, headers: { 'Content-Type': 'image/png' } });
    });
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const calls = [1, 2, 3].map(() => getPictogramUrl('dedup', 'en', 'symbols-ai', { generated: true }));
    release();
    expect(await Promise.all(calls)).toEqual([MOCK_BLOB_URL, MOCK_BLOB_URL, MOCK_BLOB_URL]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('a repeat for the same phrase + lang + mode is served from memory', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('repeat', 'en', 'symbols-ai', { generated: true });
    await getPictogramUrl('repeat', 'en', 'symbols-ai', { generated: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('different phrases are separate requests', async () => {
    const fetchSpy = stubNetwork();
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('first', 'en', 'symbols-ai', { generated: true });
    await getPictogramUrl('second', 'en', 'symbols-ai', { generated: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
