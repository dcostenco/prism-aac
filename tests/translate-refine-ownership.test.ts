/**
 * Ownership invariants for the cloud refine.
 *
 * Three call sites can ask for a refine of the same phrase: MessageBar's
 * translation effect (display), MessageBar's composition timer, and the
 * keyboard's Speak / sentence-end handlers (speech). They all funnel into
 * translateWithAIRefine, which keeps ONE module-level timer and abort
 * controller and cancels it unconditionally on entry — so the second caller
 * kills the first caller's request even when both want the identical phrase.
 *
 * Traced in the browser on "I want water." (en->ro):
 *
 *   [SCHEDULE] "I want water." force=true    <- keyboard, on the keypress
 *   [WAIT]     "I want water."               <- speech joins
 *   [SCHEDULE] "I want water." force=false   <- MessageBar effect, cancels it
 *   [RESULT]   refined=null offline="Vreau water."
 *
 * The user saw "eu vreau apă." and heard "Vreau water." — a half-translated
 * mix that looksLikeTargetLang cannot reject, since Romanian and English share
 * the Latin script. For an AAC user the spoken string IS the product.
 *
 * The `lastAiText` dedupe cannot prevent this because it is assigned inside the
 * 200 ms timer, i.e. after both callers have already passed the check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { translateAIMock } = vi.hoisted(() => ({
  translateAIMock: vi.fn(async (): Promise<string> => 'eu vreau apă.'),
}));
vi.mock('@/services/aiService', () => ({ translateAI: translateAIMock }));

import {
  translateWithAIRefine,
  translateForSpeech,
  clearTranslationCache,
  abortTranslation,
} from '@/services/translateService';

const PHRASE = 'I want water.';

beforeEach(() => {
  vi.useFakeTimers();
  clearTranslationCache();
  abortTranslation();
  translateAIMock.mockReset();
  translateAIMock.mockResolvedValue('eu vreau apă.');
});
afterEach(() => {
  abortTranslation();
  vi.useRealTimers();
});

describe('a refine is owned by its phrase, not by the last caller', () => {
  it('does not re-request when a second caller asks for the same phrase', async () => {
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {}, { force: true });
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {});      // display, same phrase
    await vi.runAllTimersAsync();

    expect(translateAIMock).toHaveBeenCalledTimes(1);
  });

  it('still delivers the refinement to the first caller after a second joins', async () => {
    const first = vi.fn();
    translateWithAIRefine(PHRASE, 'en', 'ro', first, { force: true });
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {});
    await vi.runAllTimersAsync();

    expect(first).toHaveBeenCalledWith('eu vreau apă.');
  });

  it('cancels the previous refine when the phrase actually changes', async () => {
    translateWithAIRefine('I want water', 'en', 'ro', () => {}, { force: true });
    translateWithAIRefine('I want juice.', 'en', 'ro', () => {}, { force: true });
    await vi.runAllTimersAsync();

    const sent = translateAIMock.mock.calls.map((c) => String(c[0]));
    expect(sent).toEqual(['I want juice.']);
  });
});

describe('speech joins the refine the display already started', () => {
  it('resolves with the refined translation, not the offline dictionary', async () => {
    // Display starts first (this is the real ordering at a sentence boundary).
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {});
    const spoken = translateForSpeech(PHRASE, 'en', 'ro');
    await vi.runAllTimersAsync();

    await expect(spoken).resolves.toBe('eu vreau apă.');
  });

  it('resolves with the refined translation when speech asks first', async () => {
    const spoken = translateForSpeech(PHRASE, 'en', 'ro');
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {});   // display joins after
    await vi.runAllTimersAsync();

    await expect(spoken).resolves.toBe('eu vreau apă.');
  });

  it('never resolves with a half-translated source word left in it', async () => {
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {});
    const spoken = await (async () => {
      const p = translateForSpeech(PHRASE, 'en', 'ro');
      await vi.runAllTimersAsync();
      return p;
    })();

    expect(String(spoken).toLowerCase()).not.toMatch(/\bwater\b/);
  });
});

describe('an already-refined phrase is never re-requested', () => {
  it('does not translate the same phrase twice', async () => {
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {}, { force: true });
    await vi.runAllTimersAsync();
    expect(translateAIMock).toHaveBeenCalledTimes(1);

    // A later caller — the composition timer fires at COMPOSITION_SILENCE_MS,
    // two seconds after the refine already landed.
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {}, { force: true });
    await vi.runAllTimersAsync();
    expect(translateAIMock).toHaveBeenCalledTimes(1);
  });

  it('serves speech from the completed refinement without a new request', async () => {
    translateWithAIRefine(PHRASE, 'en', 'ro', () => {}, { force: true });
    await vi.runAllTimersAsync();

    const spoken = translateForSpeech(PHRASE, 'en', 'ro');
    await vi.runAllTimersAsync();

    await expect(spoken).resolves.toBe('eu vreau apă.');
    expect(translateAIMock).toHaveBeenCalledTimes(1);
  });
});
