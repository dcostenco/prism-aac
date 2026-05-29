/**
 * Auto-sideload unit tests.
 *
 * Verifies that the web app automatically detects Ollama and pulls
 * the best prism-coder model — avoiding cloud calls at all cost.
 *
 * Pull priority: 32B first (99% accuracy), 14B fallback (97%, fits more devices).
 * Local cascade: 14B → 32B → cloud Claude.
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
          models: [{ name: 'dcostenco/prism-coder:14b' }],
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

  it('pulls 32B first (best quality) when Ollama is online and no model installed', async () => {
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
    expect(pullTag).toBe('prism-coder:32b');
    expect(getSideloadStatus().state).toBe('done');
  });

  it('does not re-pull on second call (session cached)', async () => {
    sessionStorage.setItem('prism-aac-sideload-status', 'done');
    fetchSpy.mockImplementation(async () => new Response('', { status: 200 }));

    await autoSideload();
    expect(fetchCalls.length).toBe(0);
  });

  it('falls through to 14B if 32B pull fails (low disk)', async () => {
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
          return new Response('', { status: 500 }); // 32B fails — disk full
        }
        // 14B succeeds
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
    expect(pullAttempts[0]).toBe('prism-coder:32b');
    expect(pullAttempts[1]).toBe('prism-coder:14b');
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('prism-coder:14b');
  });
});

describe('Model cascade: 32B → 14B → cloud', () => {
  it('LOCAL_MODELS cascade order: 32b first, 14b second', async () => {
    const mod = await import('@/services/aiService');
    let callCount = 0;
    const modelsCalled: string[] = [];

    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        const body = JSON.parse(init?.body || '{}');
        if (body.model) modelsCalled.push(body.model);
        if (callCount === 1) throw new Error('32B not loaded');
        // 14B succeeds
        return new Response(JSON.stringify({
          response: 'Here are some phrases you can use to ask for help.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    const result = await mod.askAI('Phrases for help');
    expect(modelsCalled.length).toBe(2);
    expect(modelsCalled[0]).toContain('32b');
    expect(modelsCalled[1]).toContain('14b');
    // cascade stopped at 14b — 8b and 1b7 not reached
    expect(modelsCalled.some(m => m.includes('8b'))).toBe(false);
    expect(modelsCalled.some(m => m.includes('1b7'))).toBe(false);
  });
});

describe('Auto-sideload PULLABLE_MODELS: 32B first (best quality), 14B fallback', () => {
  it('pull order is 32b → 14b → 8b → 4b → 1b7 when all fail', async () => {
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
    expect(pullAttempts.length).toBe(5);
    expect(pullAttempts[0]).toBe('prism-coder:32b');
    expect(pullAttempts[1]).toBe('prism-coder:14b');
    expect(pullAttempts[2]).toBe('prism-coder:8b');
    expect(pullAttempts[3]).toBe('prism-coder:4b'); expect(pullAttempts[4]).toBe('prism-coder:1b7');
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
        // 14B pull succeeds — cascade stops here
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
    expect(pullAttempts[0]).toBe('prism-coder:32b');
    expect(pullAttempts[1]).toBe('prism-coder:14b');
    expect(pullAttempts).not.toContain('prism-coder:8b');
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('prism-coder:14b');
  });
});
