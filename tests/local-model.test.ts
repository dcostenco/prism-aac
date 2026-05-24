/**
 * localModel — Ollama probe, caching, re-probe cooldown.
 *
 * Routing decisions (portal vs local) are cached for performance.  A stale
 * cache or a broken cooldown means every AAC prediction call either hits the
 * network unnecessarily OR misses a newly-available local model that the user
 * just installed.  The HTTPS guard prevents a console security error on
 * production deployments.
 *
 * Module-level state (probePromise, cachedResult, lastProbeTime) requires
 * vi.resetModules() + dynamic import to isolate tests from each other.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── module reset helpers ──────────────────────────────────────────────────────

type LocalModelMod = typeof import('@/services/localModel');

async function freshModule(): Promise<LocalModelMod> {
  vi.resetModules();
  return import('@/services/localModel');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  // Reset location protocol to http (default for local dev)
  Object.defineProperty(window, 'location', {
    value: { protocol: 'http:' },
    writable: true,
    configurable: true,
  });
});

// ── getLocalModelStatus initial state ─────────────────────────────────────────

describe('getLocalModelStatus', () => {
  it('returns null before any probe', async () => {
    const { getLocalModelStatus } = await freshModule();
    expect(getLocalModelStatus()).toBeNull();
  });
});

// ── HTTPS guard ────────────────────────────────────────────────────────────────

describe('isLocalModelAvailable — HTTPS guard', () => {
  it('returns false immediately on https without calling fetch', async () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:' },
      writable: true,
      configurable: true,
    });
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { isLocalModelAvailable } = await freshModule();
    const result = await isLocalModelAvailable();
    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── successful probe ───────────────────────────────────────────────────────────

describe('isLocalModelAvailable — successful probe', () => {
  it('returns true when prism-coder model is listed in Ollama tags', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'prism-coder:14b' }] }),
    } as Response);
    const { isLocalModelAvailable } = await freshModule();
    expect(await isLocalModelAvailable()).toBe(true);
  });

  it('returns false when no prism-coder model is listed', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3:latest' }, { name: 'mistral:7b' }] }),
    } as Response);
    const { isLocalModelAvailable } = await freshModule();
    expect(await isLocalModelAvailable()).toBe(false);
  });

  it('returns false when Ollama returns a non-ok HTTP status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);
    const { isLocalModelAvailable } = await freshModule();
    expect(await isLocalModelAvailable()).toBe(false);
  });

  it('returns false when fetch throws (network error)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { isLocalModelAvailable } = await freshModule();
    expect(await isLocalModelAvailable()).toBe(false);
  });

  it('updates getLocalModelStatus to true on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'prism-coder:14b' }] }),
    } as Response);
    const { isLocalModelAvailable, getLocalModelStatus } = await freshModule();
    await isLocalModelAvailable();
    expect(getLocalModelStatus()).toBe(true);
  });

  it('updates getLocalModelStatus to false on failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('no server'));
    const { isLocalModelAvailable, getLocalModelStatus } = await freshModule();
    await isLocalModelAvailable();
    expect(getLocalModelStatus()).toBe(false);
  });
});

// ── caching — positive result ─────────────────────────────────────────────────

describe('isLocalModelAvailable — positive result caching', () => {
  it('does not re-probe on second call when cached true', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'prism-coder:14b' }] }),
      } as Response);
    const { isLocalModelAvailable } = await freshModule();
    await isLocalModelAvailable();
    await isLocalModelAvailable(); // second call
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still only one fetch
  });
});

// ── caching — negative cooldown ───────────────────────────────────────────────

describe('isLocalModelAvailable — negative result cooldown', () => {
  it('returns cached false within 30s cooldown without re-probing', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('no server'));
    const { isLocalModelAvailable } = await freshModule();

    await isLocalModelAvailable(); // first probe → false
    vi.advanceTimersByTime(15_000); // 15s — still within cooldown
    await isLocalModelAvailable(); // second call within cooldown
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('re-probes after cooldown expires (30s+)', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('no server'));
    const { isLocalModelAvailable } = await freshModule();

    await isLocalModelAvailable(); // first probe
    vi.advanceTimersByTime(31_000); // past cooldown
    // Next call should trigger a new probe
    const p = isLocalModelAvailable();
    vi.runAllTimers();
    await p;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ── concurrent probes ─────────────────────────────────────────────────────────

describe('isLocalModelAvailable — concurrent call deduplication', () => {
  it('two simultaneous calls share a single fetch', async () => {
    let resolveFetch!: (v: Response) => void;
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockReturnValue(new Promise<Response>(r => { resolveFetch = r; }));

    const { isLocalModelAvailable } = await freshModule();
    const p1 = isLocalModelAvailable();
    const p2 = isLocalModelAvailable(); // concurrent

    resolveFetch({
      ok: true,
      json: async () => ({ models: [{ name: 'prism-coder:14b' }] }),
    } as Response);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ── exported constants ────────────────────────────────────────────────────────

describe('localModel exports', () => {
  it('LOCAL_OLLAMA_URL points to localhost:11434 generate endpoint', async () => {
    const { LOCAL_OLLAMA_URL } = await freshModule();
    expect(LOCAL_OLLAMA_URL).toContain('localhost:11434');
    expect(LOCAL_OLLAMA_URL).toContain('generate');
  });

  it('LOCAL_MODEL is a prism-coder model name', async () => {
    const { LOCAL_MODEL } = await freshModule();
    expect(LOCAL_MODEL).toMatch(/^prism-coder:/);
  });
});
