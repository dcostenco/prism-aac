import { SupportedLanguage } from '@/engine/i18n';
import { translateAI } from './aiService';

const MAX_CACHE = 500;
const cache = new Map<string, string>();

function trimCache() {
  if (cache.size <= MAX_CACHE) return;
  const first = cache.keys().next().value;
  if (first !== undefined) cache.delete(first);
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
  ro: 'Romanian', uk: 'Ukrainian', ru: 'Russian', de: 'German',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic',
};

export async function translateText(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): Promise<string> {
  if (fromLang === toLang || !text.trim()) return text;

  const key = `${fromLang}:${toLang}:${text.trim().toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const from = LANG_NAMES[fromLang] ?? fromLang;
    const to = LANG_NAMES[toLang] ?? toLang;
    const result = await translateAI(text, from, to);
    const translated = result.trim().replace(/^["']|["']$/g, '');
    if (translated && translated.toLowerCase() !== text.trim().toLowerCase()) {
      cache.set(key, translated);
      trimCache();
      return translated;
    }
  } catch {
    // Translation unavailable — return original
  }

  return text;
}
