import * as Speech from 'expo-speech';
import { SpeechConfig } from '../../types';

export async function speakWithSystemTTS(text: string, config: SpeechConfig): Promise<void> {
  if (!text.trim()) return;

  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }

  return new Promise<void>((resolve, reject) => {
    Speech.speak(text, {
      language: mapLanguageCode(config.language),
      rate: config.rate,
      pitch: 1.0 + (config.pitch / 100),
      volume: config.volume,
      voice: config.voiceId || undefined,
      onDone: resolve,
      onError: (error) => reject(error),
      onStopped: resolve,
    });
  });
}

export async function stopSystemTTS(): Promise<void> {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }
}

export async function getAvailableVoices(): Promise<Speech.Voice[]> {
  return Speech.getAvailableVoicesAsync();
}

function mapLanguageCode(lang: string): string {
  const map: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    pt: 'pt-BR',
    ro: 'ro-RO',
    uk: 'uk-UA',
    ru: 'ru-RU',
    de: 'de-DE',
    ja: 'ja-JP',
    ko: 'ko-KR',
    zh: 'zh-CN',
    ar: 'ar-SA',
  };
  return map[lang] ?? lang;
}
