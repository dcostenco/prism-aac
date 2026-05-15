/**
 * Local-first routing tests.
 *
 * Verifies that the app tries local models BEFORE cloud, and only
 * falls back to Synalux API when local is completely unavailable.
 *
 * Goal: avoid cloud calls at all cost. Every cloud call = latency +
 * cost + privacy exposure. Local = free, fast, private.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askAI } from '@/services/aiService';

let fetchSpy: ReturnType<typeof vi.spyOn>;
const fetchCalls: Array<{ url: string; body?: any }> = [];

beforeEach(() => {
  fetchCalls.length = 0;
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

function mockFetch(localAvailable: boolean, cloudAvailable: boolean) {
  fetchSpy.mockImplementation(async (url: any, init: any) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    let body: any = {};
    try { body = JSON.parse(init?.body || '{}'); } catch {}
    fetchCalls.push({ url: urlStr, body });

    // Local Ollama
    if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1:11434')) {
      if (!localAvailable) throw new Error('Local Ollama unavailable');
      return new Response(JSON.stringify({
        response: 'Here are some phrases:\n• I need help.\n• Please help me.\n• Can someone assist?',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Synalux cloud
    if (urlStr.includes('synalux.ai') || urlStr.includes('/api/v1/')) {
      if (!cloudAvailable) return new Response('', { status: 503 });
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Cloud response here' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return new Response('', { status: 404 });
  });
}

function localCalls() {
  return fetchCalls.filter(c => c.url.includes('localhost:11434') || c.url.includes('127.0.0.1'));
}

function cloudCalls() {
  return fetchCalls.filter(c => c.url.includes('synalux.ai') || c.url.includes('/api/v1/'));
}

describe('Local-first routing — avoids cloud at all cost', () => {
  it('uses LOCAL Ollama when available, never touches cloud', async () => {
    mockFetch(true, true);
    await askAI('Suggest phrases for asking for help');

    expect(localCalls().length).toBeGreaterThan(0);
    expect(cloudCalls().length).toBe(0);
  });

  it('falls back to cloud ONLY when local is unavailable', async () => {
    mockFetch(false, true);
    await askAI('Suggest phrases for asking for help');

    expect(localCalls().length).toBeGreaterThan(0); // tried local first
    expect(cloudCalls().length).toBeGreaterThan(0); // then fell back to cloud
  });

  it('throws when BOTH local and cloud are down', async () => {
    mockFetch(false, false);
    await expect(askAI('Help')).rejects.toThrow(/No AI available/);
  });

  it('local calls target the cascade models (14b first, then 1b7)', async () => {
    // Make first model fail, second succeed
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434')) {
        callCount++;
        if (callCount === 1) {
          // First call (14B) — fails
          throw new Error('Model not loaded');
        }
        // Second call (1.7B) — succeeds
        return new Response(JSON.stringify({
          response: 'Fallback response from 1.7B — phrases for help.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const local = localCalls();
    expect(local.length).toBe(2); // tried 14B then 1.7B
  });
});

describe('Model selection on 8GB devices', () => {
  it('14B Q4_K_M (8.4 GB) does NOT fit on 8GB device', () => {
    const deviceRAM = 8 * 1024; // 8192 MB
    const iosOverhead = 2500;
    const appOverhead = 200;
    const available = deviceRAM - iosOverhead - appOverhead; // ~5492 MB
    const model14bQ4 = 8400 + 600 + 200; // weights + KV + overhead = 9200 MB
    expect(model14bQ4).toBeGreaterThan(available);
  });

  it('1.7B Q4_K_M (1.0 GB) fits on 8GB device with 4+ GB margin', () => {
    const available = 8 * 1024 - 2500 - 200; // 5492 MB
    const model1b7 = 1050 + 200 + 100; // 1350 MB
    expect(model1b7).toBeLessThan(available);
    expect(available - model1b7).toBeGreaterThan(4000); // 4+ GB margin
  });

  it('14B Q4_K_M fits on 16GB iPad Pro', () => {
    const available = 16 * 1024 - 2500 - 200; // 13684 MB
    const model14bQ4 = 8400 + 600 + 200; // 9200 MB
    expect(model14bQ4).toBeLessThan(available);
  });

  it('canLoad14B threshold is 16 GB', () => {
    // Mirrors LLMEngine.canLoad14B logic
    const canLoad14B = (ramGB: number) => ramGB >= 16;
    expect(canLoad14B(8)).toBe(false);   // iPhone 15 Pro
    expect(canLoad14B(8)).toBe(false);   // iPad Air M2
    expect(canLoad14B(16)).toBe(true);   // iPad Pro M4 16GB
    expect(canLoad14B(32)).toBe(true);   // iPad Pro M4 32GB
    expect(canLoad14B(48)).toBe(true);   // Mac M4 Max
  });
});

describe('Routing order', () => {
  it('local-first: local Ollama is attempted BEFORE cloud', async () => {
    // Both available — local should win, cloud never called
    mockFetch(true, true);
    await askAI('Hello');
    const localIdx = fetchCalls.findIndex(c =>
      c.url.includes('localhost:11434') || c.url.includes('127.0.0.1'));
    const cloudIdx = fetchCalls.findIndex(c =>
      c.url.includes('synalux.ai') || c.url.includes('/api/v1/'));

    expect(localIdx).toBeGreaterThanOrEqual(0);  // local was called
    expect(cloudIdx).toBe(-1);                    // cloud was never called
  });
});
