/**
 * The Taiwan (zh-Hant) and Hong Kong (zh-HK) interface strings must be written in Traditional characters. Some were copies of
 * the Simplified string: the picture board's sidebar read 键盘 / 隐藏 / 词汇 and the quick-chat buttons 什么 / 为什么 / 帮助 in
 * both locales. A string may still differ from the official variant forms (平台, 帳戶, 訂閱 are everyday Traditional spellings),
 * so the check is the defect itself: a Traditional string must not be the Simplified string when that has Traditional forms.
 */
import { describe, expect, it } from 'vitest';
import * as OpenCC from 'opencc-js';
import matrix from '@/i18n/translations.json';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const rows = Object.entries(matrix as Record<string, Record<string, string>>);

describe('Traditional Chinese interface strings', () => {
  it.each(['zh-Hant', 'zh-HK'])('%s never copies a Simplified string that has Traditional forms', (locale) => {
    const copies = rows
      .filter(([, v]) => typeof v['zh-Hans'] === 'string' && toTraditional(v['zh-Hans']) !== v['zh-Hans'] && v[locale] === v['zh-Hans'])
      .map(([key, v]) => `${key}: ${v[locale]}`);
    expect(copies).toEqual([]);
  });

  it.each([
    ['sidebar_kb', '鍵盤', '鍵盤'], ['sidebar_hide_kb', '隱藏', '隱藏'], ['sidebar_words', '詞彙', '詞彙'],
    ['qc_21', '什麼', '什麼'], ['qc_24', '為什麼', '為什麼'], ['qc_23', '哪裡', '哪裏'], ['qc_5', '幫助', '幫助'],
  ])('%s reads %s in Taiwan and %s in Hong Kong', (key, hant, hk) => {
    const row = (matrix as Record<string, Record<string, string>>)[key];
    expect(row['zh-Hant']).toBe(hant);
    expect(row['zh-HK']).toBe(hk);
  });
});
