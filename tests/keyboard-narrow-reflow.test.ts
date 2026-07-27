import { describe, it, expect } from 'vitest';
/**
 * Nine of the 24 keyboard layouts carry a row wider than 10 keys. On a 390px
 * phone that row overflowed the viewport, slicing Shift off the left edge and
 * Backspace off the right — both unreachable. The surplus now wraps to a
 * continuation row rather than every key shrinking, because the users who rely
 * on this have motor impairments and a 22px key is a mis-tap.
 */
import {
  buildKeyboardRows,
  getLetterRows,
  UTIL_ROW_OVERFLOW_KEYS,
  UTIL_ROW_BASE_KEYS,
  UTIL_ROW_INDEX,
} from '@/constants/keyboardLayouts';
import type { SupportedLanguage } from '@/engine/i18n';

// Layouts whose util row exceeds the overflow threshold.
const WRAPPING_LANGS: SupportedLanguage[] = ['ro', 'it', 'uk', 'ar'];
const ALL_LANGS: SupportedLanguage[] = [
  'en', 'es', 'fr', 'pt', 'ro', 'uk', 'ru', 'de', 'ja', 'ko', 'zh',
  'ar', 'hi', 'it', 'pl', 'he', 'nl', 'vi', 'tl', 'tr', 'id', 'bg',
];

describe('buildKeyboardRows — narrow phone reflow', () => {
  it('leaves every layout untouched on a wide viewport', () => {
    for (const lang of ALL_LANGS) {
      const raw = getLetterRows(lang);
      const built = buildKeyboardRows(raw, false);
      expect(built.map((r) => r.keys), lang).toEqual(raw);
      expect(built.filter((r) => r.continuation), lang).toHaveLength(0);
    }
  });

  it('keeps every key reachable — no key is dropped when wrapping', () => {
    for (const lang of ALL_LANGS) {
      const raw = getLetterRows(lang);
      const built = buildKeyboardRows(raw, true);
      expect(built.flatMap((r) => r.keys).join(''), lang).toBe(raw.flat().join(''));
    }
  });

  it('brings every util row within the overflow threshold', () => {
    for (const lang of ALL_LANGS) {
      for (const row of buildKeyboardRows(getLetterRows(lang), true)) {
        if (!row.util) continue;
        expect(row.keys.length, `${lang} util row`).toBeLessThanOrEqual(UTIL_ROW_OVERFLOW_KEYS);
      }
    }
  });

  it('never reflows a row that does not carry Shift/Backspace', () => {
    for (const lang of ALL_LANGS) {
      const raw = getLetterRows(lang);
      const built = buildKeyboardRows(raw, true);
      raw.forEach((row, i) => {
        if (i !== UTIL_ROW_INDEX) expect(built.some((b) => b.keys === row), lang).toBe(true);
      });
    }
  });

  it('keeps Shift and Backspace on exactly one row per layout', () => {
    for (const lang of ALL_LANGS) {
      const built = buildKeyboardRows(getLetterRows(lang), true);
      expect(built.filter((r) => r.util), lang).toHaveLength(1);
      // ...and on the head of the split, so their position never moves.
      expect(built[UTIL_ROW_INDEX]?.util, lang).toBe(true);
    }
  });

  it('actually wraps the layouts that overflow', () => {
    for (const lang of WRAPPING_LANGS) {
      const built = buildKeyboardRows(getLetterRows(lang), true);
      expect(built.some((r) => r.continuation), lang).toBe(true);
    }
  });

  it('puts the Romanian diacritics on their own row, base letters intact', () => {
    const built = buildKeyboardRows(getLetterRows('ro'), true);
    expect(built[UTIL_ROW_INDEX].keys).toEqual(['Z', 'X', 'C', 'V', 'B', 'N', 'M']);
    expect(built[UTIL_ROW_INDEX].util).toBe(true);
    expect(built[UTIL_ROW_INDEX + 1]).toEqual({
      keys: ['Ă', 'Â', 'Î', 'Ș', 'Ț'],
      util: false,
      continuation: true,
    });
    expect(UTIL_ROW_BASE_KEYS).toBe(7);
  });

  it('does not wrap English, which already fits', () => {
    const built = buildKeyboardRows(getLetterRows('en'), true);
    expect(built.filter((r) => r.continuation)).toHaveLength(0);
    expect(built).toHaveLength(3);
  });
});
