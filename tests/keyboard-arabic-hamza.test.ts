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
import { isArabicHamzaSpellingOf, matchesPredictionPrefix } from '@/engine/predictionSpellings';
import { getPredictions } from '@/engine/predictionEngine';
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

  it('recognises the typed word itself written with hamza, and nothing longer', () => {
    expect(isArabicHamzaSpellingOf('أريد', 'اريد')).toBe(true);
    expect(isArabicHamzaSpellingOf('أشاهِد', 'اشاهد')).toBe(true);
    expect(isArabicHamzaSpellingOf('أريدك', 'اريد')).toBe(false);
    expect(isArabicHamzaSpellingOf('اريد', 'اريد')).toBe(false);
    // An explicitly typed hamza stays exact even where another ا folds.
    expect(isArabicHamzaSpellingOf('أإبا', 'أابا')).toBe(true);
    expect(isArabicHamzaSpellingOf('إابا', 'أابا')).toBe(false);
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
    // The two-slot limit is for the first pass only: with no word that
    // matches as typed, the backfill shows more than two folded words.
    const words = shown('اكل');
    expect(words).toEqual(expect.arrayContaining(['أكل', 'آكل', 'أكلت']));
    expect(words).toHaveLength(5);
    expect(words.slice(0, 4).every(word => /^[أإآ]كل/.test(word))).toBe(true);
  });
});

// Fixed word tables, so the ranking rules are pinned whatever the seed says.
// "اسم" and "اريد" count as complete words (count ≥ 100).
describe('folded Arabic matches on the bar (engine rules)', () => {
  const AR_SCRIPT = /^[\u0600-\u06FF]+$/;
  const freq = (entries: Record<string, number>) =>
    Object.fromEntries(Object.entries(entries).map(([word, count]) => [word, { count, lastUsed: 0 }]));
  const predict = (text: string, words: Record<string, number>, bigrams: Record<string, number> = {}) =>
    getPredictions(text, freq(words), freq(bigrams), undefined, {}, [], new Set(), AR_SCRIPT, 'ar');

  it('a complete typed word keeps its one look-alike slot for a word that matches as typed', () => {
    const shown = predict('اسم', { 'اسم': 500, 'أسماء': 400, 'اسمي': 50 });
    expect(shown).toContain('اسمي');
    expect(shown).not.toContain('أسماء');
  });

  it("a complete typed word's own hamza spelling is still offered, beside a word that matches as typed", () => {
    const shown = predict('اريد', { 'اريد': 200, 'أريد': 450, 'اريدها': 300 });
    expect(shown).toEqual(expect.arrayContaining(['أريد', 'اريدها']));
  });

  // Sol review round 3: the typed word's own hamza spelling is the word
  // itself, so a full stem group of words that fit the context (أريدك,
  // أريده after أنا) must not push it off the bar.
  it("the typed word's own hamza spelling is kept when its stem group is full", () => {
    const shown = predict('أنا اريد', { 'أنا': 500, 'اريد': 200, 'أريد': 100, 'أريدك': 40, 'أريده': 40 },
      { 'أنا|أريدك': 50, 'أنا|أريده': 50 });
    expect(shown).toEqual(expect.arrayContaining(['أريدك', 'أريده', 'أريد']));
    expect(shown.length).toBeLessThanOrEqual(5);
    expect(new Set(shown).size).toBe(shown.length);
  });

  // Sol review round 5: when no word that matches as typed takes the
  // look-alike slot, the folded one keeps its ranked place; lower-ranked
  // words must not use up the folded slots, the bar or its stem group first.
  it('a folded look-alike keeps its place ahead of lower-ranked folded words', () => {
    const shown = predict('يا اسم', { 'يا': 500, 'اسم': 500, 'أسماء': 800, 'إسماعيل': 1, 'أسماك': 1 },
      { 'يا|إسماعيل': 1, 'يا|أسماك': 1 });
    expect(shown[0]).toBe('أسماء');
    expect(shown).toContain('إسماعيل');
  });

  it('a folded look-alike keeps its place when next words would fill the bar', () => {
    const next = ['جميل', 'طويل', 'جديد', 'قديم', 'كبير'];
    const shown = predict('اسم', { 'اسم': 500, 'أسماء': 800, ...Object.fromEntries(next.map(w => [w, 1])) },
      Object.fromEntries(next.map(w => [`اسم|${w}`, 1])));
    expect(shown).toHaveLength(5);
    expect(shown[0]).toBe('أسماء');
  });

  it('a folded look-alike keeps its place in its stem group', () => {
    const shown = predict('يا اسم', { 'يا': 500, 'اسم': 500, 'أسماء': 800, 'أسمائي': 1, 'أسمائه': 1 },
      { 'يا|أسمائي': 1, 'يا|أسمائه': 1 });
    expect(shown[0]).toBe('أسماء');
  });

  // Sol review round 4: a word that matches as typed but is refused by the
  // stem limit (اسمي, after the contextual اسمك / اسمه fill the group) must
  // not keep the look-alike slot: the folded أسماء takes it.
  it('a refused word that matches as typed leaves the look-alike slot to a folded one', () => {
    const shown = predict('يا اسم', { 'يا': 500, 'اسم': 500, 'اسمك': 1000, 'اسمه': 990, 'أسماء': 800, 'اسمي': 50 },
      { 'يا|اسمك': 50, 'يا|اسمه': 50 });
    expect(shown).toEqual(expect.arrayContaining(['اسمك', 'اسمه', 'أسماء']));
  });

  // ...and a later word that matches as typed gets it when the first is refused.
  it('a refused word that matches as typed leaves the look-alike slot to the next one', () => {
    const shown = predict('يا اسم', { 'يا': 500, 'اسم': 500, 'اسمك': 1000, 'اسمه': 990, 'أسماء': 800, 'اسمي': 60, 'اسمع': 50 },
      { 'يا|اسمك': 50, 'يا|اسمه': 50 });
    expect(shown).toEqual(expect.arrayContaining(['اسمك', 'اسمه', 'اسمع']));
    expect(shown).not.toContain('أسماء');
  });

  // Sol review round 3: with no word that matches as typed, the slot goes
  // to the folded completion instead of staying empty, on both sides of the
  // count that makes "اسم" a complete word.
  it('a complete typed word with no completion as typed offers its folded completion', () => {
    for (const count of [99, 100, 500]) {
      expect(predict('اسم', { 'اسم': count, 'أسماء': 400 }), `اسم count ${count}`).toContain('أسماء');
    }
  });

  // The two folded slots are counted only for words shown. The Arabic
  // stemmer puts اسماء and أسماء in one group, so after the two bare forms
  // fill it the folded أسماء / أسمائي are refused; أسماك must still be shown.
  it('folded words refused by the stem limit do not use up the two folded slots', () => {
    const shown = predict('اسما', {
      'اسماء': 1000, 'اسمائي': 990, 'أسماء': 980, 'أسمائي': 970, 'أسماك': 960, 'اسمار': 50, 'اسمال': 50, 'اسماح': 50,
    });
    expect(shown).toHaveLength(5);
    expect(shown).toContain('أسماك');
    expect(shown).not.toContain('أسماء');
  });

  // Sol review round 2: أسماء and أسمع are refused (the complete word's
  // look-alike slot is taken) and must not use up the folded slots, or the
  // contextual إسماعيل is refused too and the bar fills without it.
  it('folded words that were refused do not use up the two folded slots', () => {
    const shown = predict('يا اسم',
      { 'يا': 500, 'اسم': 500, 'اسمك': 950, 'أسماء': 900, 'أسمع': 890, 'إسماعيل': 5, 'اسمه': 5, 'اسمها': 5, 'اسمر': 5, 'اسمين': 5, 'اسمي': 5, 'اسمان': 5 },
      { 'يا|إسماعيل': 12, 'يا|اسمه': 10, 'يا|اسمها': 10, 'يا|اسمر': 10, 'يا|اسمين': 10, 'يا|اسمي': 10, 'يا|اسمان': 10 });
    expect(shown).toHaveLength(5);
    expect(shown).toContain('إسماعيل');
    expect(shown).not.toContain('أسماء');
  });
});
