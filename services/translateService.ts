import { SupportedLanguage } from '@/engine/i18n';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { getClinicalVocabulary } from '@/constants/clinicalVocabulary';
import { AAC_VOCABULARY } from '@/constants/languageVocabulary';
import { OFFLINE_DICT_1 } from '@/constants/offlineDictionary';

const MAX_CACHE = 500;
const cache = new Map<string, string>();

function trimCache() {
  if (cache.size <= MAX_CACHE) return;
  const first = cache.keys().next().value;
  if (first !== undefined) cache.delete(first);
}

type WordDict = Map<string, string>;
const dictCache = new Map<string, WordDict>();

function getWordDict(fromLang: SupportedLanguage, toLang: SupportedLanguage): WordDict {
  const key = `${fromLang}:${toLang}`;
  if (dictCache.has(key)) return dictCache.get(key)!;

  const dict: WordDict = new Map();

  for (const phrase of DEFAULT_PHRASES) {
    const fromText = getPhraseText(phrase.id, fromLang, phrase.text).toLowerCase();
    const toText = getPhraseText(phrase.id, toLang, phrase.text);
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

  const fromClinical = getClinicalVocabulary(fromLang);
  const toClinical = getClinicalVocabulary(toLang);
  const clinLen = Math.min(fromClinical.length, toClinical.length);
  for (let i = 0; i < clinLen; i++) {
    const fw = fromClinical[i].toLowerCase();
    if (!dict.has(fw)) dict.set(fw, toClinical[i]);
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
      result.push(lookup ?? text.trim().split(/\s+/)[i] ?? words[i]);
      i++;
    }
  }

  return result.join(' ');
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
let lastAiText = '';

export function translateWithAIRefine(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
  onRefined: (translated: string) => void,
): string {
  const instant = translateTextSync(text, fromLang, toLang);

  if (aiTimer) clearTimeout(aiTimer);
  const trimmed = text.trim();
  if (trimmed === lastAiText || trimmed.split(/\s+/).length < 2) return instant;

  aiTimer = setTimeout(async () => {
    lastAiText = trimmed;
    try {
      const { translateAI } = await import('./aiService');
      const LANG_NAMES: Record<string, string> = {
        en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
        ro: 'Romanian', uk: 'Ukrainian', ru: 'Russian', de: 'German',
        ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic',
      };
      const result = await translateAI(trimmed, LANG_NAMES[fromLang] ?? fromLang, LANG_NAMES[toLang] ?? toLang);
      const refined = result.trim().replace(/^["']|["']$/g, '');
      if (refined && refined.toLowerCase() !== trimmed.toLowerCase()) {
        cache.set(`${fromLang}:${toLang}:${trimmed.toLowerCase()}`, refined);
        trimCache();
        onRefined(refined);
      }
    } catch {}
  }, 600);

  return instant;
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
    const LANG_NAMES: Record<string, string> = {
      en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
      ro: 'Romanian', uk: 'Ukrainian', ru: 'Russian', de: 'German',
      ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic',
    };
    const result = await translateAI(text, LANG_NAMES[fromLang] ?? fromLang, LANG_NAMES[toLang] ?? toLang);
    const translated = result.trim().replace(/^["']|["']$/g, '');
    if (translated && translated.toLowerCase() !== text.trim().toLowerCase()) {
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
