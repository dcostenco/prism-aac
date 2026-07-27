import { describe, it, expect } from 'vitest';
import { getLetterRows, getPredictionsForLanguage, LETTERS_ROWS, NUMBERS_ROWS, SYMBOLS_ROWS } from '@/constants/keyboardLayouts';

describe('Keyboard layouts — getLetterRows', () => {
  it('returns QWERTY layout for English', () => {
    const rows = getLetterRows('en');
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe('Q');
    expect(rows[0][9]).toBe('P');
    expect(rows[1][0]).toBe('A');
    expect(rows[2][0]).toBe('Z');
    expect(rows[2][6]).toBe('M');
  });

  it('returns Cyrillic layout for Russian', () => {
    const rows = getLetterRows('ru');
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe('Й');
    expect(rows[1][0]).toBe('Ф');
    expect(rows[2][0]).toBe('Я');
  });

  it('returns Romanian layout with diacritics', () => {
    const rows = getLetterRows('ro');
    expect(rows).toHaveLength(3);
    // Third row should have diacritics
    const thirdRow = rows[2];
    expect(thirdRow).toContain('Ă');
    expect(thirdRow).toContain('Â');
    expect(thirdRow).toContain('Î');
    expect(thirdRow).toContain('Ș');
    expect(thirdRow).toContain('Ț');
  });

  it('returns Arabic layout for Arabic', () => {
    const rows = getLetterRows('ar');
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe('ض');
    expect(rows[1][0]).toBe('ش');
    expect(rows[2][0]).toBe('ئ');
  });

  it('returns German layout with umlauts', () => {
    const rows = getLetterRows('de');
    expect(rows).toHaveLength(3);
    const allLetters = rows.flat();
    expect(allLetters).toContain('Ü');
    expect(allLetters).toContain('Ö');
    expect(allLetters).toContain('Ä');
    expect(allLetters).toContain('ß');
  });

  it('returns French AZERTY-style layout', () => {
    const rows = getLetterRows('fr');
    expect(rows[0][0]).toBe('A');
    expect(rows[0][1]).toBe('Z');
    const allLetters = rows.flat();
    expect(allLetters).toContain('É');
    expect(allLetters).toContain('Ç');
  });

  it('returns Japanese Hiragana layout', () => {
    const rows = getLetterRows('ja');
    // 5 rows, not 3: the layout used to stop at は行, leaving ま/や/ら/わ行 and
    // ん untypable. The old length assertion locked that gap in.
    // 5 kana rows + 1 modifier row (゛゜小), which are not characters.
    expect(rows).toHaveLength(6);
    expect(rows.slice(0, 5).flat()).toHaveLength(46);
    expect(rows.flat()).toContain('ん');
    expect(rows[0][0]).toBe('あ');
  });

  it('returns Korean layout', () => {
    const rows = getLetterRows('ko');
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe('ㅂ');
  });

  it('falls back to QWERTY for unknown/unsupported language', () => {
    // zh is mapped to QWERTY (same as English)
    const rows = getLetterRows('zh');
    expect(rows[0][0]).toBe('Q');
    expect(rows[0][9]).toBe('P');
  });
});

describe('Keyboard layouts — getPredictionsForLanguage', () => {
  // Predictions are now derived from Universal Core 36 (Geist et al. ATIA
  // 2021) localized via Cboard's GPLv3 translations + a corrections overlay
  // (see scripts/aac_core_corrections.json). Tests assert the canonical
  // first-person pronoun is present for each language since that's the
  // highest-priority communicative starter and our corrections guarantee it.

  it('returns English predictions starting with "I"', () => {
    const preds = getPredictionsForLanguage('en');
    expect(preds[0]).toBe('I');
  });

  it('returns Romanian predictions starting with "Eu"', () => {
    const preds = getPredictionsForLanguage('ro');
    expect(preds[0]).toBe('Eu');
  });

  it('returns Russian predictions containing "Я"', () => {
    const preds = getPredictionsForLanguage('ru');
    expect(preds).toContain('Я');
  });

  it('returns Spanish predictions containing "Yo"', () => {
    const preds = getPredictionsForLanguage('es');
    expect(preds).toContain('Yo');
  });

  it('returns Arabic predictions containing "أنا"', () => {
    const preds = getPredictionsForLanguage('ar');
    expect(preds).toContain('أنا');
  });

  it('returns French predictions containing "Je"', () => {
    const preds = getPredictionsForLanguage('fr');
    expect(preds).toContain('Je');
  });

  it('returns German predictions containing "Ich"', () => {
    const preds = getPredictionsForLanguage('de');
    expect(preds).toContain('Ich');
  });

  it('returns Chinese predictions containing "我" (all variants)', () => {
    for (const lang of ['zh-Hans', 'zh-Hant', 'zh-HK', 'zh'] as const) {
      const preds = getPredictionsForLanguage(lang);
      expect(preds, `lang=${lang}`).toContain('我');
    }
  });

  it('all prediction arrays have exactly 5 items', () => {
    const languages = ['en', 'es', 'fr', 'pt', 'ro', 'uk', 'ru', 'de', 'ja', 'ko', 'zh', 'zh-Hans', 'zh-Hant', 'zh-HK', 'ar'] as const;
    for (const lang of languages) {
      const preds = getPredictionsForLanguage(lang);
      expect(preds, `lang=${lang}`).toHaveLength(5);
    }
  });
});

describe('Keyboard layouts — Exported constants', () => {
  it('LETTERS_ROWS is the QWERTY layout', () => {
    expect(LETTERS_ROWS).toHaveLength(3);
    expect(LETTERS_ROWS[0][0]).toBe('Q');
  });

  it('NUMBERS_ROWS has numeric and symbol rows', () => {
    expect(NUMBERS_ROWS).toHaveLength(3);
    expect(NUMBERS_ROWS[0]).toContain('1');
    expect(NUMBERS_ROWS[0]).toContain('0');
  });

  it('SYMBOLS_ROWS has special characters', () => {
    expect(SYMBOLS_ROWS).toHaveLength(3);
    expect(SYMBOLS_ROWS[0]).toContain('[');
    expect(SYMBOLS_ROWS[0]).toContain(']');
  });
});
