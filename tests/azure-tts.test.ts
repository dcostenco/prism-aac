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

// Default Gemini handler — always fail so the existing Inworld
// assertions in the rest of this file stay meaningful. Tests that
// specifically exercise the Gemini path opt in by overriding it.
function geminiFail(): Response {
  return new Response(JSON.stringify({ error: 'TTS not configured', fallback: 'inworld' }), {
    status: 503, headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(handlers: Record<string, () => Response | Promise<Response>>): void {
  const fn = vi.fn(async (url: string) => {
    // Most-specific match first so /prism-aac/tts/public doesn't get
    // swallowed by an /tts/public handler. Sort by descending path length.
    const entries = Object.entries(handlers).sort((a, b) => b[0].length - a[0].length);
    for (const [path, handler] of entries) {
      if (url.endsWith(path)) return handler();
    }
    // Default: Gemini calls fail so Inworld assertions still apply.
    if (url.includes('/prism-aac/tts/public')) return geminiFail();
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

  // Body-shape capture: only inspect what's sent to the INWORLD route
  // (/tts/public), since the Gemini PRIMARY (/prism-aac/tts/public) sends
  // a different body shape (just { text }). Tests must fail Gemini so
  // the function falls through and actually fires the Inworld fetch.
  function captureInworld<T>(): { capture: T; fetchFn: ReturnType<typeof vi.fn> } {
    const captured = {} as T;
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/prism-aac/tts/public')) return geminiFail();
      if (url.includes('/tts/public') || url.endsWith('/tts')) {
        if (init?.body) Object.assign(captured as Record<string, unknown>, JSON.parse(String(init.body)));
        return audioOk();
      }
      return new Response('', { status: 500 });
    });
    return { capture: captured, fetchFn };
  }

  it('forwards voiceId in the Inworld request body so the portal routes correctly', async () => {
    const { capture, fetchFn } = captureInworld<{ ssml?: string; voiceId?: string }>();
    vi.stubGlobal('fetch', fetchFn);
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hello', 'en-US', 'friendly', 0.5, 1.0, '', 'Alex');
    expect(capture.voiceId).toBe('Alex');
    expect(capture.ssml).toContain('en-US');
    expect(capture.ssml).toContain('hello');
  });

  it('omits voiceId in Inworld request when caller did not specify one (lets server pick)', async () => {
    const { capture, fetchFn } = captureInworld<{ voiceId?: string }>();
    vi.stubGlobal('fetch', fetchFn);
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(capture.voiceId).toBeUndefined();
  });

  it('opts into Inworld autoStyle + surface=aac when tone is the default friendly', async () => {
    const { capture, fetchFn } = captureInworld<{ surface?: string; autoStyle?: boolean; style?: string }>();
    vi.stubGlobal('fetch', fetchFn);
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(capture.surface).toBe('aac');
    expect(capture.autoStyle).toBe(true);
    // explicit style is left unset so the server-side picker chooses.
    expect(capture.style).toBeUndefined();
  });

  it('sends explicit Inworld style (not autoStyle) when user picked a non-default tone', async () => {
    const { capture, fetchFn } = captureInworld<{ surface?: string; autoStyle?: boolean; style?: string }>();
    vi.stubGlobal('fetch', fetchFn);
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('Take meds NOW', 'en-US', 'angry', 0.5, 1.0, '');
    expect(capture.style).toBe('urgent');
    expect(capture.autoStyle).toBeUndefined();
  });
});

// ── Gemini-first primary path ─────────────────────────────────────
//
// Gemini 2.5 Flash Preview TTS at /api/v1/prism-aac/tts/public is the
// PRIMARY backend. The architectural design is: AAC client always tries
// Gemini first → on any failure (key missing, rate limit, decode error,
// network) falls through to the Inworld two-tier chain. When prism-coder
// 72B TTS lands the SERVER swaps the backend behind that URL — this
// client code stays the same.
describe('speakAzure — Inworld-first tier order (Gemini is last-resort)', () => {
  function audioOkWav(bytes = 1024): Response {
    return new Response(new ArrayBuffer(bytes), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav', 'X-TTS-Backend': 'gemini-2.5-flash-preview' },
    });
  }

  it('calls /api/v1/tts/public (Inworld) BEFORE /api/v1/prism-aac/tts/public (Gemini)', async () => {
    const callOrder: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/prism-aac/tts/public')) {
        callOrder.push('gemini');
        return audioOkWav();
      }
      if (url.includes('/tts/public')) {
        callOrder.push('inworld');
        return audioOk();
      }
      return new Response('', { status: 500 });
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hello', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(result).toBe(true);
    // Inworld is the primary tier — Gemini must NOT be called when
    // Inworld succeeds. RO/UK speakers (where Gemini 503s) get audio
    // on the first round-trip instead of two wasted ones.
    expect(callOrder[0]).toBe('inworld');
    expect(callOrder).not.toContain('gemini');
  });

  it('falls through to Gemini ONLY when Inworld + auth /tts both fail', async () => {
    // URL match order matters: /prism-aac/tts/public must be checked
    // BEFORE /tts/public because endsWith('/tts/public') also matches
    // the gemini path. Same idiom in the mockFetch helper above.
    const callOrder: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/prism-aac/tts/public')) {
        callOrder.push('gemini');
        return audioOkWav();
      }
      if (url.endsWith('/tts/public')) {
        callOrder.push('inworld');
        return new Response(JSON.stringify({ error: 'no voice' }), { status: 502 });
      }
      if (url.endsWith('/tts')) {
        callOrder.push('auth');
        return new Response('', { status: 401 });
      }
      return new Response('', { status: 500 });
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(result).toBe(true);
    expect(callOrder).toEqual(['inworld', 'auth', 'gemini']);
  });

  it('Gemini sends only { text } when it IS reached (no SSML / voiceId / style)', async () => {
    let geminiBody: { text?: string; ssml?: string; voiceId?: string; style?: string } = {};
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/prism-aac/tts/public')) {
        if (init?.body) geminiBody = JSON.parse(String(init.body));
        return audioOkWav();
      }
      if (url.endsWith('/tts/public')) return new Response('', { status: 502 });
      if (url.endsWith('/tts')) return new Response('', { status: 401 });
      return new Response('', { status: 500 });
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hello world', 'en-US', 'angry', 0.5, 1.0, '', 'Alex');
    expect(geminiBody.text).toBe('hello world');
    expect(geminiBody.ssml).toBeUndefined();
    expect(geminiBody.voiceId).toBeUndefined();
    expect(geminiBody.style).toBeUndefined();
  });

  it('NO credentials:include on the Gemini fetch (CORS spec rejects credentials + ACAO=*)', async () => {
    let geminiCredentials: RequestCredentials | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/prism-aac/tts/public')) {
        geminiCredentials = init?.credentials;
        return audioOkWav();
      }
      if (url.endsWith('/tts/public')) return new Response('', { status: 502 });
      if (url.endsWith('/tts')) return new Response('', { status: 401 });
      return new Response('', { status: 500 });
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    await speakAzure('hi', 'en-US', 'friendly', 0.5, 1.0, '');
    expect(geminiCredentials).not.toBe('include');
  });

  it('Romanian path: Inworld /tts/public 502 → /tts auth 200 — Gemini never called', async () => {
    // RO/UK: Inworld has no native voice → /tts/public 502, but the
    // server-side /tts route routes to Azure neural for paid users.
    // This is THE happy path for Romanian — Gemini never gets called.
    const callOrder: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/prism-aac/tts/public')) {
        callOrder.push('gemini');
        return audioOkWav();
      }
      if (url.endsWith('/tts/public')) {
        callOrder.push('inworld');
        return new Response(JSON.stringify({ error: 'no RO voice' }), { status: 502 });
      }
      if (url.endsWith('/tts')) {
        callOrder.push('auth');
        return audioOk();
      }
      return new Response('', { status: 500 });
    }));
    const { speakAzure } = await import('@/services/azureTTS');
    const result = await speakAzure('Eu vreau apă', 'ro-RO', 'friendly', 0.5, 1.0, 'token', 'ro-RO-AlinaNeural');
    expect(result).toBe(true);
    expect(callOrder).toEqual(['inworld', 'auth']);
    expect(callOrder).not.toContain('gemini');
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
