/**
 * 8B cascade inclusion tests.
 *
 * Verifies that prism-coder:8b-v29 is properly included in the local model
 * cascade between 14B and 1.7B, and in the auto-sideload PULLABLE_MODELS
 * list. The 8B model is the sweet spot for 8GB-RAM devices where 14B
 * doesn't fit but 1.7B is too weak.
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

describe('LOCAL_MODELS contains prism-coder:8b-v29 between 14b and 1b7', () => {
  it('cascade order is 14b → 8b → 1b7 (all three tried when all fail)', async () => {
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        // Every model fails — forces full cascade traversal
        throw new Error('Model not loaded');
      }
      // Cloud also fails so we can inspect all local attempts
      return new Response('', { status: 503 });
    });

    await expect(askAI('test')).rejects.toThrow();
    const models = localModelsCalled();
    expect(models.length).toBe(3);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:8b-v29');
    expect(models[2]).toBe('prism-coder:1b7');
  });
});

describe('When 14B fails, cascade tries 8B before 1.7B', () => {
  it('14B error → 8B attempted next (not 1.7B)', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          // 14B fails
          throw new Error('Model prism-coder:14b not loaded');
        }
        // 8B succeeds with a confident response (plain text >10 chars)
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
    expect(models[1]).toBe('prism-coder:8b-v29');
    // 1.7B never tried — 8B succeeded
  });
});

describe('When 8B returns a confident response, cascade stops (no 1.7B)', () => {
  it('8B valid tool call → cascade stops', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          // 14B fails
          throw new Error('Model not loaded');
        }
        // 8B returns a confident tool call
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
    expect(models[1]).toBe('prism-coder:8b-v29');
    // 1.7B never called — confident 8B response stopped the cascade
  });

  it('8B plain-text response (>10 chars) → cascade stops', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          // 14B fails
          throw new Error('Model not loaded');
        }
        // 8B returns confident plain text
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
    expect(models[1]).toBe('prism-coder:8b-v29');
    // No 1.7B call
  });
});

describe('When 8B returns an unconfident response, cascade falls through to 1.7B', () => {
  it('8B empty response → falls through to 1.7B', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          // 14B fails
          throw new Error('Model not loaded');
        }
        if (callCount === 2) {
          // 8B returns empty (unconfident)
          return new Response(JSON.stringify({
            response: '',
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        // 1.7B succeeds with confident response
        return new Response(JSON.stringify({
          response: 'Here are some help phrases for you to use.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    expect(models.length).toBe(3);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:8b-v29');
    expect(models[2]).toBe('prism-coder:1b7');
  });

  it('8B invented/unknown tool call → falls through to 1.7B', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          // 14B fails
          throw new Error('Model not loaded');
        }
        if (callCount === 2) {
          // 8B returns an invented tool (not in knownTools) — unconfident
          return new Response(JSON.stringify({
            response: '<|tool_call|>{"name": "fake_nonexistent_tool", "arguments": {}}',
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        // 1.7B succeeds
        return new Response(JSON.stringify({
          response: 'Here are some phrases you can use to ask for help.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    expect(models.length).toBe(3);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:8b-v29');
    expect(models[2]).toBe('prism-coder:1b7');
  });

  it('8B too-short response (<= 10 chars, no tool call) → falls through to 1.7B', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      let body: any = {};
      try { body = JSON.parse(init?.body || '{}'); } catch {}
      fetchCalls.push({ url: urlStr, body });

      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        if (callCount === 1) {
          // 14B fails
          throw new Error('Model not loaded');
        }
        if (callCount === 2) {
          // 8B returns a too-short response (not confident)
          return new Response(JSON.stringify({
            response: 'Hi',
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        // 1.7B succeeds
        return new Response(JSON.stringify({
          response: 'Here are some phrases you can use to ask for help.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    await askAI('Phrases for help');
    const models = localModelsCalled();
    expect(models.length).toBe(3);
    expect(models[0]).toBe('prism-coder:14b');
    expect(models[1]).toBe('prism-coder:8b-v29');
    expect(models[2]).toBe('prism-coder:1b7');
  });
});

describe('Auto-sideload PULLABLE_MODELS includes 8B between 14B and 1.7B', () => {
  it('pull order is 14b → 8b → 1b7 when each fails', async () => {
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
        // All pulls fail
        return new Response('', { status: 500 });
      }
      return new Response('', { status: 404 });
    });

    await autoSideload();
    expect(pullAttempts.length).toBe(3);
    expect(pullAttempts[0]).toBe('dcostenco/prism-coder:14b');
    expect(pullAttempts[1]).toBe('dcostenco/prism-coder:8b-v29');
    expect(pullAttempts[2]).toBe('dcostenco/prism-coder:1b7');
  });

  it('falls through to 8B pull when 14B pull fails, stops on 8B success', async () => {
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
        if (body.name.includes('14b')) {
          // 14B pull fails (disk full)
          return new Response('', { status: 500 });
        }
        // 8B pull succeeds
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
    expect(pullAttempts[0]).toBe('dcostenco/prism-coder:14b');
    expect(pullAttempts[1]).toBe('dcostenco/prism-coder:8b-v29');
    // 1.7B never attempted — 8B succeeded
    expect(pullAttempts).not.toContain('dcostenco/prism-coder:1b7');
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('dcostenco/prism-coder:8b-v29');
  });
});
