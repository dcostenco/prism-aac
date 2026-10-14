import reviewed from '@/constants/generated/basicVocabularyPictures.json';
import { normalizePredictionSpelling, predictionTokenParts } from '@/engine/predictionSpellings';

const WORD = /^[\p{L}\p{M}][\p{L}\p{M}'-]*$/u;
const languages = reviewed.languages as Record<string, Record<string, { predictionSeed?: boolean }>>;
const alternatives = (reviewed as unknown as { alternatives?: Record<string, Record<string, unknown>> }).alternatives ?? {};
const cache = new Map<string, ReadonlySet<string>>();

/** Exact reviewed local spellings; phrases never invent individual word meanings. */
export function getReviewedBasicWords(lang: string, includePictureOnly = false): ReadonlySet<string> {
  const cacheKey = `${lang}|${includePictureOnly}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const entries = Object.prototype.hasOwnProperty.call(languages, lang) ? languages[lang] : {};
  const alternativeEntries = Object.prototype.hasOwnProperty.call(alternatives, lang) ? alternatives[lang] : {};
  // Exact reviewed forms are valid in their language even when they should not
  // add prediction weight or bypass the completion-confidence threshold.
  const seedLabels = Object.entries(entries).filter(([, entry]) => includePictureOnly || entry.predictionSeed !== false).map(([label]) => label);
  const words = new Set([...seedLabels, ...Object.keys(alternativeEntries)].flatMap(label => {
    const word = predictionTokenParts(normalizePredictionSpelling(label, lang)).word;
    return WORD.test(word) ? [word] : [];
  }));
  cache.set(cacheKey, words);
  return words;
}
