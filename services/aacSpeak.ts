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
  const translated = inLang !== outLang ? translateTextSync(text, inLang, outLang) : text;
  if (translated.trim().length <= 1) return;
  speak(translated, rate, volume, getTTSCode(outLang), tone);
}
