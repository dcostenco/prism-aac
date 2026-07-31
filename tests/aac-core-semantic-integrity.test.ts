/**
 * AAC core words are communication concepts, not parallel array positions.
 *
 * A shifted locale array previously made a selected concept display another
 * one (for example Russian He -> She and Chinese He -> Is). These assertions
 * pin both the English concept order and the locale text chosen for each
 * stable phrase ID across every shipped language.
 */
import { describe, expect, it } from 'vitest';
import { getAacCoreFor, getAacCorePairs } from '@/constants/aacCore';
import { getPhraseText } from '@/constants/phraseTranslations';
import { LANG_META, type SupportedLanguage } from '@/engine/i18n';

const CORE_CONCEPTS = [
  ['cw-i', 'I'],
  ['cw-you', 'You'],
  ['cw-more', 'More'],
  ['cw-want', 'Want'],
  ['cw-help', 'Help'],
  ['cw-go-core', 'Go'],
  ['cw-look', 'Look'],
  ['cw-make', 'Make'],
  ['cw-get-core', 'Get'],
  ['cw-put-core', 'Put'],
  ['cw-turn', 'Turn'],
  ['dw-good', 'Good'],
  ['cw-same-core', 'Same'],
  ['dw-different', 'Different'],
  ['cw-some', 'Some'],
  ['cw-open', 'Open'],
  ['cw-up', 'Up'],
  ['cw-in', 'In'],
  ['cw-on', 'On'],
  ['cw-he', 'He'],
  ['cw-she', 'She'],
  ['cw-it', 'It'],
  ['cw-that', 'That'],
  ['qu-who', 'Who?'],
  ['qu-what', 'What?'],
  ['qu-when', 'When?'],
  ['qu-where', 'Where?'],
  ['qu-why', 'Why?'],
] as const;

const SHIPPED_LANGUAGES = [...new Set(LANG_META.map(({ code }) => code))];

describe('AAC core semantic integrity', () => {
  it.each(SHIPPED_LANGUAGES)(
    '%s resolves every core slot from its stable phrase ID',
    (language: SupportedLanguage) => {
      expect(getAacCoreFor(language)).toEqual(
        CORE_CONCEPTS.map(([id, english]) => getPhraseText(id, language, english)),
      );
      expect(getAacCorePairs(language).map(([, english]) => english)).toEqual(
        CORE_CONCEPTS.map(([, english]) => english),
      );
    },
  );

  it('does not shift pronouns and question words in formerly corrupted locales', () => {
    expect(getAacCorePairs('ru').slice(19)).toEqual([
      ['Он', 'He'], ['Она', 'She'], ['Это', 'It'], ['То', 'That'],
      ['Кто?', 'Who?'], ['Что?', 'What?'], ['Когда?', 'When?'],
      ['Где?', 'Where?'], ['Почему?', 'Why?'],
    ]);
    expect(getAacCorePairs('zh-Hans').slice(19)).toEqual([
      ['他', 'He'], ['她', 'She'], ['它', 'It'], ['那个', 'That'],
      ['谁?', 'Who?'], ['什么?', 'What?'], ['什么时候?', 'When?'],
      ['在哪?', 'Where?'], ['为什么?', 'Why?'],
    ]);
  });

  it('keeps Simplified, Traditional, and Hong Kong core scripts distinct', () => {
    expect(getAacCoreFor('zh-Hans')).toEqual([
      '我', '你', '更多', '要', '帮', '去', '看', '做', '拿', '放', '转',
      '好', '一样', '不同', '一些', '打开', '上', '里', '上面', '他', '她',
      '它', '那个', '谁?', '什么?', '什么时候?', '在哪?', '为什么?',
    ]);
    const traditionalTaiwan = [
      '我', '你', '更多', '要', '幫', '去', '看', '做', '拿', '放', '轉',
      '好', '一樣', '不同', '一些', '打開', '上', '裡', '上面', '他', '她',
      '它', '那個', '誰?', '什麼?', '什麼時候?', '在哪?', '為什麼?',
    ];
    expect(getAacCoreFor('zh-Hant')).toEqual(traditionalTaiwan);
    expect(getAacCoreFor('zh-HK')).toEqual(
      traditionalTaiwan.map((word) => word === '裡' ? '裏' : word),
    );
  });
});
