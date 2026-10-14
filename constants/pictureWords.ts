/**
 * Picture words for languages other than English: a predicted word, exactly as
 * the prediction bar shows it, mapped to the English word whose picture means
 * the same ("perros" -> "dog", "puedes" -> "can").
 *
 * Built offline (constants/generated/pictureWords/<lang>.json): every picture's
 * dictionary words were translated and checked, then every form of the
 * language's predicted words was matched to them and the links reviewed. The
 * lookup stays on the device: nothing is sent anywhere to find a picture.
 *
 * It also settles built-in words whose translations point at two pictures with
 * the same meaning ("hablar" is both Talk and Speak): "choose" names the
 * built-in phrase whose picture to show. Words with two different meanings
 * ("bajo": under / short) are not listed and keep showing the word.
 *
 * A table loads with its language's prediction data, so it never adds to the
 * main bundle. Before it arrives its links are absent (the lookup returns null,
 * or a built-in word's own phrase picture), and subscribers re-render once it is
 * ready. The "keep" decisions are the exception: they ship in a small file that
 * is always loaded (see pictureKept), so a reviewed word never shows the picture
 * of its second meaning, not even in that first moment.
 */

import KEEP from '@/constants/generated/pictureKeep.json';
import { foldPictureWordCase } from '@/lib/wordCase';
export { foldPictureWordCase } from '@/lib/wordCase';

interface Table {
  /** predicted word -> English word whose picture it shares */
  words: Record<string, string>;
  /** built-in word -> the built-in phrase id whose picture to show */
  choose: Record<string, string>;
  /** built-in words that stay words although their own phrase has a picture: a second common meaning in the language
   *  (Arabic ظهر = back or noon, Chinese 空 = empty or sky) that the picture does not show */
  keep?: string[];
}

const EMPTY: Table = { words: {}, choose: {}, keep: [] };
const LANGUAGE_TABLE_LOAD_ERROR = 'Picture-word table load failed';
const PICTURE_WORD_RETRY_DELAY_MS = 1_000;
const MAX_AUTOMATIC_RETRIES = 2;
const TABLE_LANGUAGES = new Set(Object.keys(KEEP));
const normalizedKeeps = new Map(Object.entries(KEEP).map(([lang, words]) =>
  [lang, new Set(words.map(word => foldPictureWordCase(word, lang).normalize('NFC')))]));
export type PictureWordsStatus = 'idle' | 'loading' | 'ready' | 'error';

const tables = new Map<string, Table>();
const aliases = new Map<string, { words: Record<string, string>; choose: Record<string, string> }>();
const inflight = new Map<string, Promise<void>>();
const retryAfter = new Map<string, number>();
const statuses = new Map<string, PictureWordsStatus>();
const failures = new Map<string, number>();
const watchers = new Map<string, number>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let version = 0;

function caseAliases(map: Record<string, string>, lang: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  const conflicts = new Set<string>();
  for (const [word, value] of Object.entries(map)) {
    const key = foldPictureWordCase(word, lang).normalize('NFC');
    if (key === word || Object.prototype.hasOwnProperty.call(map, key) || conflicts.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(result, key) && result[key] !== value) {
      delete result[key]; conflicts.add(key);
    } else result[key] = value;
  }
  return result;
}

function publishStatus(lang: string, status: PictureWordsStatus): void {
  statuses.set(lang, status);
  version += 1;
  listeners.forEach((listener) => listener());
}

/** English and unsupported locales have no translated table to wait for. */
export function pictureWordsStatus(lang: string): PictureWordsStatus {
  if (!TABLE_LANGUAGES.has(lang)) return 'ready';
  return statuses.get(lang) ?? 'idle';
}

function scheduleRetry(lang: string): void {
  if (!watchers.get(lang) || retryTimers.has(lang) || pictureWordsStatus(lang) !== 'error' ||
      (failures.get(lang) ?? 0) > MAX_AUTOMATIC_RETRIES) return;
  const timer = setTimeout(() => {
    retryTimers.delete(lang);
    if (watchers.get(lang)) void loadPictureWords(lang);
  }, Math.max(0, (retryAfter.get(lang) ?? 0) - Date.now()));
  retryTimers.set(lang, timer);
}

/** Keep active tiles recoverable; stop background retries once the last tile leaves. */
export function watchPictureWords(lang: string): () => void {
  const count = watchers.get(lang) ?? 0;
  if (count === 0) failures.delete(lang);
  watchers.set(lang, count + 1);
  void loadPictureWords(lang);
  scheduleRetry(lang);
  return () => {
    const remaining = (watchers.get(lang) ?? 1) - 1;
    if (remaining > 0) watchers.set(lang, remaining);
    else {
      watchers.delete(lang);
      const timer = retryTimers.get(lang);
      if (timer) clearTimeout(timer);
      retryTimers.delete(lang);
    }
  };
}

async function importTable(lang: string): Promise<Table> {
  switch (lang) {
    case 'es': return (await import('@/constants/generated/pictureWords/es.json')).default as Table;
    case 'ru': return (await import('@/constants/generated/pictureWords/ru.json')).default as Table;
    case 'pt': return (await import('@/constants/generated/pictureWords/pt.json')).default as Table;
    case 'fr': return (await import('@/constants/generated/pictureWords/fr.json')).default as Table;
    case 'de': return (await import('@/constants/generated/pictureWords/de.json')).default as Table;
    case 'uk': return (await import('@/constants/generated/pictureWords/uk.json')).default as Table;
    case 'it': return (await import('@/constants/generated/pictureWords/it.json')).default as Table;
    case 'ro': return (await import('@/constants/generated/pictureWords/ro.json')).default as Table;
    case 'pl': return (await import('@/constants/generated/pictureWords/pl.json')).default as Table;
    case 'nl': return (await import('@/constants/generated/pictureWords/nl.json')).default as Table;
    case 'bg': return (await import('@/constants/generated/pictureWords/bg.json')).default as Table;
    case 'tr': return (await import('@/constants/generated/pictureWords/tr.json')).default as Table;
    case 'id': return (await import('@/constants/generated/pictureWords/id.json')).default as Table;
    case 'sw': return (await import('@/constants/generated/pictureWords/sw.json')).default as Table;
    case 'tl': return (await import('@/constants/generated/pictureWords/tl.json')).default as Table;
    case 'he': return (await import('@/constants/generated/pictureWords/he.json')).default as Table;
    case 'ar': return (await import('@/constants/generated/pictureWords/ar.json')).default as Table;
    case 'hi': return (await import('@/constants/generated/pictureWords/hi.json')).default as Table;
    case 'vi': return (await import('@/constants/generated/pictureWords/vi.json')).default as Table;
    case 'ko': return (await import('@/constants/generated/pictureWords/ko.json')).default as Table;
    case 'ja': return (await import('@/constants/generated/pictureWords/ja.json')).default as Table;
    case 'zh-Hans': return (await import('@/constants/generated/pictureWords/zh-Hans.json')).default as Table;
    case 'zh-Hant': return (await import('@/constants/generated/pictureWords/zh-Hant.json')).default as Table;
    case 'zh-HK': return (await import('@/constants/generated/pictureWords/zh-HK.json')).default as Table;
    case 'bn': return (await import('@/constants/generated/pictureWords/bn.json')).default as Table;
    case 'am': return (await import('@/constants/generated/pictureWords/am.json')).default as Table;
    default: return EMPTY;
  }
}

/** Load a language's table once; resolves when it is ready (or when there is none). */
export function loadPictureWords(lang: string): Promise<void> {
  if (tables.has(lang)) return Promise.resolve();
  const pending = inflight.get(lang);
  if (pending) return pending;
  if (Date.now() < (retryAfter.get(lang) ?? 0)) return Promise.resolve();
  const p = importTable(lang)
    .then((table) => {
      retryAfter.delete(lang);
      failures.delete(lang);
      tables.set(lang, table);
      aliases.set(lang, { words: caseAliases(table.words, lang), choose: caseAliases(table.choose, lang) });
      publishStatus(lang, 'ready');
    }, (error: unknown) => {
      const count = (failures.get(lang) ?? 0) + 1;
      failures.set(lang, count);
      retryAfter.set(lang, Date.now() + PICTURE_WORD_RETRY_DELAY_MS * Math.min(count, MAX_AUTOMATIC_RETRIES));
      publishStatus(lang, 'error');
      console.warn(LANGUAGE_TABLE_LOAD_ERROR, lang, error);
      scheduleRetry(lang);
    })
    .finally(() => inflight.delete(lang));
  inflight.set(lang, p);
  publishStatus(lang, 'loading');
  return p;
}

/** A table's own entry for a word. The tables are plain objects, so "constructor" (a Spanish and a Romanian word) or
 *  "toString" would otherwise answer with an inherited function instead of nothing. */
function own(map: Record<string, string> | undefined, word: string): string | null {
  if (!map || !Object.prototype.hasOwnProperty.call(map, word)) return null;
  const value = map[word];
  return typeof value === 'string' ? value : null;
}

/** The English word whose picture this predicted word shares, or null (not loaded, or no picture). */
export function pictureWordSource(word: string, lang: string): string | null {
  return own(tables.get(lang)?.words, word) ?? own(aliases.get(lang)?.words, word);
}

/** True for a built-in word that stays a word although its own phrase has a picture (see Table.keep). Read from the small
 *  always-loaded copy (generated/pictureKeep.json), not from the language's table: the bar renders before the table's import
 *  arrives, and a failed import must not turn a reviewed "stay a word" back into the second meaning's picture. */
export function pictureKept(word: string, lang: string): boolean {
  return normalizedKeeps.get(lang)?.has(foldPictureWordCase(word, lang).normalize('NFC')) ?? false;
}

/** For a built-in word whose phrases show different pictures: the phrase id to follow, or null. */
export function pictureChoice(word: string, lang: string): string | null {
  return own(tables.get(lang)?.choose, word) ?? own(aliases.get(lang)?.choose, word);
}

/** For useSyncExternalStore: changes whenever table availability changes. */
export function subscribePictureWords(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function pictureWordsVersion(): number {
  return version;
}
