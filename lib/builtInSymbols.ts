import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { englishSourceFor } from '@/constants/reverseTranslation';
import { foldPictureWordCase, pictureChoice, pictureKept, pictureWordSource, pictureWordsStatus } from '@/constants/pictureWords';
import phraseSymbols from '@/constants/generated/phraseSymbols.json';
import { SYMBOL_BASE_PATH } from '@/lib/pictogramSources';
import type { SupportedLanguage } from '@/engine/i18n';
import spatialGrammarPictures from '@/constants/generated/spatialGrammarPictures.json';
import basicVocabularyPictures from '@/constants/generated/basicVocabularyPictures.json';
import { matchesPredictionPrefix, predictionTokenParts, predictionWordKey } from '@/engine/predictionSpellings';

/**
 * Picture symbols for built-in phrases and categories, bundled with the app.
 *
 * Every built-in tile uses one drawing style: the Prism AAC symbols in
 * the locally saved picture pack (constants/generated/phraseSymbols.json maps phrase ids and
 * category ids to files). A built-in phrase without an entry shows its word,
 * and built-in tiles never fall back to generated pictures. Phrases that mean
 * the same word share one file, so the prediction bar can show it too.
 *
 * The complete pack is saved on the device for offline use on every plan.
 */

const SYMBOL_FILES = new Map<string, string>(Object.entries(phraseSymbols.phrases));
const CATEGORY_FILES = new Map<string, string>(Object.entries(phraseSymbols.categories));
/**
 * Pictures for frequent English prediction words that are not built-in
 * phrases ("going", "time", "together"): word forms point at the base word's
 * picture, other words have their own. Only consulted when the word is not
 * built-in vocabulary, so it never overrides a phrase's own rule (a homograph
 * or a word tile keeps showing the word).
 */
const WORD_FILES = new Map<string, string>(Object.entries(phraseSymbols.words ?? {}));
/**
 * English built-in words whose predicted sense has no picture: on the board
 * "May" is the month, but typed it is nearly always the verb ("you may go"),
 * so the prediction bar shows the word.
 */
const WORD_ONLY = new Set<string>((phraseSymbols as { wordOnly?: string[] }).wordOnly ?? []);
const BUILT_IN_IDS = new Set(DEFAULT_PHRASES.map((p) => p.id));
/** Day-of-the-month tiles ("5th"): text tiles on the board, while the spelling may also be a number. */
const DATE_TILE_PREFIX = 'tdate-';

const symbolUrl = (file: string) => `${SYMBOL_BASE_PATH}${file}`;
const BASIC_VOCABULARY = basicVocabularyPictures.languages as Record<string, Record<string, { file: string; means: string }>>;
const APPROVED_SYMBOL_FILES = new Set([...SYMBOL_FILES.values(), ...CATEGORY_FILES.values(), ...WORD_FILES.values()]);
interface AlternativeMeaning {
  files: string[];
  contexts?: Array<{ before: string[]; file: string }>;
}
const ALTERNATIVE_MEANINGS = (basicVocabularyPictures as unknown as {
  alternatives?: Record<string, Record<string, AlternativeMeaning>>;
}).alternatives ?? {};

/** Reviewed meanings remain separate when the sentence does not establish one. */
export function reviewedVocabularyPictureChoices(word: string, lang: SupportedLanguage, context = ''): string[] {
  const table = Object.prototype.hasOwnProperty.call(ALTERNATIVE_MEANINGS, lang) ? ALTERNATIVE_MEANINGS[lang] : undefined;
  const key = predictionWordKey(predictionTokenParts(word).word, lang);
  const entry = table && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
  if (!entry || !entry.files.every(file => APPROVED_SYMBOL_FILES.has(file))) return [];
  const tokens = context.trim().split(/\s+/).filter(Boolean).map(token => predictionTokenParts(token).word);
  if (!/\s$/u.test(context) && tokens.length && matchesPredictionPrefix(word, tokens[tokens.length - 1], lang)) tokens.pop();
  const previous = predictionWordKey(tokens[tokens.length - 1] ?? '', lang);
  const selected = entry.contexts?.find(rule => rule.before.includes(previous));
  return selected ? [selected.file] : entry.files;
}

/** True for the id of a phrase that ships with the app. */
export function isBuiltInPhraseId(id: string | undefined | null): id is string {
  return typeof id === 'string' && BUILT_IN_IDS.has(id);
}

/** The bundled symbol for a built-in phrase, or null when it shows its word. */
export function builtInPhraseSymbolUrl(id: string): string | null {
  const file = SYMBOL_FILES.get(id);
  return file ? symbolUrl(file) : null;
}

/**
 * The bundled symbol for a built-in category tile, or null to keep its emoji.
 * A category the user made (isCustom) keeps the emoji they chose, even if a
 * synced copy carries a built-in id.
 */
export function builtInCategorySymbolUrl(category: { id: string; isCustom?: boolean }): string | null {
  if (category.isCustom) return null;
  const file = CATEGORY_FILES.get(category.id);
  return file ? symbolUrl(file) : null;
}

/**
 * Case-fold, trim, and drop edge punctuation, so "When?" matches "when"; a
 * typographic apostrophe (iOS keyboards type ’) becomes ', so "can’t" matches "can't".
 */
const normalizeWord = (s: string, lang?: SupportedLanguage) => {
  const trimmed = s.trim();
  const folded = foldPictureWordCase(trimmed, lang ?? 'en');
  const key = folded.replace(/\u2019/g, "'").replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').replace(/\s+/g, ' ');
  return key.normalize('NFC');
};

/** Reviewed primary AAC meanings also apply before a language's lazy table arrives. */
function basicVocabularySymbol(key: string, lang: SupportedLanguage, word: string): string | null {
  const words = BASIC_VOCABULARY[lang === 'zh' ? 'zh-Hans' : lang];
  let exact = foldPictureWordCase(word.trim(), lang).replace(/\u2019/g, "'").replace(/\s+/g, ' ').normalize('NFC');
  if (lang === 'ar' && /[?؟]/u.test(exact.match(/[\p{P}\s]+$/u)?.[0] ?? '')) {
    exact = `${key}؟`;
  }
  const record = words && Object.prototype.hasOwnProperty.call(words, exact) ? words[exact]
    : words && Object.prototype.hasOwnProperty.call(words, key) ? words[key] : null;
  return record && APPROVED_SYMBOL_FILES.has(record.file) ? symbolUrl(record.file) : null;
}

const SPATIAL_GRAMMAR = spatialGrammarPictures.aliases as Record<string, Record<string, string>>;
/** Common spatial words use their approved relation symbol, including before table loading. */
function spatialGrammarSymbol(key: string, lang: SupportedLanguage): string | null {
  const words = SPATIAL_GRAMMAR[lang === 'zh' ? 'zh-Hans' : lang];
  const id = words && Object.prototype.hasOwnProperty.call(words, key) ? words[key] : null;
  return typeof id === 'string' ? builtInPhraseSymbolUrl(id) : null;
}

/** Per language: a word as the board spells it → ids of the built-in phrases spelled that way. */
const phraseIdsByWord = new Map<string, Map<string, string[]>>();

function idsByWord(lang: SupportedLanguage): Map<string, string[]> {
  const hit = phraseIdsByWord.get(lang);
  if (hit) return hit;
  const table = new Map<string, string[]>();
  const add = (word: string, id: string) => {
    const key = normalizeWord(word, lang);
    if (!key) return;
    const ids = table.get(key);
    if (ids) ids.push(id);
    else table.set(key, [id]);
  };
  for (const p of DEFAULT_PHRASES) {
    add(getPhraseText(p.id, lang, p.text), p.id);
  }
  phraseIdsByWord.set(lang, table);
  return table;
}

/**
 * The symbol for a word that is built-in vocabulary, for tiles that carry a
 * word rather than a phrase id (the prediction bar).
 *
 * One spelling can stand for several built-in phrases with different meanings:
 * "Fall" the verb and the season, or two English words that share one
 * translation. The symbol shows only when every one of them has the SAME
 * approved symbol, so a word never borrows a picture approved for another
 * meaning.
 *
 * Returns `{ url }` for built-in vocabulary (url null: show the word), or null
 * when the word is not built-in vocabulary at all (a typed or learned word).
 */
export function builtInVocabularySymbol(
  word: string,
  lang: SupportedLanguage,
): { url: string | null } | null {
  const key = normalizeWord(word, lang);
  if (!key) return null;
  const spatial = spatialGrammarSymbol(key, lang);
  if (spatial) return { url: spatial };
  const primary = basicVocabularySymbol(key, lang, word);
  if (primary) return { url: primary };
  // Keep decisions apply even when a corrected label no longer names a phrase.
  if (lang !== 'en' && pictureKept(key, lang)) return { url: null };
  const ids = [...(idsByWord(lang).get(key) ?? [])];
  if (lang !== 'en' && (ids.length === 0 || pictureChoice(key, lang))) {
    // Predictions also come from the AAC core list, whose wording can differ
    // from the phrase table; its English source names the built-in phrases.
    // Only for a word the language's own table does not spell: a word that is
    // its own phrase ("marzo", "otoño", "caliente") must not also inherit every
    // phrase of its English source ("Fall" the verb, "March" the walk, "Hot"
    // the weather), which made unambiguous words stay words. A word with a
    // reviewed choice keeps the candidate set that choice was made from.
    const english = englishSourceFor(word, lang);
    if (english) ids.push(...(idsByWord('en').get(normalizeWord(english)) ?? []));
  }
  if (ids.length === 0) {
    // Not built-in vocabulary: an English prediction word may still have a
    // picture; a translated core-list word uses its English source.
    const english = lang === 'en' ? key : normalizeWord(englishSourceFor(word, lang) ?? '');
    const file = english ? WORD_FILES.get(english) : undefined;
    if (file) return { url: symbolUrl(file) };
    // Another language's predicted word ("perros", "puedes"): its picture word
    // table names the English word with the same meaning (constants/pictureWords.ts).
    const source = lang === 'en' ? null : pictureWordSource(key, lang);
    if (source?.startsWith('@')) {
      // "@<phrase id>": straight to a built-in picture, for a meaning whose English
      // word has two pictures ("gusta" is the enjoy sense of "like", not "similar").
      const file = SYMBOL_FILES.get(source.slice(1));
      return file ? { url: symbolUrl(file) } : null;
    }
    const viaSource = source ? builtInVocabularySymbol(source, 'en') : null;
    return viaSource?.url ? viaSource : null;
  }
  if (lang === 'en' && WORD_ONLY.has(key)) return { url: null };
  const files = new Set(ids.map((id) => SYMBOL_FILES.get(id) ?? null));
  const [only] = files;
  if (lang !== 'en' && files.size === 1 && !only && ids.every((id) => id.startsWith(DATE_TILE_PREFIX))) {
    // A day of the month is a text tile ("5th" in Romanian is "cinci"), but the same word is also the number: the
    // language's reviewed table may name the number's picture.
    const source = pictureWordSource(key, lang);
    const viaSource = source && !source.startsWith('@') ? builtInVocabularySymbol(source, 'en') : null;
    if (viaSource?.url) return viaSource;
  }
  if (files.size > 1 && lang !== 'en') {
    // Translations that land on two pictures with the same meaning ("hablar":
    // Talk / Speak): the language's table may name one of THESE phrases.
    const chosen = pictureChoice(key, lang);
    const file = chosen && ids.includes(chosen) ? SYMBOL_FILES.get(chosen) : undefined;
    if (file) return { url: symbolUrl(file) };
    // An approved word link can also select one of these existing candidates.
    const source = pictureWordSource(key, lang);
    const sourceFile = source?.startsWith('@') ? SYMBOL_FILES.get(source.slice(1)) : undefined;
    const sourceUrl = sourceFile ? symbolUrl(sourceFile)
      : source ? builtInVocabularySymbol(source, 'en')?.url : null;
    if (sourceUrl && [...files].some(candidate => candidate && symbolUrl(candidate) === sourceUrl)) {
      return { url: sourceUrl };
    }
  }
  return { url: files.size === 1 && only ? symbolUrl(only) : null };
}

export type VocabularyPictureResolution =
  | { kind: 'symbol'; url: string }
  | { kind: 'loading' | 'error' | 'ambiguous' | 'word-only' | 'unmapped'; url: null };

/** Resolve availability separately from an intentional semantic decision. */
export function resolveVocabularyPicture(word: string, lang: SupportedLanguage): VocabularyPictureResolution {
  const key = normalizeWord(word, lang);
  const spatial = spatialGrammarSymbol(key, lang);
  if (spatial) return { kind: 'symbol', url: spatial };
  const primary = basicVocabularySymbol(key, lang, word);
  if (primary) return { kind: 'symbol', url: primary };
  if (pictureKept(key, lang)) return { kind: 'ambiguous', url: null };
  const vocabulary = builtInVocabularySymbol(word, lang);
  if (vocabulary?.url) return { kind: 'symbol', url: vocabulary.url };
  const status = pictureWordsStatus(lang);
  if (status !== 'ready') return { kind: status === 'error' ? 'error' : 'loading', url: null };
  if (vocabulary) {
    const ids = idsByWord(lang).get(key) ?? [];
    const files = new Set(ids.map(id => SYMBOL_FILES.get(id) ?? null));
    return { kind: files.size > 1 ? 'ambiguous' : 'word-only', url: null };
  }
  return { kind: 'unmapped', url: null };
}
