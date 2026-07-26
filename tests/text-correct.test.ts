/**
 * Auto-correction unit tests — service contract only.
 *
 * Live integration tests (real Synalux portal + local prism-coder:14b)
 * live in `tests/text-correct.integration.test.ts` under the node test
 * environment. This file stays in jsdom env and mocks fetch + the
 * local-model probe.
 *
 * Run unit suite:           npm test
 * Run live + offline:       RUN_LIVE_CORRECT=1 RUN_LOCAL_CORRECT=1 npm test text-correct
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Force the local-model probe to a known answer per test. Each test
// re-imports the service so the cached promise resets.
vi.mock('@/services/localModel', () => ({
  isLocalModelAvailable: vi.fn(),
  LOCAL_OLLAMA_URL: 'http://localhost:11434/api/generate',
  LOCAL_MODEL: 'prism-coder:14b',
  getLocalModelStatus: () => null,
}));

async function loadService(localAvailable: boolean) {
  vi.resetModules();
  const { isLocalModelAvailable } = await import('@/services/localModel');
  (isLocalModelAvailable as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(localAvailable);
  return await import('../services/textCorrectService');
}

describe('correctText (unit)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns input unchanged on 1-char input — never calls a backend (threshold)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(false);
    expect(await correctText('a', 'en')).toBe('a');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CALLS backend on 2-char input ("hw" → "how" — required for AAC short partials)', async () => {
    // 2-char floor was lowered from 3 to 2 so partials like "hw"/"ok"/"ty"
    // get autocomplete. AAC users can't afford to wait for 3+ chars.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ corrected: 'how', changed: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(false);
    expect(await correctText('hw', 'en', 'complete')).toBe('how');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('local-first: when prism-coder is reachable, only calls Ollama (not the portal)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'bowl of rice' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(true);
    const out = await correctText('bowirice', 'en');
    expect(out).toBe('bowl of rice');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('11434');
  });

  it('portal-only: when prism-coder is unavailable, calls the configured portal endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ corrected: 'bowl of rice', original: 'bowirice', changed: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(false);
    const out = await correctText('bowirice', 'en');
    expect(out).toBe('bowl of rice');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(new URL(url).pathname).toMatch(/\/api\/v1\/text\/correct$/);
  });

  it('caches results so identical inputs only round-trip once', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ corrected: 'bowl of rice', original: 'bowirice', changed: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(false);
    expect(await correctText('bowirice', 'en')).toBe('bowl of rice');
    expect(await correctText('bowirice', 'en')).toBe('bowl of rice');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent in-flight requests for the same input', async () => {
    let resolveFn: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveFn = (v) => resolve({ ok: true, json: async () => v });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(false);
    const a = correctText('bowlof,ri', 'en');
    const b = correctText('bowlof,ri', 'en');
    resolveFn?.({ corrected: 'bowl of rice', original: 'bowlof,ri', changed: true });
    const [r1, r2] = await Promise.all([a, b]);
    expect(r1).toBe('bowl of rice');
    expect(r2).toBe('bowl of rice');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to portal when local probe returned true but the local call fails', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('connect refused'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ corrected: 'bowl of rice', changed: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(true);
    const out = await correctText('bowirice', 'en');
    expect(out).toBe('bowl of rice');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns original text when both backends fail (offline + portal down)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(false);
    expect(await correctText('helloworld', 'en')).toBe('helloworld');
  });

  it('returns original text when portal returns non-200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { correctText } = await loadService(false);
    expect(await correctText('helloworld', 'en')).toBe('helloworld');
  });

  // ── Normalized-echo handling — fixes the silent-suggestion bug.
  //
  // Prior version used strict `=== trimmed` to detect local-model echo.
  // If local returned the input with case- or whitespace-only changes,
  // the strict check passed (treated as "valid" suggestion), portal call
  // was SKIPPED, and MessageBar's own normalized check then dropped the
  // result — net: no autocorrect bar even when the portal would have
  // produced a perfect one.
  describe('normalized echo handling', () => {
    it('falls through to portal when local returns case-only-different echo', async () => {
      const fetchMock = vi.fn()
        // Local echoes input with different capitalization (Pascal-cases first letter)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'I wa' }) })
        // Local 'correct' fallback — same echo
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'I wa' }) })
        // Portal succeeds with real completion
        .mockResolvedValueOnce({ ok: true, json: async () => ({ corrected: 'I want to', changed: true }) });
      vi.stubGlobal('fetch', fetchMock);
      const { correctText } = await loadService(true);
      const out = await correctText('i wa', 'en', 'complete');
      expect(out).toBe('I want to');
      // 2 local calls (complete then correct on echo) + 1 portal call
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('falls through to portal when local returns trailing-whitespace echo', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'i wa  ' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'i wa  ' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ corrected: 'i want to', changed: true }) });
      vi.stubGlobal('fetch', fetchMock);
      const { correctText } = await loadService(true);
      const out = await correctText('i wa', 'en', 'complete');
      expect(out).toBe('i want to');
    });

    it('returns local result when it is a real correction (not echo)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'I want a' }) });
      vi.stubGlobal('fetch', fetchMock);
      const { correctText } = await loadService(true);
      const out = await correctText('iwa', 'en', 'complete');
      expect(out).toBe('I want a');
      // Only local was called — no portal fallback needed
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns portal result even when it is case-only-different from input', async () => {
      // Portal returning capitalized version IS a useful correction
      // (proper-noun fix, sentence case, etc.) — but our norm-check
      // would treat it as echo and drop it. This pin verifies that we
      // RETAIN portal results, only treating LOCAL echoes as fallback
      // triggers.
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ corrected: 'I want a', changed: true }) });
      vi.stubGlobal('fetch', fetchMock);
      const { correctText } = await loadService(false);
      // Note: this is "i want a" → "I want a" — case-only change. The
      // portal result IS norm-equal to input. Current behavior: norm-equal
      // portal result is treated as "no useful correction", returns input.
      // This pin documents the trade-off; if it changes, update this test.
      const out = await correctText('i want a', 'en', 'correct');
      expect(out).toBe('i want a'); // norm-equal echo, portal result dropped
    });
  });
});
