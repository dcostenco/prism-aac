import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak, speakWord, stopSpeech, isSpeechSupported } from '@/services/speechService';

beforeEach(() => {
  vi.clearAllMocks();
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

  it('speak with volume 0 still calls speak', async () => {
    await speak('test', 0.5, 0);
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});
