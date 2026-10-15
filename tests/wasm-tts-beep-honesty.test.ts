/**
 * The last-resort tones must not report success when nothing could play: an
 * audio context that will not run (autoplay policy, a backgrounded tab, a call
 * or another app holding audio) means no tones were heard, and speak() must
 * record that it gave up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/** A fresh module per test: wasmTTS keeps one audio context for the page. */
async function load() {
  vi.resetModules();
  return import('@/services/wasmTTS');
}

let oscillatorsStarted = 0;
const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });

class StubAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {});
  createGain = vi.fn(() => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }));
  createOscillator = vi.fn(() => {
    const osc = {
      type: 'sine', frequency: param(), onended: null as null | (() => void),
      connect: vi.fn(), disconnect: vi.fn(),
      start: vi.fn(() => { oscillatorsStarted += 1; }),
      stop: vi.fn(() => { queueMicrotask(() => osc.onended?.()); }),
    };
    return osc;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  oscillatorsStarted = 0;
});

describe('speakWasm — last-resort tones', () => {
  // Control: the stub can play, so the two cases below fail for the reason named.
  it('plays tones and reports it when audio is running', async () => {
    vi.stubGlobal('AudioContext', StubAudioContext);
    const { speakWasm, setWasmTTSConfig } = await load();
    setWasmTTSConfig({ enabled: true });

    await expect(speakWasm('a', 'en')).resolves.toBe(true);
    expect(oscillatorsStarted).toBeGreaterThan(0);
  });

  it('reports that nothing played when audio cannot resume', async () => {
    class Stuck extends StubAudioContext {
      state = 'suspended';
      resume = vi.fn(async () => { throw new Error('not allowed'); });
    }
    vi.stubGlobal('AudioContext', Stuck);
    const { speakWasm, setWasmTTSConfig } = await load();
    setWasmTTSConfig({ enabled: true });

    await expect(speakWasm('a', 'en')).resolves.toBe(false);
    expect(oscillatorsStarted).toBe(0);
  });

  it('reports that nothing played when audio stays interrupted (a call, another app)', async () => {
    class Interrupted extends StubAudioContext {
      state = 'interrupted';
    }
    vi.stubGlobal('AudioContext', Interrupted);
    const { speakWasm, setWasmTTSConfig } = await load();
    setWasmTTSConfig({ enabled: true });

    await expect(speakWasm('a', 'en')).resolves.toBe(false);
    expect(oscillatorsStarted).toBe(0);
  });
});
