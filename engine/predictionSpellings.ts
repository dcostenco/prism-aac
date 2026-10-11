import spellingAliases from '@/constants/generated/predictionSpellingAliases.json';
import { foldPictureWordCase } from '@/lib/wordCase';

const SPELLING_ALIASES = spellingAliases as Record<string, Record<string, string>>;

/** Keep edge punctuation separate so prediction and selection agree on the token. */
export function predictionTokenParts(value: string): { leading: string; word: string; trailing: string } {
  const leading = value.match(/^[^\p{L}\p{M}\p{N}]+/u)?.[0] ?? '';
  const rest = value.slice(leading.length);
  const trailing = rest.match(/[^\p{L}\p{M}\p{N}'-]+$/u)?.[0] ?? '';
  return { leading, word: trailing ? rest.slice(0, -trailing.length) : rest, trailing };
}

/** Compare equivalent keyboard encodings without changing stored words. */
export function normalizePredictionSpelling(value: string, lang = 'en'): string {
  const key = foldPictureWordCase(value, lang).normalize('NFC');
  return lang === 'ro' ? key.replace(/ş/g, 'ș').replace(/ţ/g, 'ț') : key;
}

/** Only explicit same-word spelling aliases may merge complete-word meanings. */
export function predictionWordKey(value: string, lang = 'en'): string {
  const key = normalizePredictionSpelling(value, lang);
  const aliases = Object.prototype.hasOwnProperty.call(SPELLING_ALIASES, lang) ? SPELLING_ALIASES[lang] : undefined;
  return aliases && Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : key;
}

export function preferredPredictionSpelling(value: string, lang = 'en'): string {
  const key = normalizePredictionSpelling(value, lang);
  const aliases = Object.prototype.hasOwnProperty.call(SPELLING_ALIASES, lang) ? SPELLING_ALIASES[lang] : undefined;
  return aliases && Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : value;
}

/** Russian e typing also finds ё spellings; this never merges their meanings. */
export function matchesPredictionPrefix(word: string, prefix: string, lang = 'en'): boolean {
  const candidate = normalizePredictionSpelling(word, lang);
  const typed = normalizePredictionSpelling(prefix, lang);
  if (candidate.startsWith(typed)) return true;
  if (lang !== 'ru' || candidate.length < typed.length) return false;
  // Omitted ё is tolerated; explicitly typed ё remains precise.
  return [...typed].every((letter, index) => candidate[index] === letter ||
    (letter === 'е' && candidate[index] === 'ё'));
}

/** Complete context tokens retain meaning; only the final partial uses prefix matching. */
export function matchesPredictionContext(key: string, prefix: string, lang = 'en'): boolean {
  const words = key.split('|');
  const parts = prefix.split('|');
  if (words.length < parts.length) return false;
  return parts.every((part, index) => index === parts.length - 1
    ? matchesPredictionPrefix(words[index], part, lang)
    : predictionWordKey(words[index], lang) === predictionWordKey(part, lang));
}
