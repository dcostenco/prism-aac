import { SupportedLanguage } from '@/engine/i18n';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { getClinicalVocabulary } from '@/constants/clinicalVocabulary';
import { AAC_VOCABULARY } from '@/constants/languageVocabulary';

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

  const words = text.trim().split(/\s+/);
  const translated = words.map((w) => {
    const lookup = dict.get(w.toLowerCase());
    return lookup ?? w;
  });

  return translated.join(' ');
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
  if (result !== text) {
    cache.set(cacheKey, result);
    trimCache();
  }
  return result;
}

export async function translateText(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): Promise<string> {
  if (fromLang === toLang || !text.trim()) return text;

  const offline = translateTextSync(text, fromLang, toLang);
  if (offline !== text) return offline;

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
      cache.set(`${fromLang}:${toLang}:${text.trim().toLowerCase()}`, translated);
      trimCache();
      return translated;
    }
  } catch {}

  return offline !== text ? offline : text;
}
