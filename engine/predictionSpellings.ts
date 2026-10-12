import spellingAliases from '@/constants/generated/predictionSpellingAliases.json';
import { foldPictureWordCase } from '@/lib/wordCase';

const SPELLING_ALIASES = spellingAliases as Record<string, Record<string, string>>;
const VIETNAMESE_TONE_MARKS = /[\u0300\u0301\u0303\u0309\u0323]/g;

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

/** Reviewed alternate spellings complete the same word; distinct accented words stay separate. */
export function matchesPredictionPrefix(word: string, prefix: string, lang = 'en'): boolean {
  const candidate = normalizePredictionSpelling(word, lang);
  const typed = normalizePredictionSpelling(prefix, lang);
  const candidateKey = predictionWordKey(candidate, lang);
  const typedKey = predictionWordKey(typed, lang);
  if (candidateKey.startsWith(typedKey)) return true;
  // A complete approved alias is already a word, not a prefix of unrelated
  // spellings: Romanian esti means ești, never estic or estimat.
  if (typedKey !== typed) return false;
  const aliases = Object.prototype.hasOwnProperty.call(SPELLING_ALIASES, lang) ? SPELLING_ALIASES[lang] : undefined;
  if (aliases && Object.entries(aliases).some(([alternate, standard]) =>
    standard === candidateKey && alternate.startsWith(typed))) return true;
  // A Korean syllable can still be awaiting its final consonant.
  if (lang === 'ko') return candidate.normalize('NFD').startsWith(typed.normalize('NFKD'));
  // The software keyboard supplies Vietnamese base vowels. Omitted tone
  // marks may find completions, but explicit tones and vowel shapes stay precise.
  if (lang === 'vi' && candidate.length >= typed.length) {
    return [...typed].every((letter, index) => candidate[index] === letter ||
      candidate[index].normalize('NFD').replace(VIETNAMESE_TONE_MARKS, '') === letter.normalize('NFD'));
  }
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
