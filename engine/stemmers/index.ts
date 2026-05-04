// Per-language stemmer registry. Returns a (word) => stem function for the
// given language, or null when no stemmer is registered (caller should
// fall back to char-prefix grouping).
//
// Stem-grouping is used by predictionEngine to dedupe inflected forms of
// the same lemma so the prediction bar shows DISTINCT word continuations
// rather than 5 conjugations of the same verb. The stemmer doesn't have to
// be linguistically perfect — only consistent within a lemma family.
//
// Coverage:
//   en, es, fr, pt, de, ro, ru, ar — Snowball algorithms (snowball-stemmers npm)
//   uk                            — Custom suffix-stripping heuristic
//   ja                            — Conjugation suffix table
//   ko                            — Particle/ending table + es-hangul fallback
//   zh-Hans, zh-Hant, zh-HK       — null (no inflection; char-prefix is correct)

import { getSnowballStemmer } from './snowball';
import { ukStem } from './ukrainian';
import { jaStem } from './japanese';
import { koStem } from './korean';

export type Stemmer = (word: string) => string;

const customStemmers: Record<string, Stemmer> = {
  uk: ukStem,
  ja: jaStem,
  ko: koStem,
};

export function getStemmer(lang: string): Stemmer | null {
  const custom = customStemmers[lang];
  if (custom) return custom;
  return getSnowballStemmer(lang);
}
