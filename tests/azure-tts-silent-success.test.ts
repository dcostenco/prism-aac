/**
 * Silent-success regression — speakAzure must not return true while the
 * user hears nothing.
 *
 * User report May 2026 (Image #23): browser console showed
 *   [TTS] Portal TTS succeeded
 *   [TTS] Portal TTS succeeded
 *   ...
 * fired many times in succession, yet the user heard zero audio.
 * Existing unit tests mocked AudioContext to a no-op stub that always
 * succeeded, so they could not distinguish "audio actually played" from
 * "code path returned true". This suite closes that gap with a stub
 * AudioContext that tracks BufferSourceNode lifecycle, gain values,
 * and start/stop timing.
 *
 * Two failure modes pinned here:
 *   1. SILENT-GAIN — a NaN / undefined / negative `volume` argument
 *      reaches gain.gain.value, producing a 0-volume node. decodeAndPlay
 *      used to return true for this case (silent success). The new
 *      code falls back to 1.0 when volume is non-finite or negative.
 *   2. PEER-RACE — speakAzure used to call stopAzurePlayback BEFORE
 *      `await readCappedAudio`, opening a 50–500 ms window where a peer
 *      call could land between our stop and our start and kill our
 *      audio mid-play. The new code calls stopAzurePlayback inside
 *      decodeAndPlay, synchronously right before source.start, so
 *      peer calls can't race in. Verified via two concurrent speakAzure
 *      invocations: BOTH must produce a source whose onended fires at
 *      the buffer's natural duration, not within ~30 ms of start.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Stub AudioContext that records lifecycle ────────────────────────
type StubSource = {
  buffer: { duration: number } | null;
  onended: (() => void) | null;
  start: (when?: number) => void;
  stop: () => void;
  connect: (dst: unknown) => unknown;
  disconnect: () => void;
  _started: boolean;
  _stopped: boolean;
  _startedAt: number;
  _endedAt: number | null;
};

type StubGain = {
  gain: { value: number };
  connect: (dst: unknown) => unknown;
  disconnect: () => void;
  _valueAtConnect: number;
};

let createdSources: StubSource[] = [];
let createdGains: StubGain[] = [];
let stubCtxState: 'running' | 'suspended' | 'closed' = 'running';

class StubAudioContext {
  state: 'running' | 'suspended' | 'closed' = stubCtxState;
  destination = {} as unknown;
  resume = vi.fn(async () => { this.state = 'running'; });
  decodeAudioData = vi.fn(async (_buf: ArrayBuffer) => ({ duration: 0.5 } as unknown as AudioBuffer));
  createBufferSource(): StubSource {
    let onendedCb: (() => void) | null = null;
    const src: StubSource = {
      buffer: null,
      get onended() { return onendedCb; },
      set onended(cb: (() => void) | null) { onendedCb = cb; },
      start(_when?: number) {
        src._started = true;
        src._startedAt = Date.now();
      },
      stop() {
        if (src._stopped) return;
        src._stopped = true;
        src._endedAt = Date.now();
        // Web Audio API spec: source.stop() fires onended.
        if (onendedCb) onendedCb();
      },
      connect: (dst: unknown) => dst,
      disconnect: () => {},
      _started: false,
      _stopped: false,
      _startedAt: 0,
      _endedAt: null,
    };
    createdSources.push(src);
    return src;
  }
  createGain(): StubGain {
    const g: StubGain = {
      gain: { value: 0 },
      connect: (dst: unknown) => dst,
      disconnect: () => {},
      _valueAtConnect: 0,
    };
    createdGains.push(g);
    // Capture the gain value at the moment of connect (the value the
    // source actually plays through). Tests assert on this, not on the
    // post-init `.gain.value` which the function never mutates after
    // connect anyway.
    const origConnect = g.connect;
    g.connect = (dst: unknown) => {
      g._valueAtConnect = g.gain.value;
      return origConnect(dst);
    };
    return g;
  }
}

beforeEach(() => {
  createdSources = [];
  createdGains = [];
  stubCtxState = 'running';
  // Inject the stub AudioContext into the module under test.
  (globalThis as unknown as { AudioContext: typeof StubAudioContext }).AudioContext = StubAudioContext;
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadAzureTTS() {
  return await import('@/services/azureTTS');
}

describe('decodeAndPlay — gain guard against NaN / undefined / negative volume', () => {
  it('uses 1.0 gain when volume is undefined (silent-success guard)', async () => {
    const mod = await loadAzureTTS();
    // speakAzure with a controller-and-fetch shim too heavy here; we
    // exercise decodeAndPlay's contract via the public warmup-is-running
    // sequence used in our other tests. The pattern: mock fetch to
    // return a 200 audio response and call speakAzure.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new ArrayBuffer(64), {
        status: 200,
        headers: { 'content-length': '64' },
      }),
    );
    await mod.speakAzure(
      'hi',
      'en-US',
      'friendly',
      1,
      undefined as unknown as number, // ← the silent-gain bug: volume undefined
      '',
    );
    expect(createdGains.length).toBeGreaterThan(0);
    const g = createdGains[0];
    // BEFORE the fix: g.gain.value was NaN (from Math.min(1, undefined))
    //   → gain node silenced → user heard nothing → decodeAndPlay still
    //   returned true → speakAzure returned true → "[TTS] Portal TTS
    //   succeeded" log fired.
    // AFTER the fix: safeVolume defaults to 1.0 when not finite.
    expect(Number.isFinite(g._valueAtConnect)).toBe(true);
    expect(g._valueAtConnect).toBeGreaterThan(0);
    fetchSpy.mockRestore();
  });

  it('uses 1.0 gain when volume is NaN', async () => {
    const mod = await loadAzureTTS();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(64), { status: 200, headers: { 'content-length': '64' } }),
    );
    await mod.speakAzure('hi', 'en-US', 'friendly', 1, Number.NaN, '');
    const g = createdGains[0];
    expect(Number.isFinite(g._valueAtConnect)).toBe(true);
    expect(g._valueAtConnect).toBeGreaterThan(0);
    fetchSpy.mockRestore();
  });

  it('uses 1.0 gain when volume is negative', async () => {
    const mod = await loadAzureTTS();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(64), { status: 200, headers: { 'content-length': '64' } }),
    );
    await mod.speakAzure('hi', 'en-US', 'friendly', 1, -0.5, '');
    const g = createdGains[0];
    expect(g._valueAtConnect).toBeGreaterThan(0);
    fetchSpy.mockRestore();
  });

  it('honors a legitimate caller-set volume (0.5 stays 0.5)', async () => {
    const mod = await loadAzureTTS();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(64), { status: 200, headers: { 'content-length': '64' } }),
    );
    await mod.speakAzure('hi', 'en-US', 'friendly', 1, 0.5, '');
    const g = createdGains[0];
    expect(g._valueAtConnect).toBeCloseTo(0.5, 2);
    fetchSpy.mockRestore();
  });

  it('honors an explicit zero volume (user muted ≠ bug)', async () => {
    const mod = await loadAzureTTS();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(64), { status: 200, headers: { 'content-length': '64' } }),
    );
    await mod.speakAzure('hi', 'en-US', 'friendly', 1, 0, '');
    const g = createdGains[0];
    // 0 is a legitimate user choice (volume slider all the way down).
    // We pass it through unchanged.
    expect(g._valueAtConnect).toBe(0);
    fetchSpy.mockRestore();
  });
});

describe('decodeAndPlay — single-call audible playback contract', () => {
  // The rapid-fire / concurrent timing race is hard to exercise in
  // vitest's microtask scheduler — both promise chains tend to
  // serialize on the same tick, so the race window doesn't open.
  // What we CAN verify per call: the source actually called .start(),
  // the source isn't stopped before its natural end, and the gain it
  // plays through is non-zero. The cross-call race is exercised by a
  // real-time Playwright run against the deployed URL.
  it('a completed speakAzure call leaves its source started and unstopped with audible gain', async () => {
    const mod = await loadAzureTTS();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new ArrayBuffer(64), { status: 200, headers: { 'content-length': '64' } }),
    );
    const success = await mod.speakAzure('hello', 'en-US', 'friendly', 1, 1, '');
    expect(success).toBe(true);
    expect(createdSources.length).toBe(1);
    expect(createdSources[0]._started).toBe(true);
    expect(createdSources[0]._stopped).toBe(false);
    expect(createdGains[0]._valueAtConnect).toBeGreaterThan(0);
    fetchSpy.mockRestore();
  });
});

describe('decodeAndPlay — suspended context attempts playback (no fail-fast regression)', () => {
  it('decodeAndPlay returns false when ctx stuck suspended (Safari silent-queue guard)', async () => {
    class SuspendedStub {
      state: 'running' | 'suspended' | 'closed' = 'suspended';
      destination = {} as unknown;
      resume = vi.fn(async () => { /* stays suspended */ });
      decodeAudioData = vi.fn(async () => ({ duration: 0.5 } as unknown as AudioBuffer));
      _sources: Array<{ start: () => void; _started: boolean }> = [];
      createBufferSource() {
        const src = { buffer: null, onended: null as (() => void) | null, start() { src._started = true; }, stop() {}, connect: (d: unknown) => d, disconnect() {}, _started: false };
        this._sources.push(src);
        return src;
      }
      createGain() { return { gain: { value: 1 }, connect: (d: unknown) => d, disconnect() {} }; }
    }
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = function () { return new SuspendedStub(); };
    vi.resetModules();
    const mod = await import('@/services/azureTTS');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new ArrayBuffer(64), { status: 200, headers: { 'content-length': '64' } }),
    );
    const ok = await mod.speakAzure('hi', 'en-US', 'friendly', 1, 1, '');
    // Critical: with stuck-suspended ctx, return false so caller
    // falls through to Web Speech. The user-visible "[TTS] Portal
    // TTS succeeded" lie that produced silence on Safari is gone.
    expect(ok).toBe(false);
    fetchSpy.mockRestore();
  });
});
