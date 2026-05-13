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
import { translateTextSync, looksLikeTargetLang } from './translateService';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { ToneStyle } from './azureTTS';
import { emitTtsHighlight, estimateSpeechDurationMs } from './ttsHighlightBus';

// Speak a phrase with optional explicit tone override. When `tone` is omitted,
// reads `toneMode` + `activeTone` from messageStore: in 'auto' mode the
// adaptive engine picks the tone from the text; in 'manual' mode the user's
// last picked tone is forced for every utterance.
export function aacSpeak(text: string, rate: number, volume: number, tone?: ToneStyle, interrupt = false, spokenLang?: SupportedLanguage): void {
  if (!text?.trim()) return;

  try {
    const { language, outputLanguage } = useSettingsStore.getState();
    const inLang = (language || 'en') as SupportedLanguage;
    const outLang = (outputLanguage || language || 'en') as SupportedLanguage;
    const translating = inLang !== outLang;

    let toSpeak = text;
    let ttsCode: string;

    if (spokenLang) {
      // Caller already knows the language of the text (e.g. MessageBar
      // passing AI-translated Romanian). Skip all translation/script
      // detection — use the specified language directly.
      if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
      ttsCode = getTTSCode(spokenLang);
    } else if (translating) {
      let translationSucceeded = false;
      // If caller already passed text in the target language's script
      // (MessageBar's translationSpeakTimer fires aacSpeak with the
      // AI-refined Russian phrase), skip re-translating. Without this,
      // translateTextSync runs the en→ru offline dict on Cyrillic input,
      // returns the input unchanged → translationSucceeded=false →
      // selects the English voice → Russian spoken with English accent
      // (May 2026 user report).
      //
      // Gate: text must pass the target's script test AND fail the
      // source's. That distinguishes "already translated Cyrillic input
      // in an en→ru pair" (passes ru, fails en) from "ambiguous Latin
      // input in an en→ro pair" (passes both — needs dict translation).
      const alreadyInTargetScript =
        looksLikeTargetLang(text, outLang) && !looksLikeTargetLang(text, inLang);
      if (alreadyInTargetScript) {
        toSpeak = text;
        translationSucceeded = true;
      } else {
        const translated = translateTextSync(text, inLang, outLang);
        translationSucceeded = translated.toLowerCase() !== text.trim().toLowerCase();
        toSpeak = translated;
      }
      if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
      ttsCode = (translationSucceeded) ? getTTSCode(outLang) : getTTSCode(inLang);
    } else {
      if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
      ttsCode = getTTSCode(inLang);
    }
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
    // Slow translated speech by 40% — the child is hearing a foreign
    // language and needs time to process. Does not affect source-language speech.
    // At default rate 0.5: effective=0.3 → SSML 0.60 (deliberate, clear pace).
    const effectiveRate = (translating || spokenLang) ? rate * 0.6 : rate;
    speak(toSpeak, effectiveRate, volume, ttsCode, effectiveTone, interrupt);
  } catch {
    // Last resort: speak original text using the user's configured language,
    // NOT hardcoded en-US (which would mangle non-Latin text).
    const fallbackLang = useSettingsStore.getState().language || 'en';
    try { speak(text, rate, volume, getTTSCode(fallbackLang as SupportedLanguage)); } catch { /* truly fatal */ }
  }
}
