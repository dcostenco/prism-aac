/**
 * Chinese, Japanese and Korean prediction seeds are word-level, and the app's own vocabulary ranks above the web-frequency
 * baseline.
 *
 * The zh and ja seeds had been built per character, so the bar offered "ま", "す", "们" and every bigram was a pair of
 * characters; zh-Hant and zh-HK carried Simplified wordfreq words (没有, 吗, 号); and because the wordfreq top-20K baseline
 * (counts up to 50) was merged with max(), the app's own words (counts of a few) ranked below 20K news words: the top 1000
 * of ko, ja and zh were morphemes and fragments (부터, でし, 共产党) with no picture. The seed builder now segments every
 * translated phrase into words (jieba, SudachiPy, eojeol), gives those words a count above 50, and converts the zh baseline to
 * Traditional (Taiwan) or Hong Kong spelling.
 */
import { describe, expect, it } from 'vitest';
import { getPredictions } from '@/engine/predictionEngine';
import { loadPredictionSeed } from '@/constants/predictionSeeds';

const CJK = ['ko', 'ja', 'zh-Hans', 'zh-Hant', 'zh-HK'] as const;
const topWords = (wordFreq: Record<string, { count: number }>, n: number) =>
  Object.entries(wordFreq).sort((a, b) => b[1].count - a[1].count).slice(0, n).map(([w]) => w);

describe('the app vocabulary ranks above the baseline', () => {
  it.each([
    ['zh-Hans', '蜡笔'], ['zh-Hant', '蠟筆'], ['zh-HK', '蠟筆'], ['ja', 'クレヨン'], ['ko', '크레용'],
  ])('%s: "%s" (crayon) is in the app tier (the top 2000)', async (lang, word) => {
    const seed = await loadPredictionSeed(lang);
    expect(topWords(seed.wordFreq, 2000)).toContain(word);
    expect(seed.wordFreq[word].count).toBeGreaterThan(50);
  });

  it.each(CJK)('%s: no web-frequency news word is in the first 50', async (lang) => {
    const seed = await loadPredictionSeed(lang);
    const head = topWords(seed.wordFreq, 50);
    // baseline counts never exceed 50; every one of the first 50 is the app's own vocabulary
    expect(head.filter((w) => seed.wordFreq[w].count <= 50)).toEqual([]);
  });
});

describe('words, not characters', () => {
  it.each(['zh-Hans', 'zh-Hant', 'zh-HK', 'ja'])('%s: most of the top 300 are more than one character long', async (lang) => {
    const seed = await loadPredictionSeed(lang);
    const multi = topWords(seed.wordFreq, 300).filter((w) => [...w].length > 1).length;
    expect(multi).toBeGreaterThan(150); // the character-level seed had 0-60 of 300
  });

  it('zh bigrams join words, not single characters', async () => {
    const { bigrams } = await loadPredictionSeed('zh-Hans');
    const keys = Object.keys(bigrams);
    expect(keys.length).toBeGreaterThan(100);
    const longer = keys.filter((k) => k.split('|').some((t) => [...t].length > 1)).length;
    expect(longer / keys.length).toBeGreaterThan(0.5);
  });

  it('typing a prefix offers the whole word', async () => {
    for (const [lang, prefix, word] of [['zh-Hans', '蜡', '蜡笔'], ['zh-Hant', '蠟', '蠟筆'], ['ja', 'クレ', 'クレヨン']] as const) {
      const seed = await loadPredictionSeed(lang);
      const offered = getPredictions(prefix, seed.wordFreq, seed.bigrams, undefined, seed.trigrams, [], new Set(), undefined, lang);
      expect(offered, lang).toContain(word);
    }
  });
});

describe('Traditional Chinese uses Traditional spelling', () => {
  it.each(['zh-Hant', 'zh-HK'])('%s: the baseline is converted, no Simplified-only form is in the top 3000', async (lang) => {
    const seed = await loadPredictionSeed(lang);
    const head = new Set(topWords(seed.wordFreq, 3000));
    for (const simplified of ['没有', '吗', '号', '时间', '国家', '喜欢']) expect(head.has(simplified), simplified).toBe(false);
    for (const traditional of ['嗎', '號', '時間', '國家', '喜歡']) expect(seed.wordFreq[traditional], traditional).toBeDefined();
  });

  it('Simplified keeps its own spelling', async () => {
    const seed = await loadPredictionSeed('zh-Hans');
    for (const simplified of ['吗', '号', '时间', '国家', '喜欢']) expect(seed.wordFreq[simplified], simplified).toBeDefined();
  });
});

describe('Korean keeps its eojeol corpus counts', () => {
  it('the most frequent corpus eojeol stay at the top', async () => {
    const seed = await loadPredictionSeed('ko');
    expect(topWords(seed.wordFreq, 12)).toEqual(expect.arrayContaining(['싶어요', '있어요', '지금']));
    expect(Object.keys(seed.bigrams).length).toBe(3000);
  });
});

describe('number counters are not words of their own', () => {
  // "21にち", "12がつ" and "21号" in the date tiles left にち, がつ and 号 as high-count tokens that the bar then offered after
  // "わたし " and "我 ".
  it.each([['ja', ['にち', 'がつ']], ['zh-Hans', ['号']], ['zh-Hant', ['號']], ['zh-HK', ['號']]] as const)(
    '%s: the counter is outside the app tier',
    async (lang, counters) => {
      const seed = await loadPredictionSeed(lang);
      for (const c of counters) expect(seed.wordFreq[c]?.count ?? 0, c).toBeLessThanOrEqual(52);
      expect(topWords(seed.wordFreq, 200)).not.toEqual(expect.arrayContaining([counters[0]]));
    },
  );

  it('the bar does not offer a counter after a pronoun', async () => {
    for (const [lang, text, counter] of [['ja', 'わたし ', 'にち'], ['ja', 'わたし ', 'がつ'], ['zh-Hans', '我 ', '号']] as const) {
      const seed = await loadPredictionSeed(lang);
      const offered = getPredictions(text, seed.wordFreq, seed.bigrams, undefined, seed.trigrams, [], new Set(), undefined, lang);
      expect(offered, `${lang} ${text}`).not.toContain(counter);
    }
  });
});

describe('the app tier follows the corrected tile texts', () => {
  // The seeds were first built from tile texts that later proved wrong (the Hip tile said "buttocks", the Sour tile "it
  // leaks", Taiwan and Hong Kong tiles carried Mainland words). Rebuilt from the corrected texts, a replaced spelling falls
  // back to the web-frequency baseline (count 50 or less) or leaves the seed, and the corrected one is app vocabulary.
  it.each([
    ['ja', 'お尻', 'こし'], ['ko', '새요', '셔요'], ['zh-Hans', '臀部', '髋部'],
    ['zh-Hant', '公交車', '公車'], ['zh-HK', '公交車', '巴士'], ['zh-Hant', '幹', '乾'], ['zh-HK', '幹', '乾'],
  ])('%s: "%s" is not app vocabulary any more, "%s" is', async (lang, replaced, corrected) => {
    const seed = await loadPredictionSeed(lang);
    expect(seed.wordFreq[replaced]?.count ?? 0).toBeLessThanOrEqual(50);
    expect(seed.wordFreq[corrected]?.count ?? 0).toBeGreaterThan(50);
  });
});

describe('Japanese app vocabulary is whole words, not pieces the segmenter cut', () => {
  // The segmenter cut やって into やっ|て, としょかん into と|しょ|かん and どようび into ど|ようび; the pieces outranked every
  // web-frequency word, so typing や offered やっ first.
  it('no app word ends in a small tsu, and the cut pieces are not app words', async () => {
    const seed = await loadPredictionSeed('ja');
    const app = Object.entries(seed.wordFreq).filter(([, v]) => v.count > 50).map(([w]) => w);
    expect(app.filter((w) => /[っッ]$/.test(w))).toEqual([]);
    for (const piece of ['やっ', 'まっ', 'しょ', 'ど', 'わから', 'おちつい', 'でし']) expect(seed.wordFreq[piece]?.count ?? 0, piece).toBeLessThanOrEqual(50);
    for (const word of ['やって', 'まって', 'としょかん', 'どようび', 'わからない', 'おちついて', 'でした']) expect(seed.wordFreq[word]?.count ?? 0, word).toBeGreaterThan(50);
  });

  it('typing や offers やって, not the cut piece', async () => {
    const seed = await loadPredictionSeed('ja');
    const offered = getPredictions('や', seed.wordFreq, seed.bigrams, undefined, seed.trigrams, [], new Set(), undefined, 'ja');
    expect(offered).toContain('やって');
    expect(offered).not.toContain('やっ');
  });
});

describe('Chinese compounds stay whole where a cut part reads as another word', () => {
  // 酸奶油 (sour cream) was cut into 酸奶 (Mainland "yogurt", 優格 in Taiwan) and 抓人遊戲 (the game of tag) into 抓人 ("arrest");
  // the Hong Kong chips said 沙拉 / 玉米 for the local 沙律 / 粟米.
  it.each([
    ['zh-Hant', '酸奶', '酸奶油'], ['zh-Hant', '抓人', '抓人遊戲'], ['zh-HK', '沙拉', '沙律'], ['zh-HK', '玉米', '粟米'],
    // a tile whose English is one word stays one word: Brownie 布朗尼 (not 布朗 "Brown"), Inhaler 吸入器
    ['zh-Hans', '布朗', '布朗尼'], ['zh-Hant', '布朗', '布朗尼'], ['zh-HK', '布朗', '布朗尼'], ['zh-Hans', '吸入', '吸入器'], ['zh-HK', '吸入', '吸入器'],
  ])('%s: "%s" is not app vocabulary, "%s" is', async (lang, replaced, kept) => {
    const seed = await loadPredictionSeed(lang);
    expect(seed.wordFreq[replaced]?.count ?? 0).toBeLessThanOrEqual(50);
    expect(seed.wordFreq[kept]?.count ?? 0).toBeGreaterThan(50);
  });
});
