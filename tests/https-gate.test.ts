/**
 * HTTPS-gate regression tests — pins the May 2026 fix that suppresses
 * the http://localhost:11434 (Ollama) probe + call when prism-aac is
 * served over HTTPS. Without the gate the browser blocks the request
 * as mixed content and the failed fetch surfaces in the user's
 * console as a security error even though we catch it.
 * October 2026: the gate opens only for Chrome/Edge/Firefox users who
 * connected Ollama in Settings → Local AI Models (see the last block).
 *
 * Two surfaces:
 *   • services/localModel.ts → isLocalModelAvailable() short-circuits
 *     to `false` on HTTPS without calling fetch.
 *   • services/aiService.ts → callLocal() throws "HTTPS page cannot
 *     reach http://localhost" before fetch.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const origLocation = window.location;

function setProtocol(protocol: 'http:' | 'https:') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...origLocation, protocol },
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: origLocation,
  });
});

describe('localModel HTTPS gate', () => {
  it('returns false on HTTPS WITHOUT calling fetch', async () => {
    setProtocol('https:');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'));

    const mod = await import('@/services/localModel');
    const result = await mod.isLocalModelAvailable();

    expect(result).toBe(false);
    // Critical: fetch must NOT have been called — the whole point is
    // suppressing the mixed-content console error.
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('still attempts fetch on http: (dev / local standalone)', async () => {
    setProtocol('http:');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ models: [] }), { status: 200 }),
    );

    const mod = await import('@/services/localModel');
    await mod.isLocalModelAvailable();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:11434/api/tags'),
      expect.any(Object),
    );

    fetchSpy.mockRestore();
  });

  it('returns true when http: + Ollama lists prism-coder model', async () => {
    setProtocol('http:');
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        models: [{ name: 'prism-coder:14b' }, { name: 'llama3:8b' }],
      }), { status: 200 }),
    );

    const mod = await import('@/services/localModel');
    expect(await mod.isLocalModelAvailable()).toBe(true);
  });

  it('returns false when http: + Ollama has no prism-coder', async () => {
    setProtocol('http:');
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'llama3:8b' }] }), { status: 200 }),
    );

    const mod = await import('@/services/localModel');
    expect(await mod.isLocalModelAvailable()).toBe(false);
  });
});

// October 2026: the gate opens on https only for Chrome/Edge/Firefox users who
// connected Ollama in Settings → Local AI Models (opt-in flag). Safari/WebKit and
// the iOS app never probe; everyone else keeps the May 2026 no-fetch behaviour.
describe('localModel HTTPS gate — opted-in users', () => {
  const origUA = navigator.userAgent;
  const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
  const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const setUA = (ua: string) => Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: ua });

  afterEach(() => {
    setUA(origUA);
    localStorage.clear();
    delete (window as unknown as { prismNativeBridge?: unknown }).prismNativeBridge;
  });

  async function probeWith(ua: string, optedIn: boolean, bridge = false) {
    setProtocol('https:');
    setUA(ua);
    if (optedIn) localStorage.setItem('prism-aac-local-ai-connected', '1');
    if (bridge) (window as unknown as { prismNativeBridge?: unknown }).prismNativeBridge = {};
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'prism-coder:8b' }] }), { status: 200 }),
    );
    const mod = await import('@/services/localModel');
    const result = await mod.isLocalModelAvailable();
    const called = fetchSpy.mock.calls.length > 0;
    fetchSpy.mockRestore();
    return { result, called };
  }

  it('Chrome + opted in → probes and uses local Ollama', async () => {
    expect(await probeWith(CHROME, true)).toEqual({ result: true, called: true });
  });
  it('Chrome without the opt-in → no fetch (unchanged May 2026 behaviour)', async () => {
    expect(await probeWith(CHROME, false)).toEqual({ result: false, called: false });
  });
  it('Safari + opted in → still no fetch (WebKit blocks http://localhost from https)', async () => {
    expect(await probeWith(SAFARI, true)).toEqual({ result: false, called: false });
  });
  it('iOS app + opted in → no fetch (it uses its built-in model)', async () => {
    expect(await probeWith(CHROME, true, true)).toEqual({ result: false, called: false });
  });
});

// (aiService.callLocalModel, aiService.ollamaReachable and gestureService.classifyViseme8B use the
// same canProbeInBackground gate as localModel.probeOllama; the gate itself is pinned in
// tests/local-ai-connect.test.ts. callLocal is private and askAI pulls in auth/roles preflight
// fetches, so it is exercised end-to-end by the live diagnostic harness in scripts/ instead.)
