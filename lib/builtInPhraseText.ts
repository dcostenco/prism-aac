import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import type { SupportedLanguage } from '@/engine/i18n';

/**
 * Whether a spoken text is exactly one of the built-in phrases as the board
 * shows it in a language. Speech telemetry uses it to measure how much cloud
 * speech is built-in phrases (audio that could be shared) versus composed or
 * typed text. Case, surrounding space and closing punctuation are ignored, so
 * the "I." that tap feedback speaks for a one-letter tile still matches "I".
 */
const textsByLanguage = new Map<SupportedLanguage, Set<string>>();

function normalize(text: string): string {
  return text.trim().replace(/[\s.!?…。！？،؟।]+$/u, '').replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export function isBuiltInPhraseText(text: string, lang: SupportedLanguage): boolean {
  let texts = textsByLanguage.get(lang);
  if (!texts) {
    texts = new Set(DEFAULT_PHRASES.map(phrase => normalize(getPhraseText(phrase.id, lang, phrase.text))).filter(Boolean));
    textsByLanguage.set(lang, texts);
  }
  // Empty entries (a phrase deliberately blank in a language) are filtered
  // out above, so blank or punctuation-only speech never matches.
  return texts.has(normalize(text));
}
