/**
 * Shared prediction vocabulary, per language (owner decision 2026-10-30).
 *
 * Words several AAC users typed that no built-in dictionary has, added for
 * everyone by the Synalux portal after an AI check (portal
 * lib/aac-shared-words.ts). Held here so the language filter and the
 * prediction baseline can use them; services/sharedWordsService.ts loads them.
 */
import type { WordFreqEntry } from '@/types';

/** Shared words rank below every dictionary word with real counts. */
const SHARED_WORD_COUNT = 1;
const shared = new Map<string, ReadonlySet<string>>();
const asFreq = new Map<string, Record<string, WordFreqEntry>>();
const EMPTY: ReadonlySet<string> = new Set();

// A typographic apostrophe is the same word ("aujourd’hui").
export const sharedWordKey = (word: string) => word.normalize('NFC').trim().toLowerCase().replace(/’/g, "'");

export function sharedWordsFor(lang: string): ReadonlySet<string> {
  return shared.get(lang) ?? EMPTY;
}

export function setSharedWords(lang: string, words: readonly string[]): void {
  shared.set(lang, new Set(words.map(sharedWordKey).filter(Boolean)));
  asFreq.delete(lang);
}

/** The shared words as a prediction baseline for getPredictions. */
export function sharedWordFreq(lang: string): Record<string, WordFreqEntry> {
  let freq = asFreq.get(lang);
  if (!freq) {
    freq = Object.fromEntries([...sharedWordsFor(lang)].map(word => [word, { count: SHARED_WORD_COUNT, lastUsed: 0 }]));
    asFreq.set(lang, freq);
  }
  return freq;
}

export function _resetSharedWordsForTests(): void {
  shared.clear();
  asFreq.clear();
}
