/**
 * HTTPS-gate regression tests — pins the May 2026 fix that suppresses
 * the http://localhost:11434 (Ollama) probe + call when prism-aac is
 * served over HTTPS. Without the gate the browser blocks the request
 * as mixed content and the failed fetch surfaces in the user's
 * console as a security error even though we catch it.
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
        models: [{ name: 'prism-coder:7b' }, { name: 'llama3:8b' }],
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

// (aiService callLocal is gated identically to localModel.probeOllama —
// both check window.location.protocol === 'https:' before fetch. The
// localModel tests above pin the symmetric gate; aiService.callLocal
// is a private function exercised end-to-end by the live diagnostic
// harness in scripts/. A unit test through askAI was attempted but
// pulled in too many transitive fetches via auth/roles preflight,
// drowning the signal — keep the direct-gate test instead.)
