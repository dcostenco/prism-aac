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
import { containsProfanity, containsSensitive, isAgeBlocked } from '@/engine/ageBlocklist';
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

describe('a whole phrase (for pictures)', () => {
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

  it('drops listed words from the advisory predictions', () => {
    expect(mergeAdvisoryPredictions(['eu', 'você'], ['merda', 'quero'], 'pt')).toEqual(['quero', 'eu', 'você']);
    expect(mergeAdvisoryPredictions(['I'], ['damn', 'want'], 'en')).toEqual(['want', 'I']);
  });
});
