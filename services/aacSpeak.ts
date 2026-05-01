import { SupportedLanguage, getTTSCode } from '@/engine/i18n';
import { speak } from './speechService';
import { translateTextSync } from './translateService';
import { useSettingsStore } from '@/store/settingsStore';
import { ToneStyle } from './azureTTS';

export function aacSpeak(text: string, rate: number, volume: number, tone?: ToneStyle): void {
  if (!text.trim()) return;
  const { language, outputLanguage } = useSettingsStore.getState();
  const inLang = language as SupportedLanguage;
  const outLang = outputLanguage as SupportedLanguage;
  const translating = inLang !== outLang;

  if (translating) {
    let translated = translateTextSync(text, inLang, outLang);
    if (translated.trim().length === 1) translated = translated.trim() + '.';
    speak(translated, rate, volume, getTTSCode(outLang), tone);
  } else {
    speak(text, rate, volume, getTTSCode(inLang), tone);
  }
}
