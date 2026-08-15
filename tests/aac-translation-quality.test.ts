/**
 * Regression suite for the 2026-08-15 "translation is bad" report (IMG_2433).
 *
 * Live evidence captured from production before writing these tests:
 *
 *   POST /api/v1/prism-aac/chat  intent=translate  "How are you? Now I can"
 *     -> "Ce mai faci? Acum pot"                    <- correct, idiomatic Romanian
 *
 *   Same route, after markExplicitFirstPerson rewrote the source:
 *     "How are you? Now ⟦AAC_I⟧ can"
 *     -> "Ce mai faci? Acum ⟦AAC_I⟧ pot"
 *     -> restoreMarkedFirstPerson()  -> "Ce mai faci? Acum eu pot"   <- what shipped
 *
 * The model was right and the client corrupted it. `preserveExplicitFirstPerson`
 * is documented as protecting an *explicitly selected* AAC first-person concept,
 * but it is implemented as "the source text contains the standalone word I".
 * English is not pro-drop, so every English sentence with a first-person verb
 * trips it — including ones the user typed letter by letter on the keyboard.
 *
 * The leading-pronoun case ("I looking" -> "eu caut") is a real AAC signal and
 * must keep working; that is pinned in translate-service.test.ts and re-pinned
 * here so a fix to the mid-sentence case cannot silently delete it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { translateAIMock } = vi.hoisted(() => ({
  translateAIMock: vi.fn(async (): Promise<string> => ''),
}));
vi.mock('@/services/aiService', () => ({ translateAI: translateAIMock }));

import { translateWithAIRefine, clearTranslationCache, abortTranslation } from '@/services/translateService';
import { AAC_FIRST_PERSON_MARKER } from '@/constants/translationMarkers';

/** The exact utterance from the user's screenshot. */
const SOURCE = 'How are you? Now I can';
/** What gemini-3.6-flash actually returns for it (captured from prod). */
const NATURAL_RO = 'Ce mai faci? Acum pot';

beforeEach(() => {
  vi.useFakeTimers();
  clearTranslationCache();
  abortTranslation();
  translateAIMock.mockReset();
});
afterEach(() => {
  abortTranslation();
  vi.useRealTimers();
});

describe('translation: a grammatically-required source pronoun is not an AAC selection', () => {
  it('keeps the model\'s natural pro-drop translation for a mid-sentence "I"', async () => {
    translateAIMock.mockResolvedValue(NATURAL_RO);
    const onRefined = vi.fn();

    translateWithAIRefine(SOURCE, 'en', 'ro', onRefined, { force: true });
    await vi.runAllTimersAsync();

    // Shipped behaviour produces "Ce mai faci? Acum eu pot".
    expect(onRefined).toHaveBeenCalledWith(NATURAL_RO);
  });

  it('does not spend a second LLM round-trip on a mid-sentence "I"', async () => {
    translateAIMock.mockResolvedValue(NATURAL_RO);

    translateWithAIRefine(SOURCE, 'en', 'ro', vi.fn(), { force: true });
    await vi.runAllTimersAsync();

    // Every English AAC utterance contains "I". A second call here doubles
    // both latency and cloud spend for every single translated phrase.
    expect(translateAIMock).toHaveBeenCalledTimes(1);
  });

  it('never sends the internal marker token to the model for a mid-sentence "I"', async () => {
    translateAIMock.mockResolvedValue(NATURAL_RO);

    translateWithAIRefine(SOURCE, 'en', 'ro', vi.fn(), { force: true });
    await vi.runAllTimersAsync();

    for (const call of translateAIMock.mock.calls) {
      expect(String(call[0])).not.toContain(AAC_FIRST_PERSON_MARKER);
    }
  });
});

describe('translation: explicit leading AAC first-person is still preserved', () => {
  it('repairs a dropped leading pronoun (existing AAC contract)', async () => {
    translateAIMock.mockResolvedValue('Caut');
    const onRefined = vi.fn();

    translateWithAIRefine('I looking', 'en', 'ro', onRefined, { force: true });
    await vi.runAllTimersAsync();

    expect(onRefined).toHaveBeenCalledWith('eu caut');
  });

  it('leaves a translation that already carries the pronoun alone', async () => {
    translateAIMock.mockResolvedValue('Eu caut');
    const onRefined = vi.fn();

    translateWithAIRefine('I looking', 'en', 'ro', onRefined, { force: true });
    await vi.runAllTimersAsync();

    expect(onRefined).toHaveBeenCalledWith('eu caut');
  });
});

describe('translation: the marker-rejection path stays narrow', () => {
  it('an ordinary mid-sentence "I" never reaches the rejection path', async () => {
    // The rejection path returns '' — callers read that as "no translation" and
    // silently drop the user back to the word-by-word offline dictionary. That
    // is an acceptable trade only for an explicitly SELECTED pronoun the target
    // language attaches grammar to (ja/ko), which is pinned in
    // translate-service.test.ts. It must never fire for ordinary English
    // grammar, or every first-person sentence risks being blanked.
    translateAIMock.mockResolvedValue(NATURAL_RO);
    const onRefined = vi.fn();

    translateWithAIRefine(SOURCE, 'en', 'ro', onRefined, { force: true });
    await vi.runAllTimersAsync();

    expect(onRefined).toHaveBeenCalled();
    const delivered = onRefined.mock.calls.at(-1)?.[0];
    expect(delivered).toBeTruthy();
    expect(delivered).not.toContain(AAC_FIRST_PERSON_MARKER);
  });
});
