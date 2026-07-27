import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak, speakWord, stopSpeech, isSpeechSupported } from '@/services/speechService';
import {
  subscribeTtsHighlight,
  type TtsHighlightEvent,
} from '@/services/ttsHighlightBus';

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

  it('pads a one-letter word so Web Speech says the word instead of "capital I"', () => {
    speakWord('I');
    const utterance = (
      window.speechSynthesis.speak as ReturnType<typeof vi.fn>
    ).mock.calls.at(-1)?.[0] as { text?: string };
    expect(utterance.text).toBe('I.');
  });

  it('publishes local word feedback so the phrase timer cannot duplicate it in cloud TTS', () => {
    const events: TtsHighlightEvent[] = [];
    const unsubscribe = subscribeTtsHighlight((event) => events.push(event));
    try {
      speakWord('I');
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'tts-highlight-start',
          text: 'I',
        }),
      );
    } finally {
      unsubscribe();
    }
  });

  it('rapid speakWord calls keep only one local resume timer alive', () => {
    vi.useFakeTimers();
    try {
      // Keep the utterances active so the test exercises replacement cleanup
      // instead of the normal onend cleanup path.
      (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(() => {});

      speakWord('first');
      speakWord('second');

      expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(10_000);
      // The second call clears the first call's Safari resume workaround.
      // Two callbacks here would mean one leaked interval per rapid tap.
      expect(window.speechSynthesis.resume).toHaveBeenCalledTimes(1);

      stopSpeech();
      vi.advanceTimersByTime(10_000);
      expect(window.speechSynthesis.resume).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a delayed cancellation callback cannot clear the next word resume timer', () => {
    vi.useFakeTimers();
    try {
      const utterances: Array<{
        onend?: (() => void) | null;
        onerror?: ((event: { error: string }) => void) | null;
      }> = [];
      (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation((utterance) => {
        utterances.push(utterance);
      });

      speakWord('first');
      speakWord('second');
      expect(utterances).toHaveLength(2);

      // Safari can report the first cancellation after the second utterance
      // has already installed its resume workaround.
      utterances[0].onerror?.({ error: 'canceled' });
      vi.advanceTimersByTime(10_000);
      expect(window.speechSynthesis.resume).toHaveBeenCalledTimes(1);

      utterances[1].onend?.();
      vi.advanceTimersByTime(10_000);
      expect(window.speechSynthesis.resume).toHaveBeenCalledTimes(1);
    } finally {
      stopSpeech();
      vi.useRealTimers();
    }
  });

  it('resolves the interrupted local-speech promise before the replacement finishes', async () => {
    const utterances: Array<{
      onend?: (() => void) | null;
    }> = [];
    (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation((utterance) => {
      utterances.push(utterance);
    });

    const first = speak('first', 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(utterances).toHaveLength(1));
    const second = speak('second', 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(utterances).toHaveLength(2));

    await expect(first).resolves.toBeUndefined();
    utterances[1].onend?.();
    await expect(second).resolves.toBeUndefined();
  });

  it('cleans up the resume timer when speechSynthesis.speak throws', () => {
    vi.useFakeTimers();
    try {
      (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('synthesis unavailable');
      });

      expect(() => speakWord('hello')).not.toThrow();
      vi.advanceTimersByTime(10_000);
      expect(window.speechSynthesis.resume).not.toHaveBeenCalled();
    } finally {
      stopSpeech();
      vi.useRealTimers();
    }
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
