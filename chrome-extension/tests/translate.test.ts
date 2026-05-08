/**
 * translate — fetch-mocked tests for the Google gtx wrapper. Locks
 * the response shape parser and the cache + failure semantics.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translate, pickVoiceForLang, __resetCache } from '../src/translate';

type FetchInit = { signal?: AbortSignal };

function mockFetch(impl: (url: string, init?: FetchInit) => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

beforeEach(() => {
  __resetCache();
  vi.unstubAllGlobals();
});

describe('translate', () => {
  it('returns the source text when target is empty', async () => {
    const out = await translate('hello', 'auto', '');
    expect(out).toBe('hello');
  });

  it('returns the source text on empty input', async () => {
    const out = await translate('', 'auto', 'es');
    expect(out).toBe('');
  });

  it('parses the gtx response shape correctly', async () => {
    mockFetch(async () => new Response(JSON.stringify([
      [['Hola', 'Hello', null, null, 1]],
      null, 'en',
    ]), { status: 200 }));
    const out = await translate('Hello', 'en', 'es');
    expect(out).toBe('Hola');
  });

  it('joins multi-chunk gtx responses', async () => {
    mockFetch(async () => new Response(JSON.stringify([
      [
        ['Bună ', 'Hello ', null, null, 1],
        ['lume.', 'world.', null, null, 1],
      ],
    ]), { status: 200 }));
    const out = await translate('Hello world.', 'en', 'ro');
    expect(out).toBe('Bună lume.');
  });

  it('returns source text on HTTP failure', async () => {
    mockFetch(async () => new Response('error', { status: 500 }));
    const out = await translate('Hello', 'en', 'es');
    expect(out).toBe('Hello');
  });

  it('returns source text on malformed response', async () => {
    mockFetch(async () => new Response('not-json', { status: 200 }));
    const out = await translate('Hello', 'en', 'es');
    expect(out).toBe('Hello');
  });

  it('returns source text on network error', async () => {
    mockFetch(async () => { throw new Error('offline'); });
    const out = await translate('Hello', 'en', 'es');
    expect(out).toBe('Hello');
  });

  it('caches successful translations (no second fetch)', async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      return new Response(JSON.stringify([[['Hola', 'Hello', null, null, 1]]]), { status: 200 });
    });
    await translate('Hello', 'en', 'es');
    await translate('Hello', 'en', 'es');
    await translate('Hello', 'en', 'es');
    expect(calls).toBe(1);
  });
});

describe('pickVoiceForLang', () => {
  it('returns null when no voices exist', () => {
    vi.stubGlobal('window', {
      speechSynthesis: { getVoices: () => [] },
    });
    expect(pickVoiceForLang('es')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns null for empty target', () => {
    vi.stubGlobal('window', {
      speechSynthesis: { getVoices: () => [{ lang: 'es-ES', name: 'Test' }] },
    });
    expect(pickVoiceForLang('')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('prefers exact lang match', () => {
    const voices = [
      { lang: 'es-MX', name: 'Latin' },
      { lang: 'es-ES', name: 'Castilian' },
    ];
    vi.stubGlobal('window', { speechSynthesis: { getVoices: () => voices } });
    const v = pickVoiceForLang('es-ES');
    expect(v?.name).toBe('Castilian');
    vi.unstubAllGlobals();
  });

  it('falls back to base-lang match when no exact match', () => {
    const voices = [{ lang: 'es-MX', name: 'Latin' }];
    vi.stubGlobal('window', { speechSynthesis: { getVoices: () => voices } });
    const v = pickVoiceForLang('es');
    expect(v?.name).toBe('Latin');
    vi.unstubAllGlobals();
  });

  it('returns null when no voice for any flavor of the target lang', () => {
    const voices = [{ lang: 'fr-FR', name: 'French' }];
    vi.stubGlobal('window', { speechSynthesis: { getVoices: () => voices } });
    expect(pickVoiceForLang('es')).toBeNull();
    vi.unstubAllGlobals();
  });
});
