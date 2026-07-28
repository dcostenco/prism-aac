/**
 * Pictogram lookup for locales ARASAAC does not index.
 *
 * ARASAAC's search endpoint returns HTTP 400 for eight of our shipped
 * locales — measured 2026-07-28: ja, hi, vi, tl, id, am, sw, bn. Five of those
 * predate the Amharic/Swahili/Bengali work, so those users have never had
 * prediction-bar pictograms, and every attempt fired a doomed request.
 *
 * Two behaviours are pinned here:
 *
 *   1. ONE 400 per locale, not one per token. The miss cache is keyed by
 *      lang:token, so without a locale-level short-circuit a single session
 *      issues hundreds of failing requests — latency and noise for a result
 *      that was knowable after the first.
 *
 *   2. The English SOURCE resolves the picture. ARASAAC pictograms are
 *      language-neutral images; only the search term is localized. The
 *      pre-existing Latin-only fallback cannot do this — it re-searches the
 *      English endpoint with the FOREIGN token ("Kiganja"), which never
 *      matches, and skips non-Latin scripts entirely.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Exact hostname, or '' when the URL will not parse. */
function hostOf(u: string): string {
  try { return new URL(u).hostname; } catch { return ''; }
}

const ARASAAC_SEARCH = /api\.arasaac\.org\/v1\/pictograms\/([a-z-]+)\/search\/(.+)$/;

/** Fake ARASAAC: 400 for unsupported locales, hits only for known English words. */
function installFetch(supported: Set<string>, englishHits: Set<string>) {
  const calls: Array<{ lang: string; term: string }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const m = url.match(ARASAAC_SEARCH);
    if (m) {
      const lang = m[1];
      const term = decodeURIComponent(m[2]).toLowerCase();
      calls.push({ lang, term });
      if (!supported.has(lang)) {
        return new Response('unsupported locale', { status: 400 });
      }
      if (englishHits.has(term)) {
        return new Response(JSON.stringify([{ _id: 4242 }]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    // Compare the HOST, not a substring: 'static.arasaac.org' can appear
    // anywhere in a URL, so evil.example/static.arasaac.org would match.
    if (hostOf(url) === 'static.arasaac.org') {
      return new Response(new Blob([new Uint8Array([1, 2, 3])]), { status: 200 });
    }
    return new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal('caches', undefined);
  if (!('createObjectURL' in URL)) {
    // @ts-expect-error jsdom lacks createObjectURL
    URL.createObjectURL = () => 'blob:stub';
  }
});
afterEach(() => vi.unstubAllGlobals());

describe('ARASAAC — unsupported locale short-circuit', () => {
  it('asks the unsupported locale once, not once per token', async () => {
    const calls = installFetch(new Set(['en', 'es']), new Set());
    const { getPictogramUrl } = await import('@/services/pictogramService');

    for (const word of ['እኔ', 'አንተ', 'ውሃ', 'ራበኝ', 'ተጨማሪ']) {
      await getPictogramUrl(word, 'am', 'symbols');
    }

    const amCalls = calls.filter((c) => c.lang === 'am');
    expect(
      amCalls.length,
      `expected a single probe for the unsupported locale, got ${amCalls.length}`,
    ).toBe(1);
  });

  it('does not short-circuit a locale ARASAAC does support', async () => {
    const calls = installFetch(new Set(['en', 'es']), new Set());
    const { getPictogramUrl } = await import('@/services/pictogramService');

    await getPictogramUrl('agua', 'es', 'symbols');
    await getPictogramUrl('comida', 'es', 'symbols');

    expect(calls.filter((c) => c.lang === 'es').length).toBe(2);
  });
});

describe('ARASAAC — English source resolves the picture', () => {
  it('finds a pictogram for a Ge\'ez phrase via its English source', async () => {
    const calls = installFetch(new Set(['en', 'es']), new Set(['water']));
    const { getPictogramUrl } = await import('@/services/pictogramService');

    const url = await getPictogramUrl('ውሃ', 'am', 'symbols', 'Water');

    expect(url, 'Amharic tile should resolve via the English source').toBeTruthy();
    expect(calls.some((c) => c.lang === 'en' && c.term === 'water')).toBe(true);
  });

  it('helps Latin-script locales too, where the old fallback searched the foreign word', async () => {
    // Swahili is Latin, so the pre-existing isLatinToken path fired — but it
    // searched ARASAAC/en for "kiganja", which cannot match.
    const calls = installFetch(new Set(['en', 'es']), new Set(['hand']));
    const { getPictogramUrl } = await import('@/services/pictogramService');

    const url = await getPictogramUrl('Kiganja', 'sw', 'symbols', 'Hand');

    expect(url).toBeTruthy();
    expect(calls.some((c) => c.lang === 'en' && c.term === 'hand')).toBe(true);
  });

  it('returns null rather than a wrong picture when there is no English source', async () => {
    const calls = installFetch(new Set(['en', 'es']), new Set(['water']));
    const { getPictogramUrl } = await import('@/services/pictogramService');

    const url = await getPictogramUrl('ውሃ', 'am', 'symbols');

    expect(url).toBeNull();
    // Must NOT have guessed by throwing the Ge'ez token at the English index.
    expect(calls.some((c) => c.lang === 'en' && /[ሀ-፿]/.test(c.term))).toBe(false);
  });
});

describe('ARASAAC — concurrency', () => {
  it('still probes once when callers fire in parallel', async () => {
    // The sequential test above passed while the running app still issued
    // several 400s: the unsupported-set is only consulted after a response
    // lands, so parallel callers all clear the check first. The prediction bar
    // and the precache pass do exactly this. Reproduces that shape.
    const calls = installFetch(new Set(['en', 'es']), new Set());
    const { getPictogramUrl } = await import('@/services/pictogramService');

    await Promise.all(
      ['እኔ', 'አንተ', 'ውሃ', 'ራበኝ', 'ተጨማሪ', 'ርዳኝ', 'አመመኝ', 'እግር'].map((w) =>
        getPictogramUrl(w, 'am', 'symbols'),
      ),
    );

    const amCalls = calls.filter((c) => c.lang === 'am');
    expect(
      amCalls.length,
      `parallel callers should share one probe, got ${amCalls.length}`,
    ).toBe(1);
  });
});
