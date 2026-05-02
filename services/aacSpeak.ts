/**
 * aacSpeak — unified speech function for the entire PrismAAC application.
 *
 * ALL speech in the app goes through this single function. It handles:
 *   1. Reading current language pair from settings store
 *   2. Translating text if input ≠ output language (offline dictionary)
 *   3. Selecting the correct TTS voice code
 *   4. Speaking via Azure TTS → local fallback chain
 *
 * SAFETY: This is life-critical code. A failure here means a child
 * cannot communicate. Every error path must be handled gracefully.
 */
import { SupportedLanguage, getTTSCode } from '@/engine/i18n';
import { speak } from './speechService';
import { translateTextSync } from './translateService';
import { useSettingsStore } from '@/store/settingsStore';
import { ToneStyle } from './azureTTS';

export function aacSpeak(text: string, rate: number, volume: number, tone?: ToneStyle): void {
  if (!text?.trim()) return;

  try {
    const { language, outputLanguage } = useSettingsStore.getState();
    const inLang = (language || 'en') as SupportedLanguage;
    const outLang = (outputLanguage || language || 'en') as SupportedLanguage;
    const translating = inLang !== outLang;

    // Single-character words (I, Я, я) get spoken as letter names by TTS
    // ("capital I" instead of the pronoun "I"). Appending a period forces
    // the TTS engine to read it as a word, not spell it.
    let toSpeak = text;
    if (translating) {
      toSpeak = translateTextSync(text, inLang, outLang);
    }
    if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
    const ttsCode = translating ? getTTSCode(outLang) : getTTSCode(inLang);
    speak(toSpeak, rate, volume, ttsCode, tone);
  } catch {
    // Last resort: speak original text using the user's configured language,
    // NOT hardcoded en-US (which would mangle non-Latin text).
    const fallbackLang = useSettingsStore.getState().language || 'en';
    try { speak(text, rate, volume, getTTSCode(fallbackLang as SupportedLanguage)); } catch { /* truly fatal */ }
  }
}
