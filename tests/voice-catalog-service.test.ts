/**
 * voiceCatalogService unit tests — military grade.
 *
 * Tests the Synalux portal voice catalog fetch, 1-hour in-memory cache,
 * 403 free-tier handling, offline short-circuit, 1000-entry size cap,
 * auth-token injection, and voicesForLanguage lang matching.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchVoiceCatalog,
  voicesForLanguage,
  _resetVoiceCatalogCacheForTests,
  type VoiceEntry,
} from '@/services/voiceCatalogService';

const fetchMock = vi.fn();

const SAMPLE_VOICES: VoiceEntry[] = [
  { voiceId: 'alex', lang: 'en-us', backend: 'inworld', gender: 'male', displayName: 'Alex' },
  { voiceId: 'elena', lang: 'ro-ro', backend: 'azure', gender: 'female', displayName: 'Elena' },
];

function voicesResponse(voices: VoiceEntry[] = SAMPLE_VOICES, status = 200): Response {
  return new Response(JSON.stringify({ voices }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  _resetVoiceCatalogCacheForTests();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

afterEach(() => vi.clearAllMocks());

// ── Happy path ─────────────────────────────────────────────────────────────

describe('fetchVoiceCatalog — happy path', () => {
  it('returns voices array from a 200 response', async () => {
    fetchMock.mockResolvedValueOnce(voicesResponse());
    const voices = await fetchVoiceCatalog();
    expect(voices).toHaveLength(2);
    expect(voices[0].voiceId).toBe('alex');
  });

  it('calls /tts/voices with credentials: include', async () => {
    fetchMock.mockResolvedValueOnce(voicesResponse());
    await fetchVoiceCatalog();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('tts/voices');
    expect(init.credentials).toBe('include');
  });

  it('sets Accept: application/json request header', async () => {
    fetchMock.mockResolvedValueOnce(voicesResponse());
    await fetchVoiceCatalog();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
  });

  it('attaches Bearer token from sessionStorage when present', async () => {
    sessionStorage.setItem('prism-aac-auth-token', 'tok-abc123');
    fetchMock.mockResolvedValueOnce(voicesResponse());
    await fetchVoiceCatalog();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-abc123');
  });

  it('omits Authorization header when no token in sessionStorage', async () => {
    fetchMock.mockResolvedValueOnce(voicesResponse());
    await fetchVoiceCatalog();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('filters entries missing voiceId (non-string)', async () => {
    const mixed = [
      { voiceId: 'ok', lang: 'en', backend: 'inworld', gender: 'female', displayName: 'OK' },
      { voiceId: 42, lang: 'en', backend: 'inworld', gender: 'female', displayName: 'Bad ID type' },
      { lang: 'en', backend: 'inworld', gender: 'male', displayName: 'Missing voiceId' },
    ];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ voices: mixed }), { status: 200 }));
    const voices = await fetchVoiceCatalog();
    expect(voices).toHaveLength(1);
    expect(voices[0].voiceId).toBe('ok');
  });

  it('filters entries missing lang (non-string)', async () => {
    const mixed = [
      { voiceId: 'v1', lang: 'en', backend: 'inworld', gender: 'female', displayName: 'Good' },
      { voiceId: 'v2', backend: 'inworld', gender: 'male', displayName: 'No lang' },
    ];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ voices: mixed }), { status: 200 }));
    const voices = await fetchVoiceCatalog();
    expect(voices).toHaveLength(1);
  });
});

// ── Catalog size cap ───────────────────────────────────────────────────────

describe('fetchVoiceCatalog — catalog size cap', () => {
  it('caps at 1000 voices even when portal sends more', async () => {
    const big = Array.from({ length: 1500 }, (_, i) => ({
      voiceId: `v${i}`,
      lang: 'en',
      backend: 'inworld' as const,
      gender: 'female' as const,
      displayName: `Voice ${i}`,
    }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ voices: big }), { status: 200 }));
    const voices = await fetchVoiceCatalog();
    expect(voices).toHaveLength(1000);
  });

  it('accepts catalogs under the 1000-entry cap without truncating', async () => {
    const small = Array.from({ length: 50 }, (_, i) => ({
      voiceId: `v${i}`, lang: 'en', backend: 'inworld' as const,
      gender: 'female' as const, displayName: `V${i}`,
    }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ voices: small }), { status: 200 }));
    const voices = await fetchVoiceCatalog();
    expect(voices).toHaveLength(50);
  });
});

// ── Cache behavior ─────────────────────────────────────────────────────────

describe('fetchVoiceCatalog — in-memory cache', () => {
  it('serves from cache on second call without re-fetching', async () => {
    fetchMock.mockResolvedValue(voicesResponse());
    await fetchVoiceCatalog();
    await fetchVoiceCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('force=true bypasses the 1-hour TTL', async () => {
    fetchMock.mockResolvedValue(voicesResponse());
    await fetchVoiceCatalog();
    await fetchVoiceCatalog(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ── Error handling ─────────────────────────────────────────────────────────

describe('fetchVoiceCatalog — error handling', () => {
  it('returns [] when portal returns 403 (free tier / unauthenticated)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }));
    const voices = await fetchVoiceCatalog();
    expect(voices).toEqual([]);
  });

  it('returns [] when portal returns 500 and no cache exists', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    const voices = await fetchVoiceCatalog();
    expect(voices).toEqual([]);
  });

  it('returns stale cache when portal returns 500 and cache is warm', async () => {
    fetchMock.mockResolvedValueOnce(voicesResponse());
    await fetchVoiceCatalog();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    const voices = await fetchVoiceCatalog(true);
    expect(voices).toHaveLength(SAMPLE_VOICES.length);
  });

  it('returns [] when fetch throws and no prior cache', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'));
    const voices = await fetchVoiceCatalog();
    expect(voices).toEqual([]);
  });

  it('returns stale cache when fetch throws and cache is warm', async () => {
    fetchMock.mockResolvedValueOnce(voicesResponse());
    await fetchVoiceCatalog();
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const voices = await fetchVoiceCatalog(true);
    expect(voices).toHaveLength(SAMPLE_VOICES.length);
  });
});

// ── Offline short-circuit ──────────────────────────────────────────────────

describe('fetchVoiceCatalog — offline short-circuit', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  });

  it('skips the network round-trip when navigator.onLine === false', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    await fetchVoiceCatalog();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] when offline and no cache', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const voices = await fetchVoiceCatalog();
    expect(voices).toEqual([]);
  });

  it('returns cached voices when offline and cache is warm', async () => {
    fetchMock.mockResolvedValueOnce(voicesResponse());
    await fetchVoiceCatalog();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const voices = await fetchVoiceCatalog();
    expect(voices).toHaveLength(SAMPLE_VOICES.length);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── voicesForLanguage lang matching ───────────────────────────────────────

describe('voicesForLanguage — language filtering', () => {
  const catalog: VoiceEntry[] = [
    { voiceId: 'alex', lang: 'en-us', backend: 'inworld', gender: 'male', displayName: 'Alex' },
    { voiceId: 'emma', lang: 'en', backend: 'inworld', gender: 'female', displayName: 'Emma' },
    { voiceId: 'alina', lang: 'ro-ro', backend: 'azure', gender: 'female', displayName: 'Alina' },
    { voiceId: 'ana', lang: 'ro', backend: 'azure', gender: 'female', displayName: 'Ana' },
  ];

  it('returns exact matches for full locale code', () => {
    const result = voicesForLanguage(catalog, 'en-us');
    expect(result).toHaveLength(1);
    expect(result[0].voiceId).toBe('alex');
  });

  it('falls back to base code when no exact locale match exists', () => {
    const result = voicesForLanguage(catalog, 'en-gb');
    expect(result).toHaveLength(1);
    expect(result[0].voiceId).toBe('emma');
  });

  it('returns [] when lang is absent from the catalog entirely', () => {
    const result = voicesForLanguage(catalog, 'ja-jp');
    expect(result).toEqual([]);
  });

  it('normalizes underscore to hyphen before matching', () => {
    const result = voicesForLanguage(catalog, 'ro_RO');
    expect(result).toHaveLength(1);
    expect(result[0].voiceId).toBe('alina');
  });

  it('normalizes to lowercase before matching', () => {
    const result = voicesForLanguage(catalog, 'RO-RO');
    expect(result).toHaveLength(1);
    expect(result[0].voiceId).toBe('alina');
  });

  it('returns [] for an empty catalog', () => {
    expect(voicesForLanguage([], 'en-us')).toEqual([]);
  });

  it('base code fallback for Romanian "ro-RO" → "ro" when only "ro" entry exists', () => {
    const roOnly = [{ voiceId: 'ana', lang: 'ro', backend: 'azure' as const, gender: 'female' as const, displayName: 'Ana' }];
    const result = voicesForLanguage(roOnly, 'ro-ro');
    expect(result).toHaveLength(1);
    expect(result[0].voiceId).toBe('ana');
  });
});
