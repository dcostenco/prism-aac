/**
 * Prediction tiles follow the board, in every language.
 *
 * A predicted word that is built-in vocabulary shows the bundled symbol its
 * board tile shows — or just the word, when the tile has none — and asks for
 * nothing over the network. Only a word outside the vocabulary can get a
 * generated picture (paid plans).
 *
 * History: the prediction bar once showed five blank boxes in Amharic while
 * English showed five pictograms, because the lookup was issued with the
 * localized word. Symbols are now tied to the phrase's meaning, so the same
 * symbol appears whatever the language — provided the localized word can be
 * tied back to the built-in phrase, which is what the reverse lookup does.
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
import { loadPictureWords, pictureWordSource } from '@/constants/pictureWords';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';

/** Non-Latin and Latin scripts alike; these eight once rendered blank tiles. */
const SAMPLE_LOCALES = ['ja', 'hi', 'vi', 'tl', 'id', 'am', 'sw', 'bn'] as const;

describe('reverse lookup of a localized word to its English source', () => {
  it('resolves core vocabulary in every sampled locale', () => {
    // 'I', 'You', 'More', 'Want', 'Help' are the five tiles that rendered
    // blank in the production screenshot.
    const core = ['cw-i', 'cw-you', 'cw-more', 'cw-want', 'cw-help']
      .map((id) => DEFAULT_PHRASES.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    expect(core.length, 'core phrase ids drifted — update this list').toBeGreaterThan(2);

    for (const lang of SAMPLE_LOCALES) {
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
 * Renders the real PredictionBar on a PAID plan, so any generated-picture
 * request shows up in `pictogramCalls`, and inspects both the requests and
 * the rendered symbols.
 */
const pictogramCalls: Array<[string, string]> = [];
vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: (phrase: string, lang: string) => {
    pictogramCalls.push([phrase, lang]);
    return Promise.resolve(null);
  },
  pictureModeForProfile: () => 'symbols-ai',
  typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
}));

const localizedFor = (id: string, lang: 'am' | 'en') => {
  const p = DEFAULT_PHRASES.find((x) => x.id === id)!;
  return getPhraseText(p.id, lang, p.text);
};

/** word → data-picture state for every rendered prediction tile. */
const renderedStates = () => Object.fromEntries(
  [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')].map((tile) => [
    (tile.getAttribute('aria-label') ?? '').replace('Predict: ', ''),
    `${tile.dataset.picture}${tile.querySelector('.aac-tile-icon') ? '+well' : ''}`,
  ]),
);

/** word → symbol file name (or '-') for every rendered prediction tile. */
const renderedPictures = () => Object.fromEntries(
  [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')].map((tile) => [
    (tile.getAttribute('aria-label') ?? '').replace('Predict: ', ''),
    tile.querySelector('img')?.getAttribute('src') ?? '-',
  ]),
);

function setLanguage(lang: 'am' | 'en') {
  useSettingsStore.setState({
    language: lang, outputLanguage: lang, speechRate: 0.5, speechVolume: 1.0,
  } as never);
}

describe('PredictionBar pictures', () => {
  beforeEach(() => {
    cleanup();
    pictogramCalls.length = 0;
    if (typeof window !== 'undefined') window.localStorage.clear();
    setLanguage('am');
    useMessageStore.setState({ text: '' } as never);
    usePredictionStore.setState({
      aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {}, predictions: [],
    });
  });

  // With an empty message the bar shows the language's AAC-core filler:
  // I, You, More, Want, Help. Every one of them has a Prism AAC symbol, so
  // every filler tile shows its board picture, and none asks for a generated one.
  it.each(['en', 'am'] as const)('filler tiles show their board symbol or just the word, with no request (%s)', async (lang) => {
    setLanguage(lang);

    await act(async () => { render(<PredictionBar />); });

    const pictures = renderedPictures();
    expect(pictures[localizedFor('cw-i', lang)]).toBe('/prism-aac/symbols/cw-i.png');
    expect(pictures[localizedFor('cw-you', lang)]).toBe('/prism-aac/symbols/cw-you.png');
    expect(pictures[localizedFor('cw-more', lang)]).toBe('/prism-aac/symbols/cw-more.png');
    expect(pictures[localizedFor('cw-want', lang)]).toBe('/prism-aac/symbols/cw-want.png');
    expect(pictures[localizedFor('cw-help', lang)]).toBe('/prism-aac/symbols/cw-help.png');
    expect(Object.keys(pictures)).toHaveLength(5);
    expect(pictogramCalls, 'built-in vocabulary must never ask for a generated picture').toEqual([]);
    // A picture sits in its well above the word.
    const states = renderedStates();
    expect(states[localizedFor('cw-i', lang)]).toBe('symbol+well');
    expect(states[localizedFor('cw-help', lang)]).toBe('symbol+well');
    expect(states[localizedFor('cw-more', lang)]).toBe('symbol+well');
  });

  it('asks for a generated picture, in its own locale, for a word outside the vocabulary', async () => {
    // The fallback branch is only reachable by a word the language allowlist
    // accepts but the phrase table cannot reverse — PredictionBar drops
    // anything else before render, so a nonsense string never gets this far.
    // That is the realistic case: the Amharic seed carries ~1500 unigrams
    // against 1512 English phrases, so most predictions are not tile text.
    const seed = await loadPredictionSeed('am');
    await ensureLangCorpusLoaded('am');
    // A word the language's picture table links to a symbol is not an orphan: it shows that symbol and asks for nothing
    // (the bar now starts the table as soon as a tile renders, so such a word never reaches the generator).
    await loadPictureWords('am');
    const orphan = Object.keys(seed.wordFreq)
      .find((w) => englishSourceFor(w, 'am') === null && isAllowedInLang(w, 'am')
        && pictureWordSource(w, 'am') === null && !builtInVocabularySymbol(w, 'am'));
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
