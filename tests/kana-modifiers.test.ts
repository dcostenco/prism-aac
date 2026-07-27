import { describe, it, expect } from 'vitest';
/**
 * The 46 seion alone cannot write Japanese: です needs で (て + dakuten),
 * ありがとう needs が, and geminates need っ. Three modifier keys transform
 * the kana already typed instead of adding ~25 more keys to a 390px screen.
 */
import {
  applyKanaModifier,
  getLetterRows,
  KANA_DAKUTEN,
  KANA_HANDAKUTEN,
  KANA_SMALL,
  KANA_MODIFIERS,
} from '@/constants/keyboardLayouts';

describe('applyKanaModifier', () => {
  it('writes です — て + dakuten → で', () => {
    expect(applyKanaModifier('て', KANA_DAKUTEN)).toBe('で');
    expect(applyKanaModifier('でて', KANA_DAKUTEN)).toBe('でで');
  });

  it('writes ありがとう — か + dakuten → が', () => {
    expect(applyKanaModifier('ありか', KANA_DAKUTEN)).toBe('ありが');
  });

  it('handles handakuten — は → ぱ, distinct from dakuten は → ば', () => {
    expect(applyKanaModifier('は', KANA_HANDAKUTEN)).toBe('ぱ');
    expect(applyKanaModifier('は', KANA_DAKUTEN)).toBe('ば');
  });

  it('writes geminates — つ + small → っ', () => {
    expect(applyKanaModifier('がつ', KANA_SMALL)).toBe('がっ');
    expect(applyKanaModifier('や', KANA_SMALL)).toBe('ゃ');
  });

  it('returns null when the modifier does not apply, so mis-taps insert nothing', () => {
    expect(applyKanaModifier('あ', KANA_DAKUTEN)).toBeNull();   // あ has no voiced form
    expect(applyKanaModifier('か', KANA_HANDAKUTEN)).toBeNull(); // only は-row takes ゜
    expect(applyKanaModifier('', KANA_DAKUTEN)).toBeNull();      // empty message
    expect(applyKanaModifier('ん', KANA_SMALL)).toBeNull();
  });

  it('never double-applies — が + dakuten stays が', () => {
    expect(applyKanaModifier('が', KANA_DAKUTEN)).toBeNull();
  });

  it('only touches the final character', () => {
    expect(applyKanaModifier('わたしは', KANA_DAKUTEN)).toBe('わたしば');
  });
});

describe('Japanese layout — modifier keys present', () => {
  it('exposes all three modifiers on the keyboard', () => {
    const keys = getLetterRows('ja').flat();
    for (const m of KANA_MODIFIERS) expect(keys, `missing ${m}`).toContain(m);
  });

  it('keeps them off the character rows so kana counts stay clean', () => {
    const rows = getLetterRows('ja');
    const kanaRows = rows.slice(0, 5).flat();
    expect(kanaRows).toHaveLength(46);
    for (const m of KANA_MODIFIERS) expect(kanaRows).not.toContain(m);
  });
});
