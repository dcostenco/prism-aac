/**
 * Built-in tile texts are what a tile says aloud, so a wrong one puts the wrong word in a user's mouth. A review of every
 * visible word in 26 languages found tile texts that were another language's word (Dutch "Durst" is German), garbled
 * across two scripts (the Amharic Swing tile carried Tamil letters), a different meaning (the Swahili Taco tile said
 * "buttock"), or, for Traditional Chinese, a character-by-character conversion of the Simplified text that picked the
 * wrong character (the Dry tile said 幹, a profanity in Taiwan, for 乾).
 */
import { describe, expect, it } from 'vitest';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import type { SupportedLanguage } from '@/engine/i18n';

/** The letters each language's tiles are written in. Non-Latin languages may also carry Latin acronyms (BCBA, AAC, X光). */
const SCRIPTS: Record<string, RegExp> = {
  ru: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u, bg: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u, he: /\p{Script=Hebrew}/u, hi: /\p{Script=Devanagari}/u, bn: /\p{Script=Bengali}/u,
  am: /\p{Script=Ethiopic}/u, ko: /[\p{Script=Hangul}\p{Script=Han}]/u, ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  'zh-Hans': /\p{Script=Han}/u, 'zh-Hant': /\p{Script=Han}/u, 'zh-HK': /\p{Script=Han}/u,
};
const LATIN = ['es', 'fr', 'pt', 'ro', 'de', 'it', 'pl', 'nl', 'vi', 'tl', 'tr', 'id', 'sw'];

describe('every tile is written in its own language\'s script', () => {
  it.each([...Object.keys(SCRIPTS), ...LATIN])('%s', (lang) => {
    const own = SCRIPTS[lang] ?? /\p{Script=Latin}/u;
    const bad: string[] = [];
    for (const p of DEFAULT_PHRASES) {
      const text = getPhraseText(p.id, lang as SupportedLanguage, '');
      for (const ch of text) {
        // shared letters (the Japanese long-vowel mark ー, the Arabic tatweel ـ) belong to no one script
        if (!/\p{L}/u.test(ch) || own.test(ch) || /[\p{Script=Common}\p{Script=Inherited}]/u.test(ch)) continue;
        if (SCRIPTS[lang] && /\p{Script=Latin}/u.test(ch)) continue;
        bad.push(`${p.id}: ${text}`);
        break;
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('tile texts the review corrected', () => {
  // [language, tile, text]. Each replaced another language's word, a garbled or misspelled text, or a different meaning:
  // nl Durst (German), sw Tako (buttock), hi बेवकूफ (idiot), zh 滚 alone ("get lost!"), zh-Hant/zh-HK 幹 (a Taiwan profanity,
  // converted from 干; dry is 乾), ja/zh Hip お尻/臀部 (buttocks), ko 새요 ("it leaks", on Sour).
  it.each([
    ['nl', 'fe-thirsty', 'Dorst'],
    ['nl', 'cw-trade', 'Ruilen'],
    ['nl', 'hfs-sneeze', 'Niezen'],
    ['nl', 'cw-listen', 'Luister'],
    ['nl', 'fe-shy', 'Verlegen'],
    ['nl', 'fe-ashamed', 'Beschaamd'],
    ['ru', 'fe-content', 'Доволен'],
    ['ru', 'fe-thankful', 'Благодарен'],
    ['ru', 'qt-happy-hanukkah', 'С Ханукой'],
    ['uk', 'qt-happy-hanukkah', 'З Ханукою'],
    ['uk', 'cl-mittens', 'Рукавиці'],
    ['uk', 'qt-bye-bye', 'Бувай-бувай'],
    ['pl', 'cw-right-now', 'W tej chwili'],
    ['pl', 'ti-right-now', 'W tej chwili'],
    ['tr', 'fd-cereal', 'Mısır gevreği'],
    ['id', 'cw-build', 'Membangun'],
    ['id', 'cw-feel', 'Merasa'],
    ['id', 'cw-leave', 'Keluar'],
    ['tl', 'cw-do', 'Gawin'],
    ['tl', 'cw-build', 'Magtayo'],
    ['tl', 'dw-boring', 'Nakakabagot'],
    ['tl', 'sw-test', 'Pagsusulit'],
    ['tl', 'ac-clap', 'Pumalakpak'],
    ['tl', 'ac-hum', 'Humuni'],
    ['sw', 'fd-taco', 'Taco'],
    ['sw', 'fm-tacos', 'Taco'],
    ['sw', 'pp-family', 'Familia'],
    ['sw', 'tf-tablet', 'Tableti'],
    ['sw', 'fs-popcorn', 'Bisi'],
    ['sw', 'dw-sour', 'Chachu'],
    ['sw', 'pl-park', 'Bustani'],
    ['sw', 'hfs-sneeze', 'Kupiga chafya'],
    ['sw', 'tf-swing', 'Bembea'],
    ['sw', 'fm-snack', 'Vitafunio'],
    ['sw', 'dw-old', 'Kuukuu'],
    ['am', 'cl-sweatshirt', 'ስዌትሸርት'],
    ['am', 'tf-swing', 'ዥዋዥዌ'],
    ['am', 'qt-yay', 'እሰይ'],
    ['hi', 'fe-silly', 'मज़ाकिया'],
    ['hi', 'ps-classmate', 'सहपाठी'],
    ['hi', 'plh-bedroom', 'बेडरूम'],
    ['hi', 'pl-bedroom', 'बेडरूम'],
    ['hi', 'fe-frustrated', 'हताश'],
    ['he', 'fe-nervous', 'מתוח'],
    ['bn', 'qt-youre-welcome', 'কোনো ব্যাপার না'],
    ['bn', 'pp-grandpa', 'দাদু'],
    ['bn', 'td-tomorrow', 'আগামীকাল'],
    ['bn', 'qt-definitely', 'অবশ্যই'],
    ['bn', 'dw-hard', 'শক্ত'],
    ['bn', 'dw-salty', 'নোনতা'],
    ['vi', 'cw-on', 'Trên'],
    ['vi', 'cw-above', 'Phía trên'],
    ['ko', 'dw-sour', '셔요'],
    ['ko', 'help-thirsty', '목말라요'],
    ['ko', 'cw-let-me-try', '해볼게요'],
    ['ko', 'cw-try', '해봐요'],
    ['ko', 'dw-funny', '웃겨요'],
    ['ja', 'hb-hip', 'こし'],
    ['ja', 'tc-afternoon', 'ごご'],
    ['ja', 'cw-leave', 'でる'],
    ['ja', 'cw-any', 'なんでも'],
    ['ja', 'hb-foot', 'あし'],
    ['ja', 'hbp-foot', 'あし'],
    ['zh-Hans', 'ac-roll', '打滚'],
    ['zh-Hans', 'cw-spit', '吐口水'],
    ['zh-Hans', 'hb-hip', '髋部'],
    ['zh-Hans', 'fd-taco', '塔可'],
    ['zh-Hans', 'chip-b3', '塔可'],
    ['zh-Hans', 'fd-pie', '馅饼'],
    ['zh-Hans', 'ac-tag', '抓人游戏'],
    ['zh-Hans', 'sw-social-studies', '社会课'],
    ['zh-Hans', 'cw-versus', '对阵'],
    ['zh-Hans', 'fd-pasta', '意大利面'],
    ['zh-Hant', 'dw-dry', '乾'],
    ['zh-HK', 'dw-dry', '乾'],
    ['zh-Hant', 'fe-sleepy', '睏'],
    ['zh-HK', 'fe-sleepy', '睏'],
    ['zh-Hant', 'ac-tie', '綁'],
    ['zh-HK', 'ac-tie', '綁'],
    ['zh-Hant', 'dw-sticky', '黏'],
  ] as [SupportedLanguage, string, string][])('%s %s says "%s"', (lang, id, text) => {
    expect(getPhraseText(id, lang, '')).toBe(text);
  });

  it('no Traditional Chinese tile is the bare 幹', () => {
    // 幹 inside a phrase is "do" (幹得好 = well done, on qt-well-done); alone it is the profanity
    for (const lang of ['zh-Hant', 'zh-HK'] as SupportedLanguage[]) {
      expect(DEFAULT_PHRASES.filter((p) => getPhraseText(p.id, lang, '') === '幹').map((p) => p.id)).toEqual([]);
    }
  });
});
