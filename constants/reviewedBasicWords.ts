import reviewed from '@/constants/generated/basicVocabularyPictures.json';
import { normalizePredictionSpelling, predictionTokenParts } from '@/engine/predictionSpellings';

const WORD = /^[\p{L}\p{M}][\p{L}\p{M}'-]*$/u;
const languages = reviewed.languages as Record<string, Record<string, unknown>>;
const cache = new Map<string, ReadonlySet<string>>();

/** Exact reviewed local spellings; phrases never invent individual word meanings. */
export function getReviewedBasicWords(lang: string): ReadonlySet<string> {
  const cached = cache.get(lang);
  if (cached) return cached;
  const entries = Object.prototype.hasOwnProperty.call(languages, lang) ? languages[lang] : {};
  const words = new Set(Object.keys(entries).flatMap(label => {
    const word = predictionTokenParts(normalizePredictionSpelling(label, lang)).word;
    return WORD.test(word) ? [word] : [];
  }));
  cache.set(lang, words);
  return words;
}
