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

/**
 * Russian words usually written without the dots on ё ("мед" for "мёд"):
 * typing the plain spelling offers the ё word first (owner report
 * 2026-10-31: "мед" showed медали / медведев / медаль / медленно / медведь
 * and no honey). Reviewed: each is the same word with or without the dots,
 * and each is in the Russian seed (tests check both). Pairs that are two
 * different words are never listed (все / всё, небо / нёбо).
 * Not a spelling alias: the two spellings stay separate words, so "мед"
 * still completes to медаль and an explicitly typed ё stays exact.
 */
export const RU_YO_TWINS: readonly string[] = ['мёд', 'ещё', 'её', 'лёд', 'самолёт', 'чёрный', 'зелёный', 'идём', 'пойдём', 'ребёнок'];

/** The reviewed ё word the typed Russian word spells without its dots, or null. */
export function ruYoTwinOf(typed: string): string | null {
  const plain = normalizePredictionSpelling(typed, 'ru');
  if (!plain || plain.includes('ё')) return null;
  const letters = [...plain];
  return RU_YO_TWINS.find(word => {
    const target = [...word];
    return target.length === letters.length
      && letters.every((letter, index) => target[index] === letter || (letter === 'е' && target[index] === 'ё'));
  }) ?? null;
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

// English plural endings that make a second same-stem tile a duplicate of
// the first ("german / germans"). English only: in French and Spanish "-s"
// marks forms a user needs next to each other ("enfant / enfants", "je
// prends"), and other languages' endings change case or definiteness.
// Contractions ("that's") are not plurals and keep their slot.
const ES_PLURAL_AFTER = /(?:s|x|z|ch|sh|o)$/;
// Words ending in these take "-es", never a plain "-s" (bus / buses). Not
// "ch": hard-ch words take "-s" (stomach / stomachs), soft-ch words "-es".
const SIBILANT_END = /(?:s|x|z|sh)$/;
// English words that end in "s" but are not the plural of the shorter word.
const EN_STANDALONE_S_WORDS = new Set(['thanks', 'news', 'towards', 'besides', 'sometimes', 'afterwards', 'upstairs', 'downstairs', 'indoors', 'outdoors', 'glasses', 'pants', 'shorts', 'scissors', 'clothes', 'stairs', 'jeans', 'hers', 'ours', 'yours', 'theirs', 'means', 'goods', 'manners', 'customs', 'spirits', 'economics', 'politics', 'physics', 'mathematics', 'woods', 'papers', 'times', 'greens', 'sweets']);
// Below three letters the "plural" is another word: I / is, a / as, hi / his.
const MIN_TWIN_STEM_LENGTH = 3;

/**
 * True when one word is only the other plus an English plural ending
 * ("german" / "germans"), so the two on one bar read as the same tile twice.
 * English only, and never for standalone words that end in "s" ("thanks").
 */
export function isPluralTwin(word: string, shown: string, lang?: string): boolean {
  if ((lang ?? '').split('-')[0].toLowerCase() !== 'en') return false;
  const a = normalizePredictionSpelling(word, lang);
  const b = normalizePredictionSpelling(shown, lang);
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  if (long === short || short.length < MIN_TWIN_STEM_LENGTH || !long.startsWith(short) || EN_STANDALONE_S_WORDS.has(long)) return false;
  const suffix = long.slice(short.length);
  // "-es" makes a plural only after s, x, z, ch, sh or o (bus / buses,
  // box / boxes, potato / potatoes); "not" / "notes" and "tap" / "tapes"
  // are different words. After s, x, z or sh a plain "-s" is never a
  // plural ("his" / "hiss").
  return (suffix === 's' && !SIBILANT_END.test(short)) || (suffix === 'es' && ES_PLURAL_AFTER.test(short));
}
