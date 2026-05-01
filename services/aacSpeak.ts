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

    if (translating) {
      let translated = translateTextSync(text, inLang, outLang);
      if (translated.trim().length === 1) translated = translated.trim() + '.';
      speak(translated, rate, volume, getTTSCode(outLang), tone);
    } else {
      speak(text, rate, volume, getTTSCode(inLang), tone);
    }
  } catch {
    // Last resort: speak original text with default English voice.
    // A child must NEVER be left without speech output.
    try { speak(text, rate, volume, 'en-US'); } catch { /* truly fatal */ }
  }
}
