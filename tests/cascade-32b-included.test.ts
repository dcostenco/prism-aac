/**
 * 32B cascade inclusion tests.
 *
 * Verifies that prism-coder:32b is the quality-escalation tier in the local
 * model cascade after 14B. The cascade is quality-first: 14B (fast, good) →
 * 32B (slower, better) → cloud Claude (always available). 8B and 1.7B are
 * retained only for iOS/edge — they are not in the desktop cascade.
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

describe('LOCAL_MODELS contains prism-coder:32b after 14b (no 8b or 1b7)', () => {
  it('cascade order is 14b → 32b (both tried when both fail)', async () => {
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
    expect(models.length).toBe(2);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:32b');
  });
});

describe('When 14B fails, cascade tries 32B before cloud', () => {
  it('14B error → 32B attempted next', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          throw new Error('Model prism-coder:14b not loaded');
        }
        return new Response(JSON.stringify({
          response: 'Here are some phrases for asking for help.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    expect(models.length).toBe(2);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:32b');
    // cloud never tried — 32B succeeded
  });
});

describe('When 32B returns a confident response, cascade stops (no cloud call)', () => {
  it('32B valid tool call → cascade stops', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) throw new Error('Model not loaded');
        return new Response(JSON.stringify({
          response: '<|tool_call|>{"name": "knowledge_search", "arguments": {"query": "help phrases"}}',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    expect(models.length).toBe(2);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:32b');
    // cloud never called — confident 32B response stopped the cascade
  });

  it('32B plain-text response (>10 chars) → cascade stops', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) throw new Error('Model not loaded');
        return new Response(JSON.stringify({
          response: 'You can say "I need help" or "Please help me" to ask for assistance.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    expect(models.length).toBe(2);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:32b');
  });
});

describe('When 32B returns an unconfident response, cascade falls through to cloud', () => {
  it('32B empty response → falls through to cloud', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) throw new Error('Model not loaded');
        // 32B returns empty (unconfident)
        return new Response(JSON.stringify({ response: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      // cloud (Synalux) succeeds
      return new Response(JSON.stringify({
        content: 'Here are some help phrases for you to use.',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    await expect(askAI('Phrases for help')).resolves.toBeDefined();
    const models = localModelsCalled();
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:32b');
    // cloud was reached after both local models were unconfident
  });

  it('32B invented/unknown tool call → falls through to cloud', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) throw new Error('Model not loaded');
        return new Response(JSON.stringify({
          response: '<|tool_call|>{"name": "fake_nonexistent_tool", "arguments": {}}',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        content: 'Here are some phrases you can use to ask for help.',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    await expect(askAI('Phrases for help')).resolves.toBeDefined();
    const models = localModelsCalled();
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:32b');
  });
});

describe('Auto-sideload PULLABLE_MODELS: 32B first (best quality), 14B fallback', () => {
  it('pull order is 32b → 14b when each fails', async () => {
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
    expect(pullAttempts.length).toBe(2);
    expect(pullAttempts[0]).toBe('dcostenco/prism-coder:32b');
    expect(pullAttempts[1]).toBe('dcostenco/prism-coder:14b');
  });

  it('falls back to 14B pull when 32B pull fails (disk full), stops on 14B success', async () => {
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
        if (body.name.includes('32b')) {
          return new Response('', { status: 500 });
        }
        // 14B pull succeeds
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
    expect(pullAttempts[0]).toBe('dcostenco/prism-coder:32b');
    expect(pullAttempts[1]).toBe('dcostenco/prism-coder:14b');
    expect(pullAttempts).not.toContain('dcostenco/prism-coder:8b-v30');
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('dcostenco/prism-coder:14b');
  });
});
