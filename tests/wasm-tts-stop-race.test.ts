/** Sound Off must invalidate WASM work that has not created audio nodes yet. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyWasmTTS, speakWasm, stopWasmSpeech } from '@/services/wasmTTS';

describe('WASM TTS — pending stop generation', () => {
  afterEach(() => {
    destroyWasmTTS();
    vi.unstubAllGlobals();
  });

  it('does not schedule beeps after Sound Off while AudioContext.resume is pending', async () => {
    let resolveResume!: () => void;
    let resumeStarted = false;
    let oscillatorStarts = 0;
    const resumeGate = new Promise<void>((resolve) => { resolveResume = resolve; });

    class SuspendedAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 0;
      destination = {} as AudioDestinationNode;
      resume = vi.fn(async () => {
        resumeStarted = true;
        await resumeGate;
        this.state = 'running';
      });
      close = vi.fn(async () => { this.state = 'closed'; });
      createGain = vi.fn(() => ({
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));
      createOscillator = vi.fn(() => ({
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(() => { oscillatorStarts += 1; }),
        stop: vi.fn(),
        onended: null,
      }));
    }

    vi.stubGlobal('AudioContext', SuspendedAudioContext);
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: SuspendedAudioContext });

    const pending = speakWasm('hello', 'en-US');
    await vi.waitFor(() => {
      expect(resumeStarted).toBe(true);
    });
    stopWasmSpeech();
    resolveResume();

    await expect(pending).resolves.toBe(false);
    expect(oscillatorStarts).toBe(0);
  });
});
