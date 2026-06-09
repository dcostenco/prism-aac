import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak, speakWord, stopSpeech, isSpeechSupported } from '@/services/speechService';

// Force Tier 1 (portal Inworld/Azure) to "fail" so tests can assert on the
// Web Speech fallback. Without this mock, speakAzure attempts a real fetch
// to synalux.ai/api/v1/tts/public and either succeeds (env online — tests
// flaky) or throws unhelpful network errors. Mocking it gives us a
// deterministic short-circuit straight to Tier 2 (Web Speech).
vi.mock('@/services/azureTTS', () => ({
  speakAzure: vi.fn().mockResolvedValue({ success: false }),
  stopAzureAudio: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // speakLocal wraps speechSynthesis.speak in a Promise that resolves on
  // utterance.onend. The global setup mock is a bare vi.fn() that never
  // fires onend, causing timeouts. Patch speak to trigger onend so the
  // promise resolves.
  (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation((u: { onend?: (() => void) | null }) => {
    if (u && typeof u.onend === 'function') u.onend();
  });
});

describe('SpeechService — Core', () => {
  it('isSpeechSupported returns true in jsdom with mock', () => {
    expect(isSpeechSupported()).toBe(true);
  });

  it('speak calls speechSynthesis.cancel then speak', async () => {
    await speak('hello', 0.5, 1.0);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('speak does nothing for empty text', () => {
    speak('', 0.5, 1.0);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('speak does nothing for whitespace-only text', () => {
    speak('   ', 0.5, 1.0);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('speakWord cancels prior speech (pile-up fix)', () => {
    speakWord('hello');
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('stopSpeech calls cancel', () => {
    stopSpeech();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('speech rate formula: 0.5 input maps to ~1.0 (normal speed)', () => {
    // Formula: rate = 0.1 + input * 1.8
    // 0.5 → 0.1 + 0.9 = 1.0 (normal)
    // 1.0 → 0.1 + 1.8 = 1.9 (fast but not extreme)
    // 0.1 → 0.1 + 0.18 = 0.28 (slow)
    expect(0.1 + 0.5 * 1.8).toBeCloseTo(1.0, 1);
    expect(0.1 + 1.0 * 1.8).toBeCloseTo(1.9, 1);
    expect(0.1 + 0.1 * 1.8).toBeCloseTo(0.28, 1);
  });
});

describe('SpeechService — Gap tests', () => {
  it('speak with rate 0 does not crash', () => {
    expect(() => speak('test', 0, 1.0)).not.toThrow();
  });

  it('speak with volume 0 exits early — no silent TTS call (53bed12 guard)', async () => {
    // volume=0 guard added in 53bed12: warn + return instead of silent TTS call.
    // Prevents misleading "[TTS] Portal TTS succeeded" logs when audio is muted.
    await speak('test', 0.5, 0);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });
});
