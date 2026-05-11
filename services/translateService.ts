import { SupportedLanguage } from '@/engine/i18n';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { getClinicalDict } from '@/constants/clinicalVocabulary';
import { applyGrammarRules } from '@/constants/languageRules';
import { AAC_VOCABULARY } from '@/constants/languageVocabulary';
import { OFFLINE_DICT_1 } from '@/constants/offlineDictionary';

// Display names sent to translateAI as system-prompt context. Includes
// regional Chinese variants so the AI translator picks the correct form.
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
  ro: 'Romanian', uk: 'Ukrainian', ru: 'Russian', de: 'German',
  ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese (Simplified, Mandarin)',
  'zh-Hans': 'Chinese (Simplified, Mandarin)',
  'zh-Hant': 'Chinese (Traditional, Taiwanese Mandarin)',
  'zh-HK': 'Cantonese (Traditional script, Hong Kong)',
  ar: 'Arabic',
  // Latin-script European langs that need an explicit name so the
  // translator's system prompt says "translate to Italian" instead of
  // "translate to it" (May 2026: RU→IT regression where the AI saw
  // "to it" and produced English-Italian-Russian mush).
  it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
  cs: 'Czech', el: 'Greek', hu: 'Hungarian', he: 'Hebrew',
  hi: 'Hindi', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian',
  tl: 'Tagalog',
};

const MAX_CACHE = 500;
const cache = new Map<string, string>();

function trimCache() {
  while (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
    else break;
  }
}

type WordDict = Map<string, string>;
const dictCache = new Map<string, WordDict>();
const MAX_DICT_CACHE = 20;

function getWordDict(fromLang: SupportedLanguage, toLang: SupportedLanguage): WordDict {
  const key = `${fromLang}:${toLang}`;
  if (dictCache.has(key)) return dictCache.get(key)!;

  const dict: WordDict = new Map();

  for (const phrase of DEFAULT_PHRASES) {
    const fromRaw = getPhraseText(phrase.id, fromLang, phrase.text);
    const toRaw = getPhraseText(phrase.id, toLang, phrase.text);
    // Skip when getPhraseText returned the English fallback for a
    // non-English target — that means the target language has no real
    // translation for this phrase and we'd otherwise pollute the dict
    // with English words (May 2026 RU→IT bug: "хочу" → "Want" because
    // Italian entries were missing in T and "Want" was the fallback).
    if (toLang !== 'en' && toRaw === phrase.text) continue;
    if (fromLang !== 'en' && fromRaw === phrase.text) continue;
    const fromText = fromRaw.toLowerCase();
    const toText = toRaw;
    dict.set(fromText, toText);

    const fromWords = fromText.split(/\s+/);
    const toWords = toText.split(/\s+/);
    if (fromWords.length === 1 && toWords.length === 1) {
      dict.set(fromWords[0], toWords[0]);
    }
  }

  const fromVocab = AAC_VOCABULARY[fromLang] ?? [];
  const toVocab = AAC_VOCABULARY[toLang] ?? [];
  const minLen = Math.min(fromVocab.length, toVocab.length);
  for (let i = 0; i < minLen; i++) {
    const fw = fromVocab[i].toLowerCase();
    if (!dict.has(fw)) dict.set(fw, toVocab[i]);
  }

  const fromDict1 = OFFLINE_DICT_1[fromLang] ?? [];
  const toDict1 = OFFLINE_DICT_1[toLang] ?? [];
  const dict1Len = Math.min(fromDict1.length, toDict1.length);
  for (let i = 0; i < dict1Len; i++) {
    const fw = fromDict1[i].toLowerCase();
    if (!dict.has(fw)) dict.set(fw, toDict1[i]);
  }

  // Dictionary-based clinical vocab lookup — no positional misalignment.
  // getClinicalDict uses English as the pivot: each VocabEntry maps one
  // concept across all languages, so ro["vreau să"] → ru["хочу"] is exact.
  const clinicalDict = getClinicalDict(fromLang, toLang);
  for (const [from, to] of clinicalDict) {
    if (!dict.has(from)) dict.set(from, to);
  }

  if (dictCache.size >= MAX_DICT_CACHE) {
    const oldest = dictCache.keys().next().value;
    if (oldest !== undefined) dictCache.delete(oldest);
  }
  dictCache.set(key, dict);
  return dict;
}

function offlineTranslate(text: string, fromLang: SupportedLanguage, toLang: SupportedLanguage): string {
  const dict = getWordDict(fromLang, toLang);
  const lower = text.trim().toLowerCase();

  const exact = dict.get(lower);
  if (exact) return exact;

  const words = lower.split(/\s+/);
  const result: string[] = [];
  let i = 0;

  while (i < words.length) {
    let matched = false;
    for (let len = Math.min(words.length - i, 5); len > 1; len--) {
      const phrase = words.slice(i, i + len).join(' ');
      const lookup = dict.get(phrase);
      if (lookup) {
        result.push(lookup);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const lookup = dict.get(words[i]);
      // Skip empty-string translations (e.g. ru/uk infinitive "to" → '')
      const token = lookup ?? text.trim().split(/\s+/)[i] ?? words[i];
      if (token !== '') result.push(token);
      i++;
    }
  }

  const joined = result.join(' ').trim();

  return applyGrammarRules(joined, toLang);
}

export function translateTextSync(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): string {
  if (fromLang === toLang || !text.trim()) return text;

  const cacheKey = `${fromLang}:${toLang}:${text.trim().toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const result = offlineTranslate(text, fromLang, toLang);
  if (result.toLowerCase() !== text.trim().toLowerCase()) {
    cache.set(cacheKey, result);
    trimCache();
  }
  return result;
}

let aiTimer: ReturnType<typeof setTimeout> | null = null;
let aiAbortController: AbortController | null = null;
let lastAiText = '';

/**
 * Script families per language. Used to sanity-check AI translation output:
 * if the model returns text whose dominant script doesn't match the target
 * language's expected script, we reject the "translation". This catches the
 * frequent local-LLM regression where prism-coder ignores the translate
 * system prompt and replies as the AAC chat assistant in the source
 * language (e.g. translating "Я иду" to English came back as the Russian
 * greeting "Я здесь, чтобы помочь…", which is clearly not English).
 */
const SCRIPT_FOR_LANG: Record<string, RegExp> = {
  // Latin-script targets — reject Cyrillic/CJK/Hebrew/Arabic responses.
  en: /\p{Script=Latin}/u, es: /\p{Script=Latin}/u, fr: /\p{Script=Latin}/u,
  pt: /\p{Script=Latin}/u, ro: /\p{Script=Latin}/u, de: /\p{Script=Latin}/u,
  it: /\p{Script=Latin}/u, nl: /\p{Script=Latin}/u, pl: /\p{Script=Latin}/u,
  tr: /\p{Script=Latin}/u, sv: /\p{Script=Latin}/u, no: /\p{Script=Latin}/u,
  da: /\p{Script=Latin}/u, fi: /\p{Script=Latin}/u, cs: /\p{Script=Latin}/u,
  hu: /\p{Script=Latin}/u, vi: /\p{Script=Latin}/u, id: /\p{Script=Latin}/u,
  tl: /\p{Script=Latin}/u,
  // Cyrillic
  ru: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u,
  // CJK
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  ko: /\p{Script=Hangul}/u,
  zh: /\p{Script=Han}/u, 'zh-Hans': /\p{Script=Han}/u,
  'zh-Hant': /\p{Script=Han}/u, 'zh-HK': /\p{Script=Han}/u,
  // Other scripts
  ar: /\p{Script=Arabic}/u, he: /\p{Script=Hebrew}/u,
  el: /\p{Script=Greek}/u,
  hi: /\p{Script=Devanagari}/u,
  th: /\p{Script=Thai}/u,
};

/**
 * Returns true if the response looks like a plausible translation in
 * targetLang (i.e. its dominant script matches the target). Returns true
 * for short responses where script detection is unreliable.
 * Exported so MessageBar can gate the instant-offline display — prevents
 * showing garbage like "Я хочу К быть - best player" when the offline
 * dict only translates some words (script mismatch on the untranslated ones).
 */
export function looksLikeTargetLang(response: string, targetLang: string): boolean {
  const trimmed = response.trim();
  if (trimmed.length < 3) return true;
  const expected = SCRIPT_FOR_LANG[targetLang];
  if (!expected) return true; // unknown target, can't verify, accept
  // Count letters by script. If at least 60% of letter chars match the
  // expected script, accept; otherwise reject.
  const letters = trimmed.match(/\p{L}/gu) || [];
  if (letters.length === 0) return true;
  const matching = letters.filter((c) => expected.test(c)).length;
  return matching / letters.length >= 0.6;
}

export function translateWithAIRefine(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
  onRefined: (translated: string) => void,
): string {
  const instant = translateTextSync(text, fromLang, toLang);

  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  if (aiAbortController) { aiAbortController.abort(); aiAbortController = null; }
  const trimmed = text.trim();
  if (trimmed === lastAiText || trimmed.split(/\s+/).length < 2) return instant;

  aiAbortController = new AbortController();
  const currentSignal = aiAbortController.signal;
  aiTimer = setTimeout(async () => {
    lastAiText = trimmed;
    try {
      if (currentSignal.aborted) return;
      const { translateAI } = await import('./aiService');
      const resultRace = await Promise.race([
        translateAI(trimmed, LANG_NAMES[fromLang] ?? fromLang, LANG_NAMES[toLang] ?? toLang),
        new Promise<never>((_, reject) => {
          const t = setTimeout(() => reject(new Error('AI translate timeout')), 15000);
          currentSignal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
        }),
      ]);
      if (currentSignal.aborted) return;
      const result = resultRace;
      const refined = result.trim().replace(/^["']|["']$/g, '');
      if (
        refined &&
        refined.toLowerCase() !== trimmed.toLowerCase() &&
        looksLikeTargetLang(refined, toLang)
      ) {
        cache.set(`${fromLang}:${toLang}:${trimmed.toLowerCase()}`, refined);
        trimCache();
        onRefined(refined);
      } else if (refined && !looksLikeTargetLang(refined, toLang)) {
        // The model returned text in the wrong script (e.g. AAC chat
        // assistant reply in source language). Stay on the offline
        // result rather than confuse the user with garbage.
        console.warn(
          `[translate] AI returned ${toLang} translation in wrong script; rejecting:`,
          refined.slice(0, 60),
        );
      }
    } catch (e) {
      // Was silently swallowing — leaving users stuck on the partial offline
      // translate result (e.g. "Привет, How are you?" instead of "Hi, how
      // are you?"). Log so failures are visible in DevTools.
      console.warn('[translate] AI refine failed; staying on offline result:', e instanceof Error ? e.message : e);
    }
  }, 200);

  return instant;
}

export function clearTranslationCache(): void {
  cache.clear();
  dictCache.clear();
}

export async function translateText(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): Promise<string> {
  if (fromLang === toLang || !text.trim()) return text;

  const cacheKey = `${fromLang}:${toLang}:${text.trim().toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const offline = offlineTranslate(text, fromLang, toLang);

  try {
    const { translateAI } = await import('./aiService');
    const result = await translateAI(text, LANG_NAMES[fromLang] ?? fromLang, LANG_NAMES[toLang] ?? toLang);
    const translated = result.trim().replace(/^["']|["']$/g, '');
    if (
      translated &&
      translated.toLowerCase() !== text.trim().toLowerCase() &&
      looksLikeTargetLang(translated, toLang)
    ) {
      cache.set(cacheKey, translated);
      trimCache();
      return translated;
    }
  } catch {}

  if (offline.toLowerCase() !== text.trim().toLowerCase()) {
    cache.set(cacheKey, offline);
    trimCache();
  }
  return offline;
}
