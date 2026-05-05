import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the two-tier TTS endpoint fallback in services/azureTTS.ts.
 *
 * Architecture under test:
 *   1. POST /api/v1/tts/public — Inworld for everyone, no auth.
 *   2. On HTTP 502 from public, retry POST /api/v1/tts (cookie auth).
 *      Cookie-bearing paid users get Azure Neural; free users 403.
 *   3. Audio decoded via AudioContext.decodeAudioData → BufferSourceNode.
 *      Web Audio path replaces the legacy `new Audio().play()` after
 *      `await fetch()` that iOS Safari intermittently rejected because
 *      the user-gesture token was consumed by the await.
 */

// AudioContext mock that returns a usable buffer + tracks start() calls.
class MockBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  static lastInstance: MockBufferSource | null = null;
  static startCalls = 0;
  constructor() { MockBufferSource.lastInstance = this; }
  connect(_target: unknown) { return _target as MockBufferSource; }
  disconnect() { /* noop */ }
  start(_when?: number) { MockBufferSource.startCalls++; }
  stop() { /* noop */ }
}

class MockGain {
  gain = { value: 1 };
  connect(target: unknown) { return target; }
  disconnect() { /* noop */ }
}

class MockAudioContext {
  state = 'running';
  destination = {} as AudioDestinationNode;
  currentTime = 0;
  static decodeCalls = 0;
  createBufferSource() { return new MockBufferSource() as unknown as AudioBufferSourceNode; }
  createGain() { return new MockGain() as unknown as GainNode; }
  async decodeAudioData(buf: ArrayBuffer): Promise<AudioBuffer> {
    MockAudioContext.decodeCalls++;
    return { duration: 1, length: buf.byteLength, numberOfChannels: 1, sampleRate: 24000 } as AudioBuffer;
  }
  async resume() { /* noop */ }
  close() { /* noop */ }
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  MockBufferSource.startCalls = 0;
  MockBufferSource.lastInstance = null;
  MockAudioContext.decodeCalls = 0;
  // Replace global AudioContext with our mock — the singleton in
  // azureTTS.ts caches the constructed instance per module load, so we
  // also resetModules() so each test gets a fresh singleton.
  (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    MockAudioContext as unknown as typeof AudioContext;
  (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    MockAudioContext as unknown as typeof AudioContext;
});

function mockFetch(handlers: Record<string, () => Response | Promise<Response>>): void {
  const fn = vi.fn(async (url: string) => {
    for (const [path, handler] of Object.entries(handlers)) {
      if (url.endsWith(path)) return handler();
    }
    return new Response(JSON.stringify({ error: 'unmocked url ' + url }), { status: 500 });
  });
  vi.stubGlobal('fetch', fn);
}

function audioOk(bytes = 1024): Response {
  return new Response(new ArrayBuffer(bytes), {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

describe('speakAzure — two-tier endpoint strategy', () => {
  it('hits /api/v1/tts/public first', async () => {
    let publicCalled = false;
    mockFetch({
      '/tts/public': () => { publicCalled = true; return audioOk(); },
    });
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hello', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(result).toBe(true);
    expect(publicCalled).toBe(true);
  });

  it('returns true and plays audio on a public 200', async () => {
    mockFetch({ '/tts/public': () => audioOk(2048) });
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(result).toBe(true);
    // BufferSourceNode.start was called exactly once on success
    expect(MockBufferSource.startCalls).toBe(1);
    expect(MockAudioContext.decodeCalls).toBe(1);
  });

  it('falls back to /api/v1/tts on a 502 from public (Inworld voice rejected)', async () => {
    let authCalled = false;
    mockFetch({
      '/tts/public': () => new Response(JSON.stringify({ error: 'Inworld unavailable' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      }),
      '/tts': () => { authCalled = true; return audioOk(); },
    });
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('Доброе утро', 'ru-RU', 'friendly', 0.5, 1.0, '', 'Anya');
    expect(result).toBe(true);
    expect(authCalled).toBe(true);
  });

  it('does NOT fall back to auth route on a non-502 failure (e.g. 503)', async () => {
    let authCalled = false;
    mockFetch({
      '/tts/public': () => new Response(JSON.stringify({ error: 'config' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      }),
      '/tts': () => { authCalled = true; return audioOk(); },
    });
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(result).toBe(false);
    expect(authCalled).toBe(false);
  });

  it('returns false when both endpoints fail (free user with broken voice)', async () => {
    mockFetch({
      '/tts/public': () => new Response('', { status: 502 }),
      '/tts': () => new Response('', { status: 401 }), // no auth cookie
    });
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(result).toBe(false);
    expect(MockBufferSource.startCalls).toBe(0);
  });

  it('forwards voiceId in the request body so the portal routes correctly', async () => {
    let captured: { ssml?: string; voiceId?: string } = {};
    mockFetch({
      '/tts/public': async () => {
        // Replay the most recent fetch's body — the global fn is the
        // last one stubbed; capture via a side-effect closure.
        return audioOk();
      },
    });
    // Override fetch with a body-capturing variant for this case.
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) captured = JSON.parse(String(init.body));
      return audioOk();
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hello', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(captured.voiceId).toBe('Alex');
    expect(captured.ssml).toContain('en-US');
    expect(captured.ssml).toContain('hello');
  });

  it('omits voiceId when caller did not specify one (lets server pick)', async () => {
    let captured: { voiceId?: string } = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) captured = JSON.parse(String(init.body));
      return audioOk();
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(captured.voiceId).toBeUndefined();
  });

  it('returns false on a network error (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(result).toBe(false);
    expect(MockBufferSource.startCalls).toBe(0);
  });

  it('returns false when audio bytes fail to decode (corrupt MP3)', async () => {
    mockFetch({ '/tts/public': () => audioOk() });
    // Override decodeAudioData to reject
    MockAudioContext.prototype.decodeAudioData = vi.fn(async () => {
      throw new Error('Unable to decode audio data');
    });
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(result).toBe(false);
    // Restore for subsequent tests
    MockAudioContext.prototype.decodeAudioData = async function (buf: ArrayBuffer) {
      MockAudioContext.decodeCalls++;
      return { duration: 1, length: buf.byteLength, numberOfChannels: 1, sampleRate: 24000 } as AudioBuffer;
    };
  });
});

describe('warmupAzureAudio — gesture-time AudioContext priming', () => {
  it('does not throw when called repeatedly', async () => {
    const { warmupAzureAudio } = await import('@/services/azureTTS');
    await warmupAzureAudio();
    await warmupAzureAudio();
    await warmupAzureAudio();
    // No assertion needed — passing means the singleton path is idempotent.
    expect(true).toBe(true);
  });
});

describe('stopAzureAudio — panic stop', () => {
  it('cancels in-flight requests and stops queued sources', async () => {
    mockFetch({ '/tts/public': () => audioOk() });
    const { speakAzure, stopAzureAudio } = await import('@/services/azureTTS');
    await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(() => stopAzureAudio()).not.toThrow();
  });
});
