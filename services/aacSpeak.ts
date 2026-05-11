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
import { useMessageStore } from '@/store/messageStore';
import { ToneStyle } from './azureTTS';
import { emitTtsHighlight, estimateSpeechDurationMs } from './ttsHighlightBus';

// Speak a phrase with optional explicit tone override. When `tone` is omitted,
// reads `toneMode` + `activeTone` from messageStore: in 'auto' mode the
// adaptive engine picks the tone from the text; in 'manual' mode the user's
// last picked tone is forced for every utterance.
export function aacSpeak(text: string, rate: number, volume: number, tone?: ToneStyle, interrupt = false, overrideLang?: string): void {
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
    let translationSucceeded = false;
    if (translating && !overrideLang) {
      // Only re-translate if text isn't already in the target language.
      // When MessageBar passes pre-translated text + overrideLang, skip re-translation.
      const translated = translateTextSync(text, inLang, outLang);
      translationSucceeded = translated.toLowerCase() !== text.trim().toLowerCase();
      toSpeak = translated;
    }
    if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
    // overrideLang: caller knows the text is already in target language
    // (e.g. MessageBar passing AI-refined Russian text). Use that lang for TTS.
    const ttsCode = overrideLang
      ? getTTSCode(overrideLang as SupportedLanguage)
      : (translating && translationSucceeded)
        ? getTTSCode(outLang)
        : getTTSCode(inLang);
    // Emit a highlight-start event so the renderer (MessageBar) can
    // light up each word as it's spoken. The duration is estimated
    // — see services/ttsHighlightBus.ts for the heuristic. We emit
    // the SOURCE-language text, not the translated string, because
    // the renderer shows the user-typed text and that's what should
    // be highlighted (the translated bar is shorter and doesn't need
    // word-by-word follow-along).
    const { speechRate } = useSettingsStore.getState();
    const highlightText = translating ? text : toSpeak;
    if (highlightText.trim()) {
      emitTtsHighlight({
        type: 'tts-highlight-start',
        text: highlightText,
        estimatedDurationMs: estimateSpeechDurationMs(highlightText, speechRate),
        timestamp: Date.now(),
      });
    }
    // Tone resolution:
    //   - explicit tone arg wins (e.g. emergency UI passes 'serious')
    //   - else read messageStore: 'auto' → speak() runs autoSwitchTone
    //     'manual' → forward the user-picked activeTone
    const ms = useMessageStore.getState();
    const effectiveTone: ToneStyle | 'auto' = tone
      ?? (ms.toneMode === 'auto' ? 'auto' : ms.activeTone);
    speak(toSpeak, rate, volume, ttsCode, effectiveTone, interrupt);
  } catch {
    // Last resort: speak original text using the user's configured language,
    // NOT hardcoded en-US (which would mangle non-Latin text).
    const fallbackLang = useSettingsStore.getState().language || 'en';
    try { speak(text, rate, volume, getTTSCode(fallbackLang as SupportedLanguage)); } catch { /* truly fatal */ }
  }
}
