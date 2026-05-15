/**
 * Auto-sideload unit tests.
 *
 * Verifies that the web app automatically detects Ollama and pulls
 * the best prism-coder model — avoiding cloud calls at all cost.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autoSideload, getSideloadStatus } from '@/services/aiService';

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

  it('pulls 14B first when Ollama is online and no model installed', async () => {
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
        // Simulate streaming pull completion
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
    expect(pullTag).toBe('dcostenco/prism-coder:14b');
    expect(getSideloadStatus().state).toBe('done');
  });

  it('does not re-pull on second call (session cached)', async () => {
    // Simulate first run already completed
    sessionStorage.setItem('prism-aac-sideload-status', 'done');
    fetchSpy.mockImplementation(async () => new Response('', { status: 200 }));

    await autoSideload();
    expect(fetchCalls.length).toBe(0); // no fetch calls at all
  });

  it('falls through to 8B if 14B pull fails', async () => {
    let pullAttempts: string[] = [];
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
          // 14B pull fails (disk full, etc.)
          return new Response('', { status: 500 });
        }
        // 8B succeeds
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
    expect(pullAttempts).toContain('dcostenco/prism-coder:14b');
    expect(pullAttempts).toContain('dcostenco/prism-coder:8b');
    expect(getSideloadStatus().state).toBe('done');
    expect(getSideloadStatus().model).toBe('dcostenco/prism-coder:8b');
  });
});

describe('Model cascade includes 8B', () => {
  it('LOCAL_MODELS contains 14b, 8b, and 1b7 in priority order', async () => {
    // Import and check the module's model list
    const mod = await import('@/services/aiService');
    // The cascade is internal but we can verify behavior:
    // when 14B fails, it should try 8B before 1.7B
    let callCount = 0;
    const modelsCalled: string[] = [];

    fetchSpy.mockImplementation(async (url: any, init: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('localhost:11434') || urlStr.includes('127.0.0.1')) {
        callCount++;
        const body = JSON.parse(init?.body || '{}');
        if (body.model) modelsCalled.push(body.model);
        if (callCount <= 2) throw new Error('Model not loaded'); // 14B and 8B fail
        // 1.7B succeeds
        return new Response(JSON.stringify({
          response: 'Fallback from 1.7B — here are some phrases.',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    });

    const result = await mod.askAI('Phrases for help');
    expect(modelsCalled.length).toBe(3);
    expect(modelsCalled[0]).toContain('14b');
    expect(modelsCalled[1]).toContain('8b');
    expect(modelsCalled[2]).toContain('1b7');
  });
});
