import { SupportedLanguage } from '@/engine/i18n';
import { askAI } from './aiService';

const MAX_CACHE = 500;
const cache = new Map<string, string>();

function trimCache() {
  if (cache.size <= MAX_CACHE) return;
  const first = cache.keys().next().value;
  if (first !== undefined) cache.delete(first);
}

export async function translateText(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): Promise<string> {
  if (fromLang === toLang || !text.trim()) return text;

  const key = `${fromLang}:${toLang}:${text.trim().toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    let result = '';
    await askAI(
      `Translate this from ${fromLang} to ${toLang}. Return ONLY the translation, no explanations: "${text}"`,
      'translator',
      (delta) => { result += delta; },
    );
    const translated = result.trim().replace(/^["']|["']$/g, '');
    if (translated) {
      cache.set(key, translated);
      trimCache();
      return translated;
    }
  } catch {
    // Translation failed — return original text, spoken in output voice
  }

  return text;
}
