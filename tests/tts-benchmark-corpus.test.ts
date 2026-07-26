// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flattenCorpus } from '../scripts/lib/ttsBenchmark.mjs';
import { getTTSCode, LANG_META } from '../engine/i18n';

const corpus = JSON.parse(readFileSync(resolve('benchmarks/tts/corpus.json'), 'utf8'));

describe('TTS benchmark corpus', () => {
  it('covers every visible Prism AAC locale exactly once', () => {
    const expectedAppCodes = LANG_META
      .filter(({ code }) => code !== 'zh')
      .map(({ code }) => code);
    const actualAppCodes = corpus.locales.map((entry: { appCode: string }) => entry.appCode);

    expect(actualAppCodes).toHaveLength(expectedAppCodes.length);
    expect(new Set(actualAppCodes).size).toBe(expectedAppCodes.length);
    expect(actualAppCodes).toEqual(expectedAppCodes);
    for (const locale of corpus.locales) {
      expect(locale.locale).toBe(getTTSCode(locale.appCode));
    }
  });

  it('provides AAC word, AAC sentence, and POS phone cases for every locale', () => {
    for (const locale of corpus.locales) {
      expect(locale.cases.map((entry: { kind: string }) => entry.kind)).toEqual([
        'aac_word',
        'aac_sentence',
        'pos_phone',
      ]);
      expect(locale.cases.every((entry: { text: string }) => entry.text.trim().length > 0)).toBe(true);
    }
    expect(flattenCorpus(corpus)).toHaveLength(72);
  });

  it('keeps review provenance explicit instead of claiming quality validation', () => {
    expect(new Set(corpus.locales.map((entry: { reviewStatus: string }) => entry.reviewStatus)))
      .toEqual(new Set(['code-derived', 'native-review-required']));
    const needsReview = corpus.locales
      .filter((entry: { reviewStatus: string }) => entry.reviewStatus === 'native-review-required')
      .map((entry: { appCode: string }) => entry.appCode);

    expect(needsReview).toEqual(['zh-Hant', 'zh-HK']);
    expect(flattenCorpus(corpus).filter((entry) => entry.reviewStatus === 'native-review-required'))
      .toHaveLength(6);
  });
});
