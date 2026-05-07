/**
 * Streaming-loss regression — the exact bug the user reported May 2026.
 *
 *   "voice is not streaming at all now in romanian"
 *   "speak button is frequently losing streaming"
 *
 * Two separate failure modes both gated here:
 *
 *   A) Languages where Gemini has no voice (ro, uk, etc.) MUST always
 *      fall through to the Inworld/Azure /tts route after speakGemini
 *      fails. An earlier fix added a `speakSeq` "latest-wins" guard
 *      that bowed out between Gemini and Inworld when ANY peer call
 *      had bumped the seq counter — silence-detect speech bumps it
 *      every keystroke, so the Romanian fetch never claimed playback.
 *
 *   B) Concurrent speakAzure calls (rapid Speak + silence-detect
 *      interleaving) must both reach decodeAndPlay. The original bug
 *      was stopAzureAudio() inside the success path aborting peer
 *      controllers — newer call's fetch threw AbortError and fell
 *      through to Web Speech (robotic) or silent. Fix: split into
 *      stopAzurePlayback (sources only) vs stopAzureAudio (full
 *      panic, only used by user-driven stop button).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

class MockBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  static startCalls = 0;
  connect(_target: unknown) { return _target as MockBufferSource; }
  disconnect() { /* */ }
  start() { MockBufferSource.startCalls++; }
  stop() { /* */ }
}
class MockGain { gain = { value: 1 }; connect(t: unknown) { return t; } disconnect() {} }
class MockAudioContext {
  state = 'running';
  destination = {} as AudioDestinationNode;
  createBufferSource() { return new MockBufferSource() as unknown as AudioBufferSourceNode; }
  createGain() { return new MockGain() as unknown as GainNode; }
  async decodeAudioData(buf: ArrayBuffer): Promise<AudioBuffer> {
    return { duration: 1, length: buf.byteLength, numberOfChannels: 1, sampleRate: 24000 } as AudioBuffer;
  }
  async resume() { /* */ }
  close() { /* */ }
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  MockBufferSource.startCalls = 0;
  (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    MockAudioContext as unknown as typeof AudioContext;
  (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    MockAudioContext as unknown as typeof AudioContext;
});

function audioOk(bytes = 1024): Response {
  return new Response(new ArrayBuffer(bytes), {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

function geminiUnsupported(): Response {
  // What the portal returns for ro/uk: Gemini doesn't speak it,
  // route signals fallback. speakGemini sees !res.ok → returns false.
  return new Response(JSON.stringify({ error: 'lang not supported', fallback: 'inworld' }), {
    status: 503, headers: { 'Content-Type': 'application/json' },
  });
}

describe('Romanian streaming — Gemini fails, Inworld path must play', () => {
  it('plays Romanian when Gemini 503s and Inworld returns audio', async () => {
    let inworldHit = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/prism-aac/tts/public')) return geminiUnsupported();
      if (url.endsWith('/tts/public')) { inworldHit = true; return audioOk(2048); }
      return new Response('', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { speakAzure } = await import('@/services/azureTTS');

    const ok = await speakAzure('Eu vreau apă', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural');

    expect(ok).toBe(true);
    expect(inworldHit).toBe(true);
    // The actual regression check: BufferSource.start must fire so the
    // user hears audio. Before the fix, the Inworld fetch result was
    // discarded by an early-return bow-out → startCalls stayed at 0.
    expect(MockBufferSource.startCalls).toBe(1);
  });
});

describe('Concurrent Speak + silence-detect — both must reach playback', () => {
  it('both calls succeed and at least one plays audio', async () => {
    // Simulate the user-reported scenario: rapid sequence of speakAzure
    // calls (silence-detect on every keystroke + the explicit Speak
    // button). Each call's fetch is independent. Both should resolve
    // successfully and at minimum the latest one should play.
    let inworldHits = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/prism-aac/tts/public')) return geminiUnsupported();
      if (url.endsWith('/tts/public')) {
        inworldHits++;
        // Slight async to encourage interleaving
        await Promise.resolve();
        return audioOk(1024);
      }
      return new Response('', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { speakAzure } = await import('@/services/azureTTS');

    const [a, b] = await Promise.all([
      speakAzure('Eu', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural'),
      speakAzure('Eu vreau', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural'),
    ]);

    // Before the speakSeq revert, the second call would bow out (or
    // the first would, depending on order) → one of these returns
    // true-without-playing, leaving startCalls < 2.
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(inworldHits).toBe(2);
    // Both fetches reached decodeAndPlay → both BufferSources started.
    // (stopAzurePlayback stops the older source between presses but
    // start() was still called on it, so the counter increments
    // regardless. This pins "both calls actually rendered audio".)
    expect(MockBufferSource.startCalls).toBe(2);
  });

  it('rapid sequential Speak presses each play their own audio', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/prism-aac/tts/public')) return geminiUnsupported();
      if (url.endsWith('/tts/public')) {
        calls++;
        return audioOk(1024);
      }
      return new Response('', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { speakAzure } = await import('@/services/azureTTS');

    // Three rapid presses, awaited in order (mirrors the user pressing
    // Speak three times back-to-back). Each must play.
    const r1 = await speakAzure('Eu', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural');
    const r2 = await speakAzure('Tu', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural');
    const r3 = await speakAzure('Noi', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural');

    expect([r1, r2, r3]).toEqual([true, true, true]);
    expect(calls).toBe(3);
    expect(MockBufferSource.startCalls).toBe(3);
  });
});
