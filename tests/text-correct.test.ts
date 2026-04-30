/**
 * Auto-correction unit tests — service contract only.
 *
 * Live integration tests (real Synalux portal + local prism-coder:7b)
 * live in `tests/text-correct.integration.test.ts` under the node test
 * environment. This file stays in jsdom env and mocks fetch.
 *
 * Run unit suite:           npm test
 * Run live + offline:       RUN_LIVE_CORRECT=1 RUN_LOCAL_CORRECT=1 npm test text-correct
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('correctText (unit)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('returns input unchanged when text is too short to bother', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await import('../services/textCorrectService');
    expect(await correctText('hi', 'en')).toBe('hi');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the corrected text from the endpoint and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ corrected: 'bowl of rice', original: 'bowlofrice', changed: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await import('../services/textCorrectService');
    const out1 = await correctText('bowlofrice', 'en');
    const out2 = await correctText('bowlofrice', 'en');
    expect(out1).toBe('bowl of rice');
    expect(out2).toBe('bowl of rice');
    // Second call hits cache, not the network.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent in-flight requests for the same input', async () => {
    let resolveFn: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveFn = (v) => resolve({ ok: true, json: async () => v });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await import('../services/textCorrectService');
    const a = correctText('bowlof,ri', 'en');
    const b = correctText('bowlof,ri', 'en');
    resolveFn?.({ corrected: 'bowl of rice', original: 'bowlof,ri', changed: true });
    const [r1, r2] = await Promise.all([a, b]);
    expect(r1).toBe('bowl of rice');
    expect(r2).toBe('bowl of rice');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original text when both portal and local fail', async () => {
    // Simulates fully offline — portal unreachable AND local Ollama not running.
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await import('../services/textCorrectService');
    const out = await correctText('helloworld', 'en');
    expect(out).toBe('helloworld');
  });

  it('falls back to original on non-200 response from both stages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await import('../services/textCorrectService');
    const out = await correctText('helloworld', 'en');
    expect(out).toBe('helloworld');
  });

  it('falls back to local Ollama when the portal returns a non-corrected result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ corrected: '', changed: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'bowl of rice' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await import('../services/textCorrectService');
    const out = await correctText('bowirice', 'en');
    expect(out).toBe('bowl of rice');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Second call must be the local Ollama URL.
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain('11434');
  });
});
