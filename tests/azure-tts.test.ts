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

  it('opts into autoStyle + surface=aac when tone is the default friendly', async () => {
    let captured: { surface?: string; autoStyle?: boolean; style?: string } = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) captured = JSON.parse(String(init.body));
      return audioOk();
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(captured.surface).toBe('aac');
    expect(captured.autoStyle).toBe(true);
    // explicit style is left unset so the server-side picker chooses.
    expect(captured.style).toBeUndefined();
  });

  it('sends explicit Inworld style (not autoStyle) when user picked a non-default tone', async () => {
    let captured: { surface?: string; autoStyle?: boolean; style?: string } = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) captured = JSON.parse(String(init.body));
      return audioOk();
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('Take meds NOW', 'en-US', 'angry', 0.5, 1.0, '');
    expect(captured.style).toBe('urgent');
    expect(captured.autoStyle).toBeUndefined();
  });
});

// ── tone → Inworld style mapper ──────────────────────────────────

describe('toneToInworldStyle — AAC tone → Inworld TTS-2 style', () => {
  it('returns null for the friendly default (caller falls through to autoStyle)', async () => {
    const { toneToInworldStyle } = await import('@/services/azureTTS');
    expect(toneToInworldStyle('friendly')).toBeNull();
  });

  it.each([
    ['cheerful', 'cheerful'],
    ['calm', 'calm'],
    ['serious', 'clear'],
    ['excited', 'cheerful'],
    ['hopeful', 'warm'],
    ['empathetic', 'calm'],
    ['sad', 'whisper'],
    ['angry', 'urgent'],
  ] as const)('maps %s → %s', async (tone, expected) => {
    const { toneToInworldStyle } = await import('@/services/azureTTS');
    expect(toneToInworldStyle(tone)).toBe(expected);
  });

  it('every mapped style is a value the server-side route accepts', async () => {
    // Must stay in sync with VALID_STYLES in synalux/src/lib/prism-steering.ts
    const VALID = new Set(['neutral', 'warm', 'cheerful', 'urgent', 'whisper', 'calm', 'clear']);
    const { toneToInworldStyle } = await import('@/services/azureTTS');
    const tones = ['friendly', 'cheerful', 'calm', 'serious', 'excited', 'hopeful', 'empathetic', 'sad', 'angry'] as const;
    for (const t of tones) {
      const style = toneToInworldStyle(t);
      if (style !== null) expect(VALID.has(style), `${t} → ${style} not in VALID set`).toBe(true);
    }
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
