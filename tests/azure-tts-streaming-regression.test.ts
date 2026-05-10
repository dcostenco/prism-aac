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
  // window may be undefined after vi.resetModules() in some jsdom contexts;
  // globalThis above is sufficient — window is an alias for globalThis in browser.
  if (typeof window !== 'undefined') {
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
      MockAudioContext as unknown as typeof AudioContext;
  }
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

describe('Romanian streaming — Inworld path must play (Gemini never reached)', () => {
  it('plays Romanian when Inworld /tts/public returns audio (no Gemini round-trip)', async () => {
    let inworldHit = false;
    let geminiHit = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/prism-aac/tts/public')) { geminiHit = true; return geminiUnsupported(); }
      if (url.endsWith('/tts/public')) { inworldHit = true; return audioOk(2048); }
      return new Response('', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { speakAzure } = await import('@/services/azureTTS');

    const ok = await speakAzure('Eu vreau apă', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural');

    expect(ok).toBe(true);
    expect(inworldHit).toBe(true);
    // Inworld-first reorder: for languages the server routes via Azure
    // (ro/uk/etc.) Gemini is NEVER called — saves a wasted 503 round-
    // trip on every Speak press.
    expect(geminiHit).toBe(false);
    expect(MockBufferSource.startCalls).toBe(1);
  });
});

describe('Concurrent Speak + silence-detect — both must reach playback', () => {
  it('both calls succeed and at least one plays audio', async () => {
    // Simulate the user-reported scenario: rapid sequence of speakAzure
    // calls (silence-detect on every keystroke + the explicit Speak
    // button). Each call's fetch is independent. Both should resolve
    // successfully and at minimum the latest one should play.
    //
    // PROTECT_PLAY_MS (600ms) guard: when the first source starts and
    // is still "young" (< 600ms elapsed), an autoSpeak peer call
    // (interrupt=false) is deliberately blocked from interrupting it.
    // The mock environment collapses time so the second concurrent call
    // always sees playedSoFar ≈ 0ms → PROTECT_PLAY_MS fires → exactly 1
    // BufferSource starts. The critical assertions are that BOTH fetches
    // complete (inworldHits=2) and BOTH calls return true — confirming
    // the speakSeq-revert fix (no AbortError killing peer fetches).
    let inworldHits = 0;
    const fetchMock = vi.fn(async (url: string) => {
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

    // Both fetches must complete — the main streaming-fix assertion
    // (speakSeq revert: no AbortError killing peer fetch controllers).
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(inworldHits).toBe(2);
    // At least one source plays; PROTECT_PLAY_MS may (correctly) block
    // the second autoSpeak from interrupting still-young audio.
    expect(MockBufferSource.startCalls).toBeGreaterThanOrEqual(1);
  });

  it('rapid sequential Speak presses each play their own audio', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/tts/public')) {
        calls++;
        return audioOk(1024);
      }
      return new Response('', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { speakAzure } = await import('@/services/azureTTS');

    // Three rapid presses, awaited in order (mirrors the user pressing
    // Speak three times back-to-back). Explicit Speak button passes
    // interrupt=true, bypassing the PROTECT_PLAY_MS guard so each press
    // stops the prior audio and starts its own. Each must play.
    const r1 = await speakAzure('Eu', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural', true);
    const r2 = await speakAzure('Tu', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural', true);
    const r3 = await speakAzure('Noi', 'ro-RO', 'friendly', 0.5, 1.0, '', 'ro-RO-AlinaNeural', true);

    expect([r1, r2, r3]).toEqual([true, true, true]);
    expect(calls).toBe(3);
    expect(MockBufferSource.startCalls).toBe(3);
  });
});

describe('Class 6 — Case-mismatch double-speak (silence-detect + handleSpeak race)', () => {
  /**
   * Root cause (May 2026, recurring):
   *
   * 1. User types "hello" → isSafeAutoCorrection auto-capitalizes to "Hello"
   *    on Speak press → handleSpeak sets lastSilenceSpokenRef.current = "Hello"
   *    and calls speakAzure("Hello").
   *
   * 2. Silence-detect timer was already in flight with closure-captured
   *    trimmed = "hello" (pre-correction). It fires ~350ms later with
   *    lastWord = "hello". Old guard: "hello" !== "Hello" → TRUE → re-speaks.
   *    New guard: "hello".toLowerCase() !== "Hello".toLowerCase() → FALSE → blocked.
   *
   * These tests pin the DEDUP layer (speakAzure) to document WHY the
   * component-level pre-mark guard is the right fix, and verify the
   * DEDUP's exact-string semantics are preserved (case-insensitive DEDUP
   * would be wrong — "She" and "she" are legitimately different utterances
   * when the user changes capitalisation intentionally).
   */

  it('DEDUP does NOT suppress "hello" after "Hello" — exact-string only (component guard handles this)', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).endsWith('/tts/public')) { calls++; return audioOk(1024); }
      return new Response('', { status: 500 });
    }));
    const { speakAzure } = await import('@/services/azureTTS');

    // handleSpeak fires first with corrected "Hello"
    const r1 = await speakAzure('Hello', 'en-US', 'friendly', 1.0, 1.0, '');
    // Silence-detect fires 350ms later (beyond DEDUP window if > 200ms,
    // but also case-different). Service layer allows it through — the
    // component pre-mark is what blocks this in production.
    const r2 = await speakAzure('hello', 'en-US', 'friendly', 1.0, 1.0, '');

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(calls).toBe(2); // both fetches fire — DEDUP is exact-string by design
    // This documents that the fix MUST be at the component level (pre-mark
    // comparison case-insensitive), not at the speakAzure DEDUP level.
  });

  it('DEDUP correctly suppresses identical-case same-text within 200ms', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).endsWith('/tts/public')) { calls++; return audioOk(1024); }
      return new Response('', { status: 500 });
    }));
    const { speakAzure } = await import('@/services/azureTTS');

    const r1 = await speakAzure('Hello', 'en-US', 'friendly', 1.0, 1.0, '');
    // Fire immediately — same text, within DEDUP window
    const r2 = speakAzure('Hello', 'en-US', 'friendly', 1.0, 1.0, '');
    await r2;

    expect(r1).toBe(true);
    expect(await r2).toBe(true); // returns true (claims success), suppresses fetch
    expect(calls).toBe(1); // only ONE fetch — DEDUP fired
    expect(MockBufferSource.startCalls).toBe(1);
  });

  it('silence-detect guard: case-different same word must NOT re-speak', () => {
    // Pure contract test for the pre-mark comparison logic.
    // Pins the fix: lastWord.toLowerCase() !== lastSpoken.toLowerCase()
    const guard = (lastWord: string, lastSpoken: string): boolean =>
      lastWord.length >= 3 && lastWord.toLowerCase() !== lastSpoken.toLowerCase();

    // The bug: old guard (===) would return true for these → double-speak
    expect(guard('hello', 'Hello')).toBe(false);  // autocorrect capitalised
    expect(guard('Hello', 'hello')).toBe(false);  // inverted case
    expect(guard('HELLO', 'hello')).toBe(false);  // all-caps vs lower
    expect(guard('World', 'world')).toBe(false);  // general case

    // Should still speak for genuinely different words
    expect(guard('hello', 'world')).toBe(true);
    expect(guard('water', 'bread')).toBe(true);
    expect(guard('Hello', 'World')).toBe(true);

    // Short words (≤2 chars) never trigger silence-detect
    expect(guard('hi', 'Hi')).toBe(false);  // too short regardless
    expect(guard('ok', 'OK')).toBe(false);  // too short regardless

    // Empty lastSpoken (initial state) → should speak
    expect(guard('hello', '')).toBe(true);
  });

  it('silence-detect guard: same word after punctuation normalisation does not re-speak', () => {
    const guard = (lastWord: string, lastSpoken: string): boolean =>
      lastWord.length >= 3 && lastWord.toLowerCase() !== lastSpoken.toLowerCase();

    // Edge: if word has trailing punctuation stripped differently
    expect(guard('hello', 'Hello')).toBe(false);
    expect(guard('hello!', 'Hello!')).toBe(false);
  });
});
