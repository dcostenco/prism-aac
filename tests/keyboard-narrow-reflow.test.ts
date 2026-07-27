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

// `satisfies` makes this exhaustive at compile time: adding a language to
// SupportedLanguage without listing it here fails tsc. An earlier version of
// this list was hand-written and silently omitted the three zh variants.
const ALL_LANGS = Object.keys({
  en: 1, es: 1, fr: 1, pt: 1, ro: 1, uk: 1, ru: 1, de: 1, ja: 1,
  ko: 1, zh: 1, 'zh-Hans': 1, 'zh-Hant': 1, 'zh-HK': 1, ar: 1, hi: 1,
  it: 1, pl: 1, he: 1, nl: 1, vi: 1, tl: 1, tr: 1, id: 1, bg: 1,
} satisfies Record<SupportedLanguage, 1>) as SupportedLanguage[];

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

  // CJK: all four Chinese variants plus Japanese and Korean are 10/9/7 or
  // 10/10/10, so their util rows sit under the threshold and nothing wraps.
  // Asserted rather than assumed — these are romanised/kana input layouts, and
  // a future Cangjie or Zhuyin layout could push the util row over.
  it.each(['zh', 'zh-Hans', 'zh-Hant', 'zh-HK', 'ja', 'ko'] as SupportedLanguage[])(
    'leaves %s unwrapped and byte-identical',
    (lang) => {
      const raw = getLetterRows(lang);
      expect(raw[UTIL_ROW_INDEX].length).toBeLessThanOrEqual(UTIL_ROW_OVERFLOW_KEYS);
      expect(buildKeyboardRows(raw, true).map((r) => r.keys)).toEqual(raw);
    },
  );

  // Arabic is RTL with 11 keys on every row, so it does wrap. The split is by
  // logical order; the browser mirrors it visually from dir="rtl", so the head
  // must stay a contiguous logical prefix or the letters land out of sequence.
  it('splits Arabic on logical order, preserving sequence', () => {
    const raw = getLetterRows('ar');
    const built = buildKeyboardRows(raw, true);
    const head = built[UTIL_ROW_INDEX];
    const tail = built[UTIL_ROW_INDEX + 1];

    expect(raw[UTIL_ROW_INDEX]).toHaveLength(11);
    expect(head.keys).toEqual(['ئ', 'ء', 'ؤ', 'ر', 'ى', 'و', 'ز']);
    expect(head.util).toBe(true);
    expect(tail.keys).toEqual(['ظ', 'ط', 'ذ', 'د']);
    expect(tail.continuation).toBe(true);
    // Concatenation must reproduce the original row exactly — no reordering.
    expect([...head.keys, ...tail.keys]).toEqual(raw[UTIL_ROW_INDEX]);
  });

  it('leaves Hebrew unwrapped — RTL, but its util row is under the threshold', () => {
    const raw = getLetterRows('he');
    expect(raw[UTIL_ROW_INDEX].length).toBeLessThanOrEqual(UTIL_ROW_OVERFLOW_KEYS);
    expect(buildKeyboardRows(raw, true).map((r) => r.keys)).toEqual(raw);
  });

  // Japanese sits exactly on the threshold. Wrapping it would split a gojūon
  // row, so the boundary is deliberately set to leave it alone.
  it('leaves the Japanese kana rows intact at exactly the threshold', () => {
    const raw = getLetterRows('ja');
    expect(raw[UTIL_ROW_INDEX]).toHaveLength(UTIL_ROW_OVERFLOW_KEYS);
    expect(buildKeyboardRows(raw, true).map((r) => r.keys)).toEqual(raw);
  });
});
