import { SupportedLanguage } from '@/engine/i18n';
import { askAI } from './aiService';

const cache = new Map<string, string>();

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
      return translated;
    }
  } catch {}

  return text;
}
