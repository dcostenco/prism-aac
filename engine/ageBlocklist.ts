import byLang from './ageBlocklistByLang.json';
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
  'kill', 'suicide', 'murder', 'rape',
  'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'weed',
  'gun', 'bomb', 'weapon', 'terrorist',
  'die', 'dead', 'death',
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

function listsFor(lang?: string) {
  return lang ? BY_LANG.get(lang.startsWith('zh') ? 'zh' : lang) : undefined;
}

const norm = (word: string) => word.toLowerCase().normalize('NFC');

/** On the English profanity list (every language) or on its own language's. */
export function isProfane(word: string, lang?: string): boolean {
  const w = norm(word);
  const local = lang === 'tr' ? foldPictureWordCase(word, lang).normalize('NFC') : w;
  const own = listsFor(lang)?.profanity;
  return PROFANITY.has(w) || (own?.has(w) ?? false) ||
    (local !== w && (PROFANITY.has(local) || (own?.has(local) ?? false)));
}

/** On the English sensitive list (every language) or on its own language's. */
export function isSensitive(word: string, lang?: string): boolean {
  const w = norm(word);
  const local = lang === 'tr' ? foldPictureWordCase(word, lang).normalize('NFC') : w;
  const own = listsFor(lang)?.sensitive;
  return SENSITIVE.has(w) || (own?.has(w) ?? false) ||
    (local !== w && (SENSITIVE.has(local) || (own?.has(local) ?? false)));
}

/** A word the prediction bar never offers: profane or sensitive, in English or in its own language. */
export function isAgeBlocked(word: string, lang?: string): boolean {
  return isProfane(word, lang) || isSensitive(word, lang);
}

/** Every word of a text: split at anything that is not a letter, mark or digit ("shit,dog" is two words), plus each
 *  space-separated word with its punctuation dropped ("f.u.c.k" -> fuck). Marks stay: Devanagari, Bengali and Amharic
 *  vowel signs are marks, and dropping them turns a listed word into an unlisted one. */
function textWords(text: string): string[] {
  const lower = text.toLowerCase().normalize('NFC');
  const split = lower.split(/[^\p{L}\p{M}\p{N}]+/u);
  const joined = lower.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{M}\p{N}]/gu, ''));
  return [...new Set([...split, ...joined])].filter(Boolean);
}

/** Chinese and Japanese are written without spaces, so a listed word can sit inside a longer run ("你是傻瓜"). */
const unspaced = (lang?: string) => Boolean(lang && (lang.startsWith('zh') || lang === 'ja'));

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
