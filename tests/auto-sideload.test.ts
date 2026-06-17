/**
 * Auto-sideload unit tests.
 *
 * Verifies that the web app automatically detects Ollama and pulls
 * the best prism-coder model — avoiding cloud calls at all cost.
 *
 * Pull priority: 27B first (best quality), 9B fallback (fits more devices).
 * Local cascade: 27B → 9B → 4B → 2B → cloud Claude.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autoSideload, getSideloadStatus, askAI } from '@/services/aiService';

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

describe('autoSideload', () => {
  it('does nothing when Ollama is not reachable', async () => {
    fetchSpy.mockImplementation(async () => { throw new Error('Connection refused'); });
    await autoSideload();
    expect(getSideloadStatus().state).toBe('idle');
  });

  it('skips pull if a prism-coder model is already installed', async () => {
    fetchSpy.mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      fetchCalls.push({ url: urlStr });
      if (urlStr.includes('/api/tags')) {
        return new Response(JSON.stringify({
          models: [{ name: 'dcostenco/prism-coder:9b' }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 404 });
    });

    await autoSideload();
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('already installed');
    // No /api/pull call
    expect(fetchCalls.every(c => !c.url.includes('/api/pull'))).toBe(true);
  });

  it('pulls 27B first (best quality) when Ollama is online and no model installed', async () => {
    let pullTag = '';
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      fetchCalls.push({ url: urlStr });

      if (urlStr.includes('/api/tags')) {
        return new Response(JSON.stringify({ models: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (urlStr.includes('/api/pull')) {
        const body = JSON.parse(init?.body || '{}');
        pullTag = body.name;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"status":"success"}\n'));
            controller.close();
          }
        });
        return new Response(stream, { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    await autoSideload();
    expect(pullTag).toBe('prism-coder:27b');
    expect(getSideloadStatus().state).toBe('done');
  });

  it('does not re-pull on second call (session cached)', async () => {
    sessionStorage.setItem('prism-aac-sideload-status', 'done');
    fetchSpy.mockImplementation(async () => new Response('', { status: 200 }));

    await autoSideload();
    expect(fetchCalls.length).toBe(0);
  });

  it('falls through to 9B if 27B pull fails (low disk)', async () => {
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
          return new Response('', { status: 500 }); // 27B fails — disk full
        }
        // 9B succeeds
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"status":"success"}\n'));
            controller.close();
          }
        });
        return new Response(stream, { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    await autoSideload();
    expect(pullAttempts[0]).toBe('prism-coder:27b');
    expect(pullAttempts[1]).toBe('prism-coder:9b');
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('prism-coder:9b');
  });
});

describe('Model cascade: 27B → 9B → 4B → 2B → cloud', () => {
  it('LOCAL_MODELS cascade order: 27b first, 9b second', async () => {
    const mod = await import('@/services/aiService');
    let callCount = 0;
    const modelsCalled: string[] = [];

    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        const body = JSON.parse(init?.body || '{}');
        if (body.model) modelsCalled.push(body.model);
        if (callCount === 1) throw new Error('27B not loaded');
        // 9B succeeds
        return new Response(JSON.stringify({
          message: { content: 'Here are some phrases you can use to ask for help.' },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    const result = await mod.askAI('Phrases for help');
    expect(modelsCalled.length).toBe(2);
    expect(modelsCalled[0]).toContain('27b');
    expect(modelsCalled[1]).toContain('9b');
    // cascade stopped at 9b — 4b and 2b not reached
    expect(modelsCalled.some(m => m.includes('4b'))).toBe(false);
    expect(modelsCalled.some(m => m.includes('2b'))).toBe(false);
  });
});

describe('Auto-sideload PULLABLE_MODELS: 27B first (best quality), 9B fallback', () => {
  it('pull order is 27b → 9b → 4b → 2b when all fail', async () => {
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
