import { aacSpeak } from '@/services/aacSpeak';
import type { SpeakOptions } from '@/services/speechService';
import { translateForSpeech } from '@/services/translateService';
import { useMessageStore, getLatestTranslated, setLatestTranslated } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { SupportedLanguage } from '@/engine/i18n';

/**
 * Speak a composed message as the keyboard's Speak key does: record it in
 * history and, when the output language differs, force the translation refine
 * before speaking. Pressing Speak is the explicit "I am done" the
 * phrase-boundary translation waits for. Resolves when speech has ended.
 */
export async function speakComposedMessage(text: string, options?: SpeakOptions): Promise<void> {
  const { addToHistory, activeTone } = useMessageStore.getState();
  const { speechRate, speechVolume, language, outputLanguage } = useSettingsStore.getState();
  // Options are passed only when given, so the Speak key's calls are unchanged.
  const say = (spoken: string, spokenLang?: SupportedLanguage): Promise<void> => {
    if (options) return aacSpeak(spoken, speechRate, speechVolume, activeTone, true, spokenLang, options);
    if (spokenLang) return aacSpeak(spoken, speechRate, speechVolume, activeTone, true, spokenLang);
    return aacSpeak(spoken, speechRate, speechVolume, activeTone, true);
  };
  addToHistory(text);
  if (language !== outputLanguage) {
    const best = await translateForSpeech(
      text,
      language as SupportedLanguage,
      outputLanguage as SupportedLanguage,
      setLatestTranslated,
    );
    const spoken = best || getLatestTranslated();
    if (spoken) return say(spoken, outputLanguage as SupportedLanguage);
  }
  return say(text);
}
