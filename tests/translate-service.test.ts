import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock — translateService dynamically imports aiService inside a
// setTimeout, and ESM caches that import after first use. vi.doMock() per
// test is ignored once cached. Hoisted vi.mock + a mutable spy is the
// reliable way to control return values per test.
const { translateAIMock } = vi.hoisted(() => ({
  translateAIMock: vi.fn(async (_text: string, _from: string, _to: string) => ''),
}));
vi.mock('@/services/aiService', () => ({
  translateAI: translateAIMock,
}));

import {
  abortTranslation,
  clearTranslationCache,
  translateText,
  translateTextSync,
  translateWithAIRefine,
} from '@/services/translateService';
import { AAC_FIRST_PERSON_MARKER } from '@/constants/translationMarkers';

const OMITTED_FIRST_PERSON_REFINEMENTS = [
  ['es', 'Estoy buscando', 'Yo estoy buscando'],
  ['pt', 'Estou procurando', 'Eu estou procurando'],
  ['ro', 'Caut', 'eu caut'],
  ['it', 'Sto cercando', 'Io sto cercando'],
  ['pl', 'Szukam', 'Ja szukam'],
  ['tr', 'Arıyorum', 'Ben arıyorum'],
  ['bg', 'Търся', 'Аз търся'],
] as const;

describe('translateService', () => {
  it('returns original text when fromLang === toLang', async () => {
    const result = await translateText('Hello', 'en', 'en');
    expect(result).toBe('Hello');
  });

  it('returns original text for empty input', async () => {
    const result = await translateText('', 'en', 'es');
    expect(result).toBe('');
  });

  it('returns original text for whitespace-only input', async () => {
    const result = await translateText('   ', 'en', 'es');
    expect(result).toBe('   ');
  });

  it('returns original text when AI is unavailable (no account)', async () => {
    const result = await translateText('Hello world', 'en', 'ru');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

/**
 * Script-mismatch sanity check (regression: prism-coder ignored the
 * translate system prompt and replied as the AAC chat assistant in the
 * source language — e.g. "Я иду" RU→EN came back as the Russian greeting
 * "Я здесь, чтобы помочь…", garbage in the translation slot).
 */
describe('translateWithAIRefine — script sanity check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    abortTranslation();
    clearTranslationCache();
    translateAIMock.mockReset();
  });
  afterEach(() => {
    abortTranslation();
    vi.useRealTimers();
  });

  it('translates explicit English "I" to canonical lowercase Romanian "eu"', () => {
    expect(translateTextSync('I', 'en', 'ro')).toBe('eu');
  });

  it.each(OMITTED_FIRST_PERSON_REFINEMENTS)(
    'repairs a %s refinement that omits the leading explicitly selected pronoun',
    async (targetLanguage, omittedRefinement, expectedRefinement) => {
      translateAIMock.mockResolvedValue(omittedRefinement);
      const onRefined = vi.fn();

      translateWithAIRefine('I looking', 'en', targetLanguage, onRefined);
      await vi.runAllTimersAsync();

      expect(onRefined).toHaveBeenCalledWith(expectedRefinement);
    },
  );

  it('keeps lowercase Romanian "eu" in both instant and refined output', async () => {
    translateAIMock.mockResolvedValue('Caut');
    const onRefined = vi.fn();

    const instant = translateWithAIRefine('I looking', 'en', 'ro', onRefined);
    await vi.runAllTimersAsync();

    expect(instant).toMatch(/^eu\b/u);
    expect(onRefined).toHaveBeenCalledWith('eu caut');
  });

  it('normalizes a preserved Romanian pronoun to the canonical AAC token', async () => {
    translateAIMock.mockResolvedValue('Eu caut');
    const onRefined = vi.fn();

    translateWithAIRefine('I looking', 'en', 'ro', onRefined);
    await vi.runAllTimersAsync();

    expect(onRefined).toHaveBeenCalledWith('eu caut');
  });

  it('uses an immutable marker retry for Japanese attached grammar', async () => {
    translateAIMock
      .mockResolvedValueOnce('探しています')
      .mockResolvedValueOnce(`${AAC_FIRST_PERSON_MARKER}は探しています`);
    const onRefined = vi.fn();

    translateWithAIRefine('I looking', 'en', 'ja', onRefined);
    await vi.runAllTimersAsync();

    expect(translateAIMock).toHaveBeenNthCalledWith(
      1,
      'I looking',
      'English',
      'Japanese',
      undefined,
      expect.any(AbortSignal),
    );
    expect(translateAIMock).toHaveBeenNthCalledWith(
      2,
      `${AAC_FIRST_PERSON_MARKER} looking`,
      'English',
      'Japanese',
      undefined,
      expect.any(AbortSignal),
    );
    expect(onRefined).toHaveBeenCalledWith('私は探しています');
  });

  it('uses an immutable marker retry for Korean attached grammar', async () => {
    translateAIMock
      .mockResolvedValueOnce('찾고 있습니다')
      .mockResolvedValueOnce(`${AAC_FIRST_PERSON_MARKER}는 찾고 있습니다`);
    const onRefined = vi.fn();

    translateWithAIRefine('I looking', 'en', 'ko', onRefined);
    await vi.runAllTimersAsync();

    expect(onRefined).toHaveBeenCalledWith('나는 찾고 있습니다');
  });

  it('rejects an attached-grammar retry when the model drops the marker again', async () => {
    translateAIMock
      .mockResolvedValueOnce('探しています')
      .mockResolvedValueOnce('探しています');
    const onRefined = vi.fn();

    translateWithAIRefine('I looking', 'en', 'ja', onRefined);
    await vi.runAllTimersAsync();

    expect(onRefined).not.toHaveBeenCalled();
  });

  it('rejects an "EN translation" returned in Cyrillic (the actual prod regression)', async () => {
    translateAIMock.mockResolvedValue('Я здесь, чтобы помочь. Что бы вы хотели сделать?');
    const onRefined = vi.fn();
    translateWithAIRefine('Я иду домой', 'ru', 'en', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).not.toHaveBeenCalled();
  });

  it('rejects a "RU translation" returned in Latin script', async () => {
    translateAIMock.mockResolvedValue("I'm going home");
    const onRefined = vi.fn();
    translateWithAIRefine('Take me home', 'en', 'ru', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).not.toHaveBeenCalled();
  });

  it('accepts a real EN translation of a RU phrase', async () => {
    translateAIMock.mockResolvedValue("I'm walking home");
    const onRefined = vi.fn();
    translateWithAIRefine('Я иду пешком', 'ru', 'en', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).toHaveBeenCalledWith("I'm walking home");
  });

  it('accepts a real Japanese translation', async () => {
    translateAIMock.mockResolvedValue('家に帰ります');
    const onRefined = vi.fn();
    translateWithAIRefine('Where is the kitchen', 'en', 'ja', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).toHaveBeenCalled();
  });

  it('rejects a "JA translation" returned in Latin script (model fell back to English)', async () => {
    translateAIMock.mockResolvedValue('I am going home (sorry, I cannot translate to Japanese)');
    const onRefined = vi.fn();
    translateWithAIRefine('Open the door now', 'en', 'ja', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).not.toHaveBeenCalled();
  });
});
