/**
 * Regression suite for the 2026-08-15 "prediction is bad" report (IMG_2433).
 *
 * Trace captured against the real en seed before writing these tests:
 *
 *   getPredictions("How are you ")   -> ["want","ready","I","feeling","help"]   contextual
 *   getPredictions("How are you? ")  -> ["I","To","A","You","The"]              generic junk
 *
 *   seed.bigrams keys starting "you|"   = 151
 *   seed.bigrams keys starting "you?|"  = 0
 *
 * getPredictions tokenises with `currentText.trim().split(/\s+/)`, so a word
 * carrying trailing punctuation stays glued to it ("you?"). Every n-gram lookup
 * keyed on that token misses, and the bar collapses to raw corpus frequency for
 * the next one or two words. AAC users write in short punctuated utterances, so
 * this fires constantly — it is the failure the screenshot caught.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getPredictions } from '@/engine/predictionEngine';
import { loadPredictionSeed, type PredictionSeed } from '@/constants/predictionSeeds';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';

const EN_SCRIPT = /^[a-z'-]+$/;
const ALWAYS_CAP = new Set(['i']);

let en: PredictionSeed;
beforeAll(async () => {
  en = await loadPredictionSeed('en');
});

function predict(text: string): string[] {
  return getPredictions(
    text, en.wordFreq, en.bigrams, undefined, en.trigrams,
    DEFAULT_PREDICTIONS, ALWAYS_CAP, EN_SCRIPT, 'en',
  );
}

describe('prediction context survives sentence punctuation', () => {
  // The invariant is equality, not "looks contextual". Some contexts genuinely
  // have thin n-gram coverage in the seed and legitimately fall back to
  // frequency; what must never happen is that ADDING punctuation changes the
  // answer, because the dictionaries are keyed on bare words.
  it.each([
    ['?', 'How are you? ', 'How are you '],
    ['.', 'I am ready. ', 'I am ready '],
    [',', 'I want water, ', 'I want water '],
    ['!', 'I am ready! ', 'I am ready '],
  ])('a trailing "%s" does not change the predicted words', (_p, punctuated, plain) => {
    // Sentence-start capitalisation legitimately differs after . ! ? — compare
    // the word sets, not the rendered casing.
    const withPunct = new Set(predict(punctuated).map((w) => w.toLowerCase()));
    const withoutPunct = new Set(predict(plain).map((w) => w.toLowerCase()));
    expect(withPunct).toEqual(withoutPunct);
  });

  it('predicts a contextual continuation after "How are you? ", not corpus filler', () => {
    // Shipped behaviour returned ["I","To","A","You","The"] — the top of the
    // frequency table, i.e. no context at all.
    const preds = predict('How are you? ').map((w) => w.toLowerCase());
    const corpusFiller = new Set(['i', 'to', 'a', 'the', 'you', 'and', 'of', 'it', 'is', 'in']);
    expect(preds.filter((w) => corpusFiller.has(w)).length).toBeLessThanOrEqual(2);
  });

  it('treats a word closed by punctuation as finished, not as a partial to complete', () => {
    // After "you?" the user closed the word. Offering "your"/"young" would be
    // completing a word they already ended.
    const preds = predict('How are you?').map((w) => w.toLowerCase());
    expect(preds.filter((w) => w.startsWith('you') && w !== 'you')).toEqual([]);
  });

  it('an already-complete last word does not drown the bar in prefix look-alikes', () => {
    // "can" is a complete word (seed count 785). After "Now I can" the useful
    // suggestions are continuations ("go", "see", "do", "help"), not other
    // words that merely start with c-a-n ("candy", "cannot", "canvas").
    const preds = predict('How are you? Now I can').map((w) => w.toLowerCase());
    const prefixLookAlikes = preds.filter((w) => w.startsWith('can') && w !== 'can');
    expect(prefixLookAlikes.length).toBeLessThanOrEqual(1);
  });
});
