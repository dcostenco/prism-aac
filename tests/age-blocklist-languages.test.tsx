/**
 * Profanity and the sensitive words stay out of the prediction bar in every
 * language, not only English.
 *
 * The English lists (engine/ageBlocklist.ts) applied to every language, so a
 * Portuguese, French or Russian user was offered that language's swear words
 * as soon as the prefix matched: "cac" -> cacete, "chi" -> chier, "ars" ->
 * arsch, "бля" -> блядь. Each prediction language now has the same two lists
 * (engine/ageBlocklistByLang.json), applied to that language only, because a
 * word that is vulgar in one language is ordinary in another (Italian "fica",
 * Portuguese "fica" = stays). The AI completion and the advisory predictions
 * reached the bar without any list at all, English included.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { getPredictions } from '@/engine/predictionEngine';
import { containsBlockedSuggestion, containsProfanity, containsSensitive, isAgeBlocked } from '@/engine/ageBlocklist';
import compoundExceptions from '@/engine/suggestionCompoundExceptions.json';
import byLang from '@/engine/ageBlocklistByLang.json';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import PredictionBar, { mergeAdvisoryPredictions } from '@/components/PredictionBar';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';

const LISTS = byLang as Record<string, { profanity: string[]; sensitive: string[] }>;
const SEED_LANG: Record<string, string> = { zh: 'zh-Hans' };

async function predict(lang: string, text: string): Promise<string[]> {
  const seed = await loadPredictionSeed(SEED_LANG[lang] ?? lang);
  return getPredictions(text, seed.wordFreq, seed.bigrams, undefined, seed.trigrams, [], new Set(), undefined, lang)
    .map((w) => w.toLowerCase());
}

describe('the prediction engine', () => {
  it.each([
    ['pt', 'cac', 'cacete'],
    ['fr', 'chi', 'chier'],
    ['de', 'ars', 'arsch'],
    ['es', 'mier', 'mierda'],
    ['ru', 'бля', 'блядь'],
  ])('%s: typing "%s" never offers "%s"', async (lang, text, word) => {
    expect(await predict(lang, text)).not.toContain(word);
  });

  // Every listed word the language's prediction data could offer, typed up to its last letter.
  it.each(Object.keys(LISTS))('%s: never offers a listed word from its prediction data', async (lang) => {
    const seed = await loadPredictionSeed(SEED_LANG[lang] ?? lang);
    const top = new Set(Object.entries(seed.wordFreq).sort((a, b) => b[1].count - a[1].count).slice(0, 8000).map(([w]) => w.toLowerCase()));
    const listed = [...LISTS[lang].profanity, ...LISTS[lang].sensitive].filter((w) => top.has(w) && [...w].length > 1);
    const offered: string[] = [];
    for (const word of listed) {
      const prefix = [...word].slice(0, -1).join('');
      if ((await predict(lang, prefix)).includes(word)) offered.push(word);
    }
    expect(offered).toEqual([]);
  }, 60_000);
});

describe('isAgeBlocked', () => {
  it.each([['de', 'die'], ['de', 'dies'], ['de', 'hell'], ['nl', 'die'], ['fr', 'retard'], ['de', 'dick'], ['de', 'ass']])
  ('preserves the ordinary %s homograph "%s"', (lang, word) => {
    expect(isAgeBlocked(word, lang)).toBe(false);
    expect(containsSensitive(word, lang)).toBe(false);
    expect(isAgeBlocked(word, 'en')).toBe(true);
  });

  it('keeps German dies available through the prediction engine', () => {
    expect(getPredictions('di', { dies: { count: 50, lastUsed: 0 } }, {}, undefined, {}, [], new Set(), undefined, 'de')).toContain('dies');
  });

  it.each(['kills', 'killed', 'killing', 'killings', 'killer', 'killers', 'dies', 'died', 'dying'])
  ('keeps the inflected English word "%s" out of offered suggestions', (word) => {
    expect(isAgeBlocked(word, 'en')).toBe(true);
    expect(containsSensitive(`It was ${word}.`, 'en')).toBe(true);
  });

  it.each(['diet', 'diets', 'dietary', 'kilometer', 'kilometers', 'skill', 'skills', 'skilled', 'hoodie', 'candied'])
  ('preserves the ordinary word "%s" despite shared letters', (word) => {
    expect(isAgeBlocked(word, 'en')).toBe(false);
    expect(containsSensitive(`I want ${word}.`, 'en')).toBe(false);
  });

  it.each(['kil', 'die', 'dy'])('filters real English corpus suggestions for "%s"', async (prefix) => {
    const offered = await predict('en', prefix);
    expect(offered.filter((word) => /^(?:kill(?:s|ed|ing|ings|er|ers)?|die[sd]?|dying)$/.test(word))).toEqual([]);
  });

  it('blocks a word only in the language where it is vulgar', () => {
    expect(isAgeBlocked('fica', 'it')).toBe(true);
    expect(isAgeBlocked('fica', 'pt')).toBe(false); // "stays"
    expect(isAgeBlocked('merda', 'pt')).toBe(true);
    expect(isAgeBlocked('Merda', 'pt')).toBe(true);
  });

  it('keeps the English lists in every language, as before', () => {
    expect(isAgeBlocked('fuck', 'pt')).toBe(true);
    expect(isAgeBlocked('kill', 'ja')).toBe(true);
    expect(isAgeBlocked('kill')).toBe(true);
  });

  it('covers every Chinese variant with the one Chinese list', () => {
    for (const lang of ['zh', 'zh-Hans', 'zh-Hant', 'zh-HK']) expect(isAgeBlocked('婊子', lang), lang).toBe(true);
  });

  it('blocks the rude "get lost" and the derogatory Korean words that word-level seeds now offer', () => {
    // 滚 / 滾 ("get lost", also "roll") and Korean 새끼 / 놈 ("bastard", "guy" as an insult) are single tokens in the
    // word-level Chinese and Korean prediction data
    for (const lang of ['zh', 'zh-Hans', 'zh-Hant', 'zh-HK']) for (const word of ['滚', '滾']) expect(isAgeBlocked(word, lang), `${lang} ${word}`).toBe(true);
    for (const word of ['새끼', '놈']) expect(isAgeBlocked(word, 'ko'), word).toBe(true);
    expect(isAgeBlocked('滚动', 'zh-Hans')).toBe(false); // scrolling
  });

  it('blocks the Taiwan profanity 幹 and Swahili "tako" (buttock)', async () => {
    // Converting the Simplified 干 (do, dry) to Taiwan or Hong Kong spelling gives 幹, which alone is a Taiwan profanity;
    // its compounds (幹部 cadre, 能幹 capable) stay. The plural "matako" was already listed.
    for (const lang of ['zh-Hant', 'zh-HK']) expect(isAgeBlocked('幹', lang), lang).toBe(true);
    expect(isAgeBlocked('幹部', 'zh-Hant')).toBe(false);
    expect(isAgeBlocked('乾', 'zh-Hant')).toBe(false); // dry
    expect(isAgeBlocked('tako', 'sw')).toBe(true);
    expect(await predict('sw', 'tak')).not.toContain('tako');
  });

  it('lists every Japanese word in both kana scripts, so katakana マンコ is blocked like まんこ and hiragana せっくす like セックス', () => {
    const ja = (byLang as Record<string, { profanity: string[]; sensitive: string[] }>).ja;
    const toKatakana = (w: string) => w.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
    const toHiragana = (w: string) => w.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    for (const field of ['profanity', 'sensitive'] as const) {
      const noKatakana = ja[field].filter((w) => /^[\u3041-\u3096ー]+$/.test(w) && !ja[field].includes(toKatakana(w)));
      const noHiragana = ja[field].filter((w) => /^[\u30a1-\u30f6ー]+$/.test(w) && !ja[field].includes(toHiragana(w)));
      expect([...noKatakana, ...noHiragana], field).toEqual([]);
    }
    const offered = getPredictions('マン', { マンコ: { count: 90, lastUsed: 0 }, マンゴー: { count: 80, lastUsed: 0 } }, {}, undefined, {}, [], new Set(), undefined, 'ja');
    expect(offered).toContain('マンゴー'); // mango
    expect(offered).not.toContain('マンコ');
  });

  it('blocks the Chinese insults 傻子 and 傻瓜 like 白痴 and 笨蛋', () => {
    for (const lang of ['zh-Hans', 'zh-Hant', 'zh-HK']) for (const w of ['傻子', '傻瓜']) expect(isAgeBlocked(w, lang), `${lang} ${w}`).toBe(true);
  });

  it('leaves the ordinary sense, the AAC essentials and neutral words alone', () => {
    expect(isAgeBlocked('gros', 'fr')).toBe(false); // big
    expect(isAgeBlocked('behindert', 'de')).toBe(false); // disabled
    expect(isAgeBlocked('anjing', 'id')).toBe(false); // dog
    expect(isAgeBlocked('כוס', 'he')).toBe(false); // cup
    expect(isAgeBlocked('싫어요', 'ko')).toBe(false); // I don't like it
    expect(isAgeBlocked('尿', 'zh-Hans')).toBe(false); // pee
    expect(isAgeBlocked('material', 'es')).toBe(false);
  });
});

describe('optional suggestions preserve words and contractions', () => {
  for (const lang of ['zh-Hans', 'zh-Hant', 'zh-HK']) {
    it.each(['我操控', '我操控设备', '我操控轮椅', '被我操控'])('preserves the reviewed word boundary in %s (' + lang + ')', (text) => {
      expect(containsBlockedSuggestion(text, lang)).toBe(false);
    });
    it.each(['我操', '操控我操', '我操操控', '操控操'])('retains a separate listed expression in %s (' + lang + ')', (text) => {
      expect(containsBlockedSuggestion(text, lang)).toBe(true);
    });
  }

  it('limits single-character exemptions to the reviewed ordinary compounds, independent of regenerated vocabulary', () => {
    expect(compoundExceptions).toEqual({ zh: ['操控', '幹細胞'] });
    for (const word of compoundExceptions.zh) {
      expect(isAgeBlocked(word, 'zh')).toBe(false);
      expect(containsBlockedSuggestion(`我想${word}`, 'zh')).toBe(false);
      expect(containsBlockedSuggestion(`${word} 操`, 'zh')).toBe(true);
    }
  });

  it.each([
    ['zh-Hans', '我操'], ['zh-Hant', '幹過'], ['zh-Hans', '烧死'],
    ['zh-Hans', '枪杀'], ['zh-Hans', '追杀'], ['zh-Hant', '殺光'], ['ja', '淫夢'],
  ])('lists the reproduced %s compound %s explicitly across word and phrase consumers', (lang, text) => {
    expect(isAgeBlocked(text, lang)).toBe(true);
    expect(containsBlockedSuggestion(text, lang)).toBe(true);
  });

  it.each([
    ['zh-Hans', '我操'], ['zh-Hant', '我操'], ['zh-HK', '我操'],
    ['zh-Hans', '哎呀我操'], ['zh-Hans', '烧死'], ['zh-Hans', '枪杀'], ['zh-Hans', '追杀'],
    ['zh-Hant', '殺光'], ['zh-Hant', '幹過'], ['ja', '淫夢'],
  ])('does not treat a frequency-corpus entry as a neutral %s compound: %s', async (lang, text) => {
    expect(await containsBlockedSuggestion(text, lang)).toBe(true);
  });

  it.each([
    ['zh-Hans', '我想操控'], ['zh-Hant', '幹細胞'],
    ['ja', '今日は暑いしね'], ['ja', '大丈夫ですしね'], ['ja', '楽しいしね'],
    ['en', 'He´ll be home'], ['en', 'He‘ll be home'], ['en', 'He`ll be home'],
  ])('preserves the ordinary %s phrase %s after adversarial review', async (lang, text) => {
    expect(await containsBlockedSuggestion(text, lang)).toBe(false);
  });

  it.each([
    ['en', "f'uck"], ['en', "sh'it"],
    ['uk', 'Я тебе вб`ю'], ['uk', 'Я тебе вб´ю'],
    ['ja', "That's the killer's car"], ['zh-Hans', "Kill'em"],
    ['ja', 'f.u.c.k'], ['zh-Hans', 'f.u.c.k'],
  ])('retains punctuation-normalized %s filtering for %s', async (lang, text) => {
    expect(await containsBlockedSuggestion(text, lang)).toBe(true);
  });

  it.each([
    ['zh-Hans', '操场 滚动 打滚 操作 妈妈的 你妈妈 他妈妈'],
    ['zh-Hant', '幹部 幹嘛 幹什麼'],
    ['ja', 'ばかり 考えろ'],
    ['en', "He'll be home. He’ll be home."],
  ])('preserves ordinary %s compounds and contractions', async (lang, text) => {
    expect(await containsBlockedSuggestion(text, lang)).toBe(false);
  });

  it.each([
    ['zh-Hans', '他想自杀'], ['zh-Hant', '你是傻瓜'], ['ja', 'おまえはばかだ'],
    ['ja', '死にたい'], ['uk', "Я тебе вб'ю"], ['uk', 'Я тебе вб’ю'], ['uk', 'Я тебе вбʼю'],
    ['en', 'hell'], ['en', 'f.u.c.k'],
  ])('retains listed %s expressions at segment boundaries', async (lang, text) => {
    expect(await containsBlockedSuggestion(text, lang)).toBe(true);
  });
});

describe('a whole phrase (for pictures)', () => {
  it.each(["f'uck", "sh'it", 'f`uck', 'sh´it'])('retains the existing punctuation guard for %s', (text) => {
    expect(containsProfanity(text, 'en')).toBe(true);
  });

  it.each(['He\'ll', 'He’ll', 'He‘ll', 'He´ll', 'He`ll'])('preserves the ordinary contraction %s for pictures', (text) => {
    expect(containsSensitive(`${text} be home`, 'en')).toBe(false);
  });

  it.each(['вб\'ю', 'вб’ю', 'вб´ю', 'вб`ю'])('normalizes the listed Ukrainian apostrophe in %s', (text) => {
    expect(isAgeBlocked(text, 'uk')).toBe(true);
    expect(containsSensitive(`Я тебе ${text}`, 'uk')).toBe(true);
  });

  it('finds a listed word glued to another by punctuation, or spelled with dots', () => {
    expect(containsProfanity('shit,dog', 'en')).toBe(true);
    expect(containsProfanity('f.u.c.k', 'en')).toBe(true);
    expect(containsProfanity('चूतिया', 'hi')).toBe(true);
    expect(containsSensitive('banana kill', 'en')).toBe(true);
  });

  it('finds a listed word inside Chinese or Japanese text, which has no spaces', () => {
    expect(containsProfanity('你是傻瓜', 'zh-Hant')).toBe(true);
    expect(containsProfanity('おまえはばかだ', 'ja')).toBe(true);
    expect(containsSensitive('他想自杀', 'zh-Hans')).toBe(true);
  });

  it('leaves ordinary phrases alone, and a single sensitive character inside a longer word', () => {
    for (const [text, lang] of [['I want a dog', 'en'], ['我要喝水', 'zh-Hans'], ['我要肥皂', 'zh-Hans'], ['すみません', 'ja'], ['quero água', 'pt']] as const) {
      expect(containsProfanity(text, lang), text).toBe(false);
      expect(containsSensitive(text, lang), text).toBe(false);
    }
  });
});

describe('pictures', () => {
  it('never looks up a picture for a listed word in its language', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('merda', 'pt', 'symbols')).toBeNull();
    expect(await getPictogramUrl('блядь', 'ru', 'symbols')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('the prediction bar', () => {
  beforeEach(async () => {
    cleanup();
    window.localStorage.clear();
    await loadPredictionSeed('pt');
    await loadPredictionSeed('en');
  });

  async function tiles(language: string, aiCompletion: string, text: string): Promise<string[]> {
    useSettingsStore.setState({ language, outputLanguage: language } as never);
    useMessageStore.setState({ text } as never);
    usePredictionStore.setState({ aiCompletion, wordFreq: {}, bigrams: {}, trigrams: {} });
    await act(async () => { render(<PredictionBar />); });
    return screen.getAllByRole('button').map((b) => b.textContent?.trim().toLowerCase() ?? '');
  }

  it('never shows a listed AI completion (Portuguese)', async () => {
    expect(await tiles('pt', 'cacete', 'eu ')).not.toContain('cacete');
  });

  it('never shows a listed AI completion (English)', async () => {
    expect(await tiles('en', 'shit', 'oh ')).not.toContain('shit');
  });

  it.each([['en', 'diet', 'di'], ['en', 'kilometers', 'kil'], ['de', 'dick', 'dic'], ['fr', 'retard', 'reta']])
  ('offers the ordinary %s AI completion %s through the prediction tile gate', async (lang, completion, input) => {
    expect(await tiles(lang, completion, input)).toContain(completion);
  });

  it('drops listed words from the advisory predictions', () => {
    expect(mergeAdvisoryPredictions(['eu', 'você'], ['merda', 'quero'], 'pt')).toEqual(['quero', 'eu', 'você']);
    expect(mergeAdvisoryPredictions(['I'], ['damn', 'want'], 'en')).toEqual(['want', 'I']);
  });
});
