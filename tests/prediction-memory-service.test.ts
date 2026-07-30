/**
 * Prism AAC prediction-memory safety contract.
 *
 * Personalized next-word results may contain names, routines, or medical
 * vocabulary. They must be isolated to one authenticated/session scope,
 * validated as single words in the active language, and never become required
 * for deterministic/offline AAC composition.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const portalFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/portalClient', () => ({
  portalFetch: (request: unknown) => portalFetchMock(request),
}));

vi.mock('@/lib/langAllowlist', () => ({
  ensureLangCorpusLoaded: vi.fn(async () => undefined),
  isAllowedInLang: (word: string, language: string) => (
    language === 'en' ? word.toLowerCase() !== 'eu' : word.toLowerCase() !== 'need'
  ),
}));

const {
  clearPredictionMemoryCache,
  fetchMemoryPredictions,
  getPredictionSessionScope,
  rememberConfirmedPhrase,
  rotateAnonymousPredictionSessionScope,
  validateMemoryPredictionWords,
} = await import('@/services/predictionMemoryService');

beforeEach(() => {
  portalFetchMock.mockReset();
  clearPredictionMemoryCache();
  sessionStorage.clear();
});

describe('prediction memory response validation', () => {
  it('keeps at most five unique single words from the active language', () => {
    expect(validateMemoryPredictionWords([
      'need',
      ' need ',
      'two words',
      'eu',
      7,
      '',
      'water',
      'help',
      'home',
      'mom',
      'school',
    ], 'en')).toEqual(['need', 'water', 'help', 'home', 'mom']);
  });

  it('rejects malformed payloads without throwing', () => {
    expect(validateMemoryPredictionWords(null, 'en')).toEqual([]);
    expect(validateMemoryPredictionWords({ words: ['need'] }, 'en')).toEqual([]);
  });
});

describe('prediction memory account/session isolation', () => {
  it('uses stable normalized account scopes and rotatable anonymous tab scopes', () => {
    expect(getPredictionSessionScope(' AAC@Example.com ')).toBe('user:aac@example.com');
    const firstAnonymous = getPredictionSessionScope(null);
    expect(getPredictionSessionScope(null)).toBe(firstAnonymous);
    const rotated = rotateAnonymousPredictionSessionScope();
    expect(rotated).not.toBe(firstAnonymous);
    expect(getPredictionSessionScope(null)).toBe(rotated);
  });

  it('never serves User A cached words to User B for the same context', async () => {
    portalFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: { words: ['mom'] } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { words: ['grandma'] } });

    expect(await fetchMemoryPredictions('I need my ', 'en', {
      sessionScope: 'user:a@example.com',
    })).toEqual(['mom']);
    expect(await fetchMemoryPredictions('I need my ', 'en', {
      sessionScope: 'user:a@example.com',
    })).toEqual(['mom']);
    expect(await fetchMemoryPredictions('I need my ', 'en', {
      sessionScope: 'user:b@example.com',
    })).toEqual(['grandma']);
    expect(portalFetchMock).toHaveBeenCalledTimes(2);
  });

  it('auth clear invalidates cached and in-flight results', async () => {
    let resolveFirst!: (value: unknown) => void;
    portalFetchMock
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: true, status: 200, data: { words: ['grandma'] } });

    const stale = fetchMemoryPredictions('I need my ', 'en', {
      sessionScope: 'user:a@example.com',
    });
    await vi.waitFor(() => expect(portalFetchMock).toHaveBeenCalledOnce());
    clearPredictionMemoryCache();
    resolveFirst({ ok: true, status: 200, data: { words: ['mom'] } });
    expect(await stale).toEqual([]);

    expect(await fetchMemoryPredictions('I need my ', 'en', {
      sessionScope: 'user:a@example.com',
    })).toEqual(['grandma']);
    expect(portalFetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the same context isolated across languages', async () => {
    portalFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: { words: ['mom'] } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { words: ['eu'] } });

    expect(await fetchMemoryPredictions('I need my ', 'en', {
      sessionScope: 'user:a@example.com',
    })).toEqual(['mom']);
    expect(await fetchMemoryPredictions('I need my ', 'ro', {
      sessionScope: 'user:a@example.com',
    })).toEqual(['eu']);
    expect(await fetchMemoryPredictions('I need my ', 'en', {
      sessionScope: 'user:a@example.com',
    })).toEqual(['mom']);
    expect(portalFetchMock).toHaveBeenCalledTimes(2);
  });

  it('coalesces identical in-flight requests within one session scope', async () => {
    let resolveRequest!: (value: unknown) => void;
    portalFetchMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const first = fetchMemoryPredictions('I need ', 'en', {
      sessionScope: 'anon:tab-1',
    });
    const second = fetchMemoryPredictions('I need ', 'en', {
      sessionScope: 'anon:tab-1',
    });
    await vi.waitFor(() => expect(portalFetchMock).toHaveBeenCalledOnce());

    resolveRequest({ ok: true, status: 200, data: { words: ['help'] } });
    expect(await first).toEqual(['help']);
    expect(await second).toEqual(['help']);
  });

  it('does not cache an empty or invalid model answer', async () => {
    portalFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: { words: [] } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { words: ['help'] } });

    expect(await fetchMemoryPredictions('I need ', 'en', {
      sessionScope: 'anon:tab-1',
    })).toEqual([]);
    expect(await fetchMemoryPredictions('I need ', 'en', {
      sessionScope: 'anon:tab-1',
    })).toEqual(['help']);
    expect(portalFetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('prediction memory transport and explicit learning', () => {
  it('forwards a cancellation signal and fails open on portal errors', async () => {
    portalFetchMock.mockResolvedValueOnce({ ok: false, status: 503, error: 'offline' });
    const controller = new AbortController();

    expect(await fetchMemoryPredictions('I need ', 'en', {
      sessionScope: 'anon:tab-1',
      signal: controller.signal,
    })).toEqual([]);
    expect(portalFetchMock).toHaveBeenCalledWith(expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it('does not start a request with an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    expect(await fetchMemoryPredictions('I need ', 'en', {
      sessionScope: 'anon:tab-1',
      signal: controller.signal,
    })).toEqual([]);
    expect(portalFetchMock).not.toHaveBeenCalled();
  });

  it('caps cloud prediction to six requests per session scope each minute', async () => {
    portalFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { words: ['help'] },
    });

    for (let index = 0; index < 6; index += 1) {
      expect(await fetchMemoryPredictions(`I need context ${index}`, 'en', {
        sessionScope: 'user:a@example.com',
      })).toEqual(['help']);
    }
    expect(await fetchMemoryPredictions('I need context blocked', 'en', {
      sessionScope: 'user:a@example.com',
    })).toEqual([]);
    expect(portalFetchMock).toHaveBeenCalledTimes(6);
  });

  it('writes only multi-word phrases explicitly confirmed by the user', async () => {
    portalFetchMock.mockResolvedValue({ ok: true, status: 201, data: {} });

    expect(await rememberConfirmedPhrase('help', 'en')).toBe(false);
    expect(portalFetchMock).not.toHaveBeenCalled();

    expect(await rememberConfirmedPhrase('I need help', 'en')).toBe(true);
    expect(portalFetchMock).toHaveBeenCalledWith(expect.objectContaining({
      path: '/prism-aac/memory',
      method: 'POST',
      body: {
        type: 'phrase',
        content: 'I need help',
        metadata: {
          language: 'en',
          confirmation: 'explicit',
        },
      },
    }));
  });
});
