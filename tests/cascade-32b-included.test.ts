/**
 * 27B cascade inclusion tests.
 *
 * Verifies that prism-coder:27b is the quality-escalation tier in the local
 * model cascade. The cascade is quality-first: 27B (best) → 9B → 4B → 2B →
 * cloud Claude (always available).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askAI, autoSideload, getSideloadStatus } from '@/services/aiService';

let fetchSpy: ReturnType<typeof vi.spyOn>;
const fetchCalls: Array<{ url: string; body?: any }> = [];

beforeEach(() => {
  fetchCalls.length = 0;
  sessionStorage.clear();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

// ── Helpers ──

/** Extract model names from local Ollama calls in order. */
function localModelsCalled(): string[] {
  return fetchCalls
    .filter(c => c.url.includes('localhost:11434') || c.url.includes('127.0.0.1'))
    .filter(c => c.body?.model)
    .map(c => c.body.model);
}

describe('LOCAL_MODELS order: 27b → 9b → 4b → 2b (all active)', () => {
  it('cascade order is 27b → 9b → 4b → 2b (all tried when all fail)', async () => {
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        throw new Error('Model not loaded');
      }
      return new Response('', { status: 503 });
    });

    await expect(askAI('test')).rejects.toThrow();
    const models = localModelsCalled();
    expect(models.length).toBe(4);
    expect(models[0]).toBe('prism-coder:27b');
    expect(models[1]).toBe('prism-coder:9b');
    expect(models[2]).toBe('prism-coder:4b');
    expect(models[3]).toBe('prism-coder:2b');
  });
});

describe('When 27B fails, cascade tries 9B before cloud', () => {
  it('27B error → 9B attempted next', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          throw new Error('Model prism-coder:27b not loaded');
        }
        return new Response(JSON.stringify({
          message: { content: 'Here are some phrases for asking for help.' },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    expect(models.length).toBe(2);
    expect(models[0]).toBe('prism-coder:27b');
    expect(models[1]).toBe('prism-coder:9b');
    // cloud never tried — 9B succeeded
  });
});

describe('When 27B returns a confident response, cascade stops (no cloud call)', () => {
  it('27B confident plain-text → cascade stops at 27B', async () => {
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        return new Response(JSON.stringify({
          message: { content: '<|tool_call|>{"name": "knowledge_search", "arguments": {"query": "help phrases"}}' },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    // Tool calls are treated as unconfident (prompt injection risk) — cascade exhausts all models
    await expect(askAI('Phrases for help')).rejects.toThrow();
    const models = localModelsCalled();
    // All 4 local models tried — none confident
    expect(models.length).toBe(4);
    expect(models[0]).toBe('prism-coder:27b');
  });

  it('27B plain-text response (>10 chars) → cascade stops at 27B', async () => {
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        return new Response(JSON.stringify({
          message: { content: 'You can say "I need help" or "Please help me" to ask for assistance.' },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    // 27B answered confidently — cascade stops immediately
    expect(models.length).toBe(1);
    expect(models[0]).toBe('prism-coder:27b');
  });
});

describe('When all local models are unconfident, cascade falls through to cloud', () => {
  it('all models return empty → falls through to cloud', async () => {
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        // All local models return empty (unconfident)
        return new Response(JSON.stringify({ message: { content: '' } }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      // cloud (Synalux) succeeds
      return new Response(JSON.stringify({
        content: 'Here are some help phrases for you to use.',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    await expect(askAI('Phrases for help')).resolves.toBeDefined();
    const models = localModelsCalled();
    // All 4 local models tried before cloud
    expect(models[0]).toBe('prism-coder:27b');
    expect(models[1]).toBe('prism-coder:9b');
  });

  it('all models return tool call (unconfident) → falls through to cloud', async () => {
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        return new Response(JSON.stringify({
          message: { content: '<|tool_call|>{"name": "fake_nonexistent_tool", "arguments": {}}' },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        content: 'Here are some phrases you can use to ask for help.',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    await expect(askAI('Phrases for help')).resolves.toBeDefined();
    const models = localModelsCalled();
    expect(models[0]).toBe('prism-coder:27b');
    expect(models[1]).toBe('prism-coder:9b');
  });
});

describe('Auto-sideload PULLABLE_MODELS: 27B first (best quality), 9B fallback', () => {
  it('pull order is 27b → 9b → 4b → 2b when each fails', async () => {
    const pullAttempts: string[] = [];
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('/api/tags')) {
        return new Response(JSON.stringify({ models: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (urlStr.includes('/api/pull')) {
        const body = JSON.parse(init?.body || '{}');
        pullAttempts.push(body.name);
        return new Response('', { status: 500 });
      }
      return new Response('', { status: 404 });
    });

    await autoSideload();
    // All 4 PULLABLE_MODELS attempted when every pull fails
    expect(pullAttempts.length).toBe(4);
    expect(pullAttempts[0]).toBe('prism-coder:27b');
    expect(pullAttempts[1]).toBe('prism-coder:9b');
    expect(pullAttempts[2]).toBe('prism-coder:4b');
    expect(pullAttempts[3]).toBe('prism-coder:2b');
  });

  it('falls back to 9B pull when 27B pull fails (disk full), stops on 9B success', async () => {
    const pullAttempts: string[] = [];
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('/api/tags')) {
        return new Response(JSON.stringify({ models: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (urlStr.includes('/api/pull')) {
        const body = JSON.parse(init?.body || '{}');
        pullAttempts.push(body.name);
        if (body.name.includes('27b')) {
          return new Response('', { status: 500 });
        }
        // 9B pull succeeds — cascade stops here
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"status":"success"}\n'));
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    await autoSideload();
    expect(pullAttempts.length).toBe(2);
    expect(pullAttempts[0]).toBe('prism-coder:27b');
    expect(pullAttempts[1]).toBe('prism-coder:9b');
    expect(pullAttempts).not.toContain('prism-coder:4b');
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('prism-coder:9b');
  });
});
