/**
 * Regression suite for "streaming should start after phrase detected only or manual".
 *
 * MessageBar re-runs translateWithAIRefine from a useEffect keyed on `text`, and
 * the effect cleanup calls abortTranslation(), which resets the `lastAiText`
 * dedupe guard. So each keystroke schedules a fresh 200 ms timer and cancels the
 * previous one.
 *
 * That is fine for a fast typist — the timer never matures. AAC users are the
 * population that types SLOWER than 200 ms per character: switch scanning, head
 * tracking and eye gaze all take longer than that per selection. For them every
 * single keystroke matures into a full cloud translation of a half-written
 * phrase, which is both the cost problem and the reason the blue line shows
 * nonsense mid-composition.
 *
 * Policy pinned here: a translation request may only be issued at a phrase
 * boundary (sentence-ending punctuation) or on an explicit user action.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { translateAIMock } = vi.hoisted(() => ({
  translateAIMock: vi.fn(async (): Promise<string> => 'Ce mai faci? Acum pot'),
}));
vi.mock('@/services/aiService', () => ({ translateAI: translateAIMock }));

import { translateWithAIRefine, clearTranslationCache, abortTranslation } from '@/services/translateService';

const PHRASE = 'How are you? Now I can walk.';
/** Slower than the 200 ms debounce — a switch-scanning or eye-gaze user. */
const SLOW_KEYSTROKE_MS = 450;

beforeEach(() => {
  vi.useFakeTimers();
  clearTranslationCache();
  abortTranslation();
  translateAIMock.mockReset();
  translateAIMock.mockResolvedValue('Ce mai faci? Acum pot');
});
afterEach(() => {
  abortTranslation();
  vi.useRealTimers();
});

/** Replays a slow typist through the same call sequence MessageBar's effect makes. */
async function typeSlowly(phrase: string) {
  for (let i = 1; i <= phrase.length; i++) {
    // MessageBar's effect cleanup runs before the next effect body.
    abortTranslation();
    translateWithAIRefine(phrase.slice(0, i), 'en', 'ro', () => {});
    await vi.advanceTimersByTimeAsync(SLOW_KEYSTROKE_MS);
  }
  await vi.runAllTimersAsync();
}

describe('translation is not re-requested on every keystroke', () => {
  it('does not issue one cloud translation per character for a slow typist', async () => {
    await typeSlowly(PHRASE);

    // One phrase. A handful of requests is defensible; one per character is not.
    expect(translateAIMock.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('never translates a fragment that ends mid-word', async () => {
    await typeSlowly(PHRASE);

    const midWordRequests = translateAIMock.mock.calls
      .map((c) => String(c[0]))
      .filter((sent) => {
        const idx = PHRASE.indexOf(sent);
        if (idx !== 0) return false;
        const nextChar = PHRASE[sent.length];
        // A fragment is mid-word when the source continues with a letter.
        return !!nextChar && /\p{L}/u.test(nextChar) && /\p{L}$/u.test(sent);
      });

    expect(midWordRequests).toEqual([]);
  });
});

describe('the AI refine must not overwrite a correct offline translation', () => {
  it('keeps the offline result when the AI returns the same meaning', async () => {
    // Captured from prod: the offline dictionary already renders
    // "How are you? Now I can" as "Ce mai faci? Acum pot" — identical to
    // gemini-3.6-flash. The refine step must not be able to make it worse.
    const onRefined = vi.fn();
    const instant = translateWithAIRefine('How are you? Now I can', 'en', 'ro', onRefined);
    await vi.runAllTimersAsync();

    expect(instant).toBe('Ce mai faci? Acum pot');
    for (const call of onRefined.mock.calls) {
      expect(String(call[0])).not.toMatch(/\beu\b/);
    }
  });
});
