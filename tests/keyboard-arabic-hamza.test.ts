/**
 * Plan 2026-10-31, Phase 4: the Arabic keyboard had no أ إ آ, so "أنا" (I),
 * "إلى" (to) and "آخر" (last) could not be typed, and a word typed with a
 * bare alef ("اريد") never offered its hamza spelling ("أريد"). The keys sit
 * next to ا (owner-approved after before/after mockups, 2026-11-01), and a
 * typed ا also completes أ إ آ (owner decision, same day).
 *
 * The prediction tests run through the real store, seed and language gate.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildKeyboardRows, getLetterRows } from '@/constants/keyboardLayouts';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { matchesPredictionPrefix } from '@/engine/predictionSpellings';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';

// The 28 letters, the letter forms ة ى, and hamza alone and on its seats.
const ARABIC_LETTERS = [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي', ...'ةى', ...'ءئؤأإآ'];

describe('Arabic keyboard letters', () => {
  it('puts أ إ آ right after ا and leaves rows 1 and 3 as they were', () => {
    expect(getLetterRows('ar')).toEqual([
      ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
      ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'أ', 'إ', 'آ', 'ت', 'ن', 'م', 'ك', 'ة'],
      ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'و', 'ز', 'ظ', 'ط', 'ذ', 'د'],
    ]);
  });

  it('offers every Arabic letter exactly once', () => {
    const keys = getLetterRows('ar').flat();
    expect(ARABIC_LETTERS).toHaveLength(36);
    expect(new Set(keys)).toEqual(new Set(ARABIC_LETTERS));
    expect(keys).toHaveLength(ARABIC_LETTERS.length);
  });

  it('keeps four rows of at most ten on a phone, with أ إ آ still next to ا', () => {
    const rows = buildKeyboardRows(getLetterRows('ar'), true);
    expect(rows.map(row => row.keys.join(''))).toEqual(['ضصثقفغعهخح', 'شسيبلاأإآت', 'ئءؤرىوز', 'جنمكةظطذد']);
    expect(rows.map(row => row.util)).toEqual([false, false, true, false]);
    expect(rows.every(row => row.keys.length <= 10)).toBe(true);
  });

  it('keeps three rows on wide and short screens (the fold is for Latin keyboards)', () => {
    for (const short of [false, true]) {
      expect(buildKeyboardRows(getLetterRows('ar'), false, short).map(row => row.keys.length)).toEqual([11, 14, 11]);
    }
  });

  it('lets every new letter through the Arabic word filter', () => {
    for (const word of ['أنا', 'إلى', 'آخر']) expect(isAllowedInLang(word, 'ar', { allowUnknown: true })).toBe(true);
  });
});

describe('a typed ا completes أ إ آ', () => {
  it('matches hamza and madda words from a bare alef, anywhere in the word', () => {
    expect(matchesPredictionPrefix('أنا', 'ان', 'ar')).toBe(true);
    expect(matchesPredictionPrefix('إلى', 'ال', 'ar')).toBe(true);
    expect(matchesPredictionPrefix('آخر', 'اخ', 'ar')).toBe(true);
    expect(matchesPredictionPrefix('سأل', 'سا', 'ar')).toBe(true);
  });

  it('keeps an explicitly typed أ إ آ exact', () => {
    expect(matchesPredictionPrefix('انظر', 'أن', 'ar')).toBe(false);
    expect(matchesPredictionPrefix('أنا', 'إن', 'ar')).toBe(false);
    expect(matchesPredictionPrefix('آخر', 'أخ', 'ar')).toBe(false);
  });

  it('skips the vowel marks some seed words carry', () => {
    expect(matchesPredictionPrefix('أشاهِد', 'اشاهد', 'ar')).toBe(true);
    expect(matchesPredictionPrefix('آمنًا', 'امنا', 'ar')).toBe(true);
    expect(matchesPredictionPrefix('أنا', 'انَا', 'ar')).toBe(true);
  });

  it('does not fold alef in other languages', () => {
    expect(matchesPredictionPrefix('أنا', 'ان', 'fa')).toBe(false);
  });
});

function shown(text: string): string[] {
  usePredictionStore.getState().updatePredictions(text, 'ar');
  return usePredictionStore.getState().predictions.filter(word => isAllowedInLang(word, 'ar', { allowUnknown: true }));
}

describe('Arabic predictions typed with a bare alef', () => {
  beforeAll(async () => {
    useSettingsStore.setState({ language: 'ar' });
    await ensureLangCorpusLoaded('ar');
    usePredictionStore.getState().updatePredictions('', 'ar');
    await loadPredictionSeed('ar');
    await Promise.resolve();
  });

  it('"اريد" offers أريد first', () => {
    expect(shown('اريد')[0]).toBe('أريد');
  });

  it('"ا" offers أنا and إلى', () => {
    expect(shown('ا')).toEqual(expect.arrayContaining(['أنا', 'إلى']));
  });

  it('"اخر" offers آخر', () => {
    expect(shown('اخر')).toContain('آخر');
  });

  it('keeps bare-alef words that are words of their own: "انظ" offers انظر (look!) and أنظر (I look)', () => {
    expect(shown('انظ')).toEqual(expect.arrayContaining(['انظر', 'أنظر']));
  });

  it('an explicitly typed أ offers أنا and no bare-alef word', () => {
    const words = shown('أن');
    expect(words).toContain('أنا');
    expect(words.some(word => word.startsWith('ان'))).toBe(false);
  });

  // Sol review 2026-11-01: folded matches must not crowd out the words that
  // match as typed. They get at most two slots while those words remain.
  it('"اسم" keeps اسمع (listen!) and اسمي next to the folded أسماء / أسمع', () => {
    const words = shown('اسم');
    expect(words).toEqual(expect.arrayContaining(['اسمع', 'اسمي']));
    expect(words.filter(word => !word.startsWith('اسم'))).toHaveLength(2);
  });

  it('"اذه" offers both اذهب (go!) and أذهب (I go)', () => {
    expect(shown('اذه')).toEqual(expect.arrayContaining(['اذهب', 'أذهب']));
  });

  it('"اكل" fills the bar with folded words when nothing matches as typed', () => {
    expect(shown('اكل')).toEqual(expect.arrayContaining(['أكل', 'آكل', 'أكلت']));
  });
});
