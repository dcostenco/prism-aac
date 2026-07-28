/**
 * Prediction tiles must get pictures in locales ARASAAC cannot search.
 *
 * Found by looking at production, not by a test: the English prediction bar
 * showed five pictograms and the Amharic one showed five blank white boxes.
 * The unit suite was fully green at the time, because nothing asserted which
 * locale the pictogram lookup is issued in.
 *
 * ARASAAC answers HTTP 400 for ja, hi, vi, tl, id, am, sw and bn — eight of
 * the shipped languages. Its images are language-neutral; only the search term
 * is localized. PhraseTile already exploits that by searching with the English
 * source. PredictionBar searched the localized word and got nothing back.
 *
 * A blank prediction bar is not a cosmetic defect for an AAC user who reads
 * symbols rather than text — it removes the prediction feature for them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, cleanup } from '@testing-library/react';
import PredictionBar from '@/components/PredictionBar';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { englishSourceFor } from '@/constants/reverseTranslation';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';

/** Locales ARASAAC's search endpoint rejects — verified against the live API. */
const UNSEARCHABLE = ['ja', 'hi', 'vi', 'tl', 'id', 'am', 'sw', 'bn'] as const;

describe('reverse lookup of a localized word to its English source', () => {
  it('resolves core vocabulary in every locale ARASAAC cannot search', () => {
    // 'I', 'You', 'More', 'Want', 'Help' are the five tiles that rendered
    // blank in the production screenshot.
    const core = ['cw-i', 'cw-you', 'cw-more', 'cw-want', 'cw-help']
      .map((id) => DEFAULT_PHRASES.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    expect(core.length, 'core phrase ids drifted — update this list').toBeGreaterThan(2);

    for (const lang of UNSEARCHABLE) {
      for (const p of core) {
        const localized = getPhraseText(p.id, lang, p.text);
        if (localized === p.text) continue; // untranslated; nothing to reverse
        expect(
          englishSourceFor(localized, lang),
          `${lang}: "${localized}" (${p.id}) must map back to English`,
        ).toBeTruthy();
      }
    }
  });

  it('returns null for English and for words outside the vocabulary', () => {
    expect(englishSourceFor('anything', 'en')).toBeNull();
    expect(englishSourceFor('zzzznotaword', 'am')).toBeNull();
    expect(englishSourceFor('', 'am')).toBeNull();
  });

  it('is case- and whitespace-insensitive', () => {
    const p = DEFAULT_PHRASES.find((x) => x.id === 'cw-i')!;
    const localized = getPhraseText(p.id, 'bn', p.text);
    expect(englishSourceFor(`  ${localized.toUpperCase()}  `, 'bn'))
      .toBe(englishSourceFor(localized, 'bn'));
  });
});

/**
 * Renders the real PredictionBar and inspects which locale it asks the
 * pictogram service for.
 *
 * Asserting on the ARGUMENTS rather than on a rendered <img>: the bug was
 * never that the request failed to fire — it fired, in a locale the API
 * rejects. Only the call site distinguishes those, and in jsdom no image
 * would load either way.
 */
const pictogramCalls: Array<[string, string]> = [];
vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: (phrase: string, lang: string) => {
    pictogramCalls.push([phrase, lang]);
    return Promise.resolve(null);
  },
  pictureModeForProfile: () => 'arasaac',
}));

describe('PredictionBar issues its pictogram lookup in a searchable locale', () => {
  const amharicFor = (id: string) => {
    const p = DEFAULT_PHRASES.find((x) => x.id === id)!;
    return { localized: getPhraseText(p.id, 'am', p.text), english: p.text };
  };

  beforeEach(() => {
    cleanup();
    pictogramCalls.length = 0;
    if (typeof window !== 'undefined') window.localStorage.clear();
    useSettingsStore.setState({
      language: 'am', outputLanguage: 'am', speechRate: 0.5, speechVolume: 1.0,
    } as never);
    useMessageStore.setState({ text: '' } as never);
  });

  it('searches in English for a locale ARASAAC rejects', async () => {
    const i = amharicFor('cw-i');
    const want = amharicFor('cw-want');
    // Non-empty text matters: with an empty message PredictionBar ignores the
    // store's predictions and renders only the AAC-core filler. An earlier
    // draft of this test asserted on "I" that came from that filler, so it
    // would have passed without exercising the store path at all.
    useMessageStore.setState({ text: 'ሀ ' } as never);
    usePredictionStore.setState({
      aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {},
      predictions: [i.localized, want.localized],
    });

    await act(async () => { render(<PredictionBar />); });

    expect(pictogramCalls.length, 'no pictogram lookup was issued').toBeGreaterThan(0);
    const forI = pictogramCalls.find(([phrase]) => phrase === i.english || phrase === i.localized);
    expect(forI, `no lookup for "${i.localized}"`).toBeTruthy();
    // The regression: this was ['እኔ', 'am'] — a locale ARASAAC answers 400 for.
    expect(forI![1], 'must not search an unsearchable locale').toBe('en');
    expect(forI![0]).toBe(i.english);
  });

  it('resolves EVERY default filler tile, not just most of them', async () => {
    // The production screenshot showed five blank tiles. A first cut of this
    // fix resolved four of them: the fifth, እርዳታ, comes from the AAC-core
    // matrix rather than the phrase table, which words Help differently. Four
    // out of five still leaves a blank tile on screen.
    usePredictionStore.setState({
      aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {}, predictions: [],
    });

    await act(async () => { render(<PredictionBar />); });

    const unresolved = pictogramCalls.filter(([, lang]) => lang !== 'en');
    expect(
      unresolved,
      `these default tiles would render blank: ${JSON.stringify(unresolved)}`,
    ).toEqual([]);
  });

  it('leaves a word outside the vocabulary searching its own locale', async () => {
    // The fallback branch is only reachable by a word the language allowlist
    // accepts but the phrase table cannot reverse — PredictionBar drops
    // anything else before render, so a nonsense string never gets this far.
    // That is the realistic case: the Amharic seed carries ~1500 unigrams
    // against 1512 English phrases, so most predictions are not tile text.
    const seed = await loadPredictionSeed('am');
    await ensureLangCorpusLoaded('am');
    const orphan = Object.keys(seed.wordFreq)
      .find((w) => englishSourceFor(w, 'am') === null && isAllowedInLang(w, 'am'));
    expect(orphan, 'no non-vocabulary word in the am seed — premise drifted').toBeTruthy();

    useMessageStore.setState({ text: 'ሀ ' } as never);
    usePredictionStore.setState({
      aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {},
      predictions: [orphan!],
    });

    await act(async () => { render(<PredictionBar />); });

    const call = pictogramCalls.find(([phrase]) => phrase === orphan);
    expect(call, `"${orphan}" should still be looked up`).toBeTruthy();
    expect(call![1], 'unmappable word keeps its own locale').toBe('am');
  });
});
