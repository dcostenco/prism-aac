import byLang from './ageBlocklistByLang.json';
import compoundExceptions from './suggestionCompoundExceptions.json';
import { foldPictureWordCase } from '../lib/wordCase';

export const PROFANITY = new Set([
  'shit', 'fuck', 'ass', 'bitch', 'bastard', 'crap',
  'dick', 'cock', 'pussy', 'slut', 'whore', 'piss', 'asshole',
  'bullshit', 'goddamn', 'motherfucker', 'nigger', 'faggot', 'retard',
  'porn', 'sex', 'naked', 'nude',
  'satan', 'devil', 'demon',
]);

export const SENSITIVE = new Set([
  'hell', 'damn',
  // Explicit whole words: substring/stem matching would also block "skills" or "kilometers".
  'kill', 'kills', 'killed', 'killing', 'killings', 'killer', 'killers', 'suicide', 'murder', 'rape',
  'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'weed',
  'gun', 'bomb', 'weapon', 'terrorist',
  'die', 'dies', 'died', 'dying', 'dead', 'death',
  'hate', 'stupid', 'idiot', 'dumb', 'ugly', 'fat', 'loser',
]);

export const AGE_BLOCKED_WORDS = new Set([...PROFANITY, ...SENSITIVE]);

// The same two lists for every other prediction language, with the forms its prediction data holds. Each applies to
// its own language only: a word that is vulgar in one language is ordinary in another (Italian "fica", Portuguese
// "fica" = stays). Words whose everyday sense is common are left out (French "gros" = big, Hebrew "כוס" = cup), and so
// are AAC essentials ("I don't like it", toilet words) and neutral words for disabled or gay people.
const BY_LANG = new Map(
  Object.entries(byLang as Record<string, { profanity: string[]; sensitive: string[] }>)
    .map(([lang, lists]) => [lang, { profanity: new Set(lists.profanity), sensitive: new Set(lists.sensitive) }]),
);

// Ordinary local homographs: German the/this, bright, thick and card ace;
// Dutch that; French late. The local language's own lists still take precedence.
const ENGLISH_HOMOGRAPHS = new Map([
  ['de', new Set(['die', 'dies', 'hell', 'dick', 'ass'])],
  ['nl', new Set(['die'])],
  ['fr', new Set(['retard'])],
]);

function listsFor(lang?: string) {
  return lang ? BY_LANG.get(lang.startsWith('zh') ? 'zh' : lang) : undefined;
}

const APOSTROPHE_VARIANTS = /[‘’ʼʹ´`′＇]/g;
// This ordinary contraction folds to the listed word "hell" if its
// apostrophe is deleted. Other punctuation folds retain the existing guard.
const ORDINARY_APOSTROPHE_WORDS = new Set(["he'll"]);
const HAN_WORD = /^\p{Script=Han}+$/u;

const norm = (word: string) => word.toLowerCase().normalize('NFC').replace(APOSTROPHE_VARIANTS, "'");

function englishListed(word: string, list: ReadonlySet<string>, lang?: string): boolean {
  return list.has(word) && !ENGLISH_HOMOGRAPHS.get(lang?.split('-')[0] ?? 'en')?.has(word);
}

/** English profanity, except ordinary local homographs, or its own language's list. */
export function isProfane(word: string, lang?: string): boolean {
  const w = norm(word);
  const local = lang === 'tr' ? foldPictureWordCase(word, lang).normalize('NFC') : w;
  const own = listsFor(lang)?.profanity;
  return englishListed(w, PROFANITY, lang) || (own?.has(w) ?? false) ||
    (local !== w && (englishListed(local, PROFANITY, lang) || (own?.has(local) ?? false)));
}

/** English sensitive words, except ordinary local homographs, or its own language's list. */
export function isSensitive(word: string, lang?: string): boolean {
  const w = norm(word);
  const local = lang === 'tr' ? foldPictureWordCase(word, lang).normalize('NFC') : w;
  const own = listsFor(lang)?.sensitive;
  return englishListed(w, SENSITIVE, lang) || (own?.has(w) ?? false) ||
    (local !== w && (englishListed(local, SENSITIVE, lang) || (own?.has(local) ?? false)));
}

/** A word the prediction bar never offers: profane or sensitive, in English or in its own language. */
export function isAgeBlocked(word: string, lang?: string): boolean {
  return isProfane(word, lang) || isSensitive(word, lang);
}

/** Every word of a text: split at anything that is not a letter, mark or digit ("shit,dog" is two words), plus each
 *  space-separated word with non-apostrophe punctuation dropped ("f.u.c.k" -> fuck). Marks stay: Devanagari, Bengali and Amharic
 *  vowel signs are marks, and dropping them turns a listed word into an unlisted one. */
function textWords(text: string): string[] {
  const lower = norm(text);
  const split = lower.split(/[^\p{L}\p{M}\p{N}]+/u);
  const words = lower.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{M}\p{N}']/gu, '').replace(/^'+|'+$/g, ''));
  const joined = words.map((word) => ORDINARY_APOSTROPHE_WORDS.has(word) ? word : word.replace(/'/g, ''));
  return [...new Set([...split, ...words, ...joined])].filter(Boolean);
}

/** Chinese and Japanese are written without spaces, so a listed word can sit inside a longer run ("你是傻瓜"). */
const unspaced = (lang?: string) => Boolean(lang && (lang.startsWith('zh') || lang === 'ja'));

function cutsReviewedHanCompound(text: string, start: number, end: number, lang?: string): boolean {
  const key = lang?.startsWith('zh') ? 'zh' : lang;
  const compounds = (compoundExceptions as Readonly<Record<string, readonly string[]>>)[key ?? ''] ?? [];
  return compounds.some((word) => {
    if (isAgeBlocked(word, lang)) return false;
    for (let left = Math.max(0, start - word.length + 1); left < end; left++) {
      if (!text.startsWith(word, left)) continue;
      const right = left + word.length;
      if ((left < start && start < right) || (left < end && end < right)) return true;
    }
    return false;
  });
}

/** All languages share punctuation checks. CJK matches cannot split a reviewed
 *  ordinary compound, even when a match begins in its preceding word (我操控).
 *  Exceptions never come from frequency or learned vocabulary.
 *  Join only adjacent Han segments, never Japanese grammatical particles. */
export function containsBlockedSuggestion(text: string, lang?: string): boolean {
  if (textWords(text).some((word) => isAgeBlocked(word, lang))) return true;
  if (!unspaced(lang)) return false;
  const local = listsFor(lang);
  const maxLength = Math.max(...[...AGE_BLOCKED_WORDS, ...(local?.profanity ?? []), ...(local?.sensitive ?? [])].map((word) => word.length));
  const normalized = norm(text);
  const segments = [...new Intl.Segmenter(lang, { granularity: 'word' }).segment(normalized)]
    .filter((segment) => segment.isWordLike);
  for (let i = 0; i < segments.length; i++) {
    let word = '';
    for (let j = i; j < segments.length; j++) {
      if (j > i && (segments[j].index !== segments[j - 1].index + segments[j - 1].segment.length
        || !HAN_WORD.test(segments[j - 1].segment) || !HAN_WORD.test(segments[j].segment))) break;
      word += segments[j].segment;
      if (word.length > maxLength) break;
      if (isAgeBlocked(word, lang)) {
        if (cutsReviewedHanCompound(normalized, segments[i].index, segments[j].index + segments[j].segment.length, lang)) continue;
        return true;
      }
    }
  }
  return false;
}

/** Text (a phrase, not a single word) that holds a profane word. In Chinese and Japanese a listed word counts wherever it
 *  appears; this can refuse a harmless compound (操场 holds 操), which for a picture means only that the phrase shows as text. */
export function containsProfanity(text: string, lang?: string): boolean {
  if (textWords(text).some((w) => isProfane(w, lang))) return true;
  if (!unspaced(lang)) return false;
  const t = text.normalize('NFC');
  return [...(listsFor(lang)?.profanity ?? [])].some((w) => t.includes(w));
}

/** Text that holds a sensitive word. In Chinese and Japanese only entries of two or more characters count inside a longer
 *  run: single characters such as 死 or 肥 are parts of many ordinary words (肥皂 soap). */
export function containsSensitive(text: string, lang?: string): boolean {
  if (textWords(text).some((w) => isSensitive(w, lang))) return true;
  if (!unspaced(lang)) return false;
  const t = text.normalize('NFC');
  return [...(listsFor(lang)?.sensitive ?? [])].some((w) => [...w].length > 1 && t.includes(w));
}
