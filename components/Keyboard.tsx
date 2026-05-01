'use client';
import { useCallback, useRef } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak, speakWord } from '@/services/speechService';
import { keyFeedback, tapFeedback, deleteFeedback } from '@/services/feedback';
import { getLetterRows, NUMBERS_ROWS, SYMBOLS_ROWS } from '@/constants/keyboardLayouts';
import { useT } from '@/engine/useT';

const CAPS_LOCK_HOLD_MS = 500;

export default function Keyboard() {
  const { appendChar, addToHistory, autoSpeak, soundEnabled, activeTone } = useMessageStore();
  const { keyboardMode, isUpperCase, capsLock, toggleKeyboardMode, toggleCase, toggleCapsLock } = useUIStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const { t, ttsCode } = useT();
  const letterRows = getLetterRows(language);

  const rows = keyboardMode === 'letters' ? letterRows : keyboardMode === 'numbers' ? NUMBERS_ROWS : SYMBOLS_ROWS;
  const showUpper = isUpperCase || capsLock;

  const handleKey = useCallback((key: string) => {
    keyFeedback();
    const char = keyboardMode === 'letters' ? (showUpper ? key : key.toLowerCase()) : key;
    appendChar(char);
    if (isUpperCase && !capsLock && keyboardMode === 'letters') toggleCase();
  }, [appendChar, isUpperCase, capsLock, keyboardMode, toggleCase, showUpper]);

  // Shift: tap = one-shot upper, long-press (≥500ms) = caps-lock toggle.
  const shiftHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shiftLongPressed = useRef(false);

  const handleShiftDown = useCallback(() => {
    shiftLongPressed.current = false;
    if (shiftHoldTimer.current) clearTimeout(shiftHoldTimer.current);
    shiftHoldTimer.current = setTimeout(() => {
      shiftLongPressed.current = true;
      tapFeedback();
      toggleCapsLock();
    }, CAPS_LOCK_HOLD_MS);
  }, [toggleCapsLock]);

  const handleShiftUp = useCallback(() => {
    if (shiftHoldTimer.current) {
      clearTimeout(shiftHoldTimer.current);
      shiftHoldTimer.current = null;
    }
    if (!shiftLongPressed.current) {
      tapFeedback();
      toggleCase();
    }
  }, [toggleCase]);

  const handleSpace = useCallback(() => {
    keyFeedback();
    const currentText = useMessageStore.getState().text;
    const words = currentText.trim().split(/\s+/).filter(Boolean);
    const lastWord = words.length > 0 ? words[words.length - 1] : '';
    if (lastWord) {
      const prevWord = words.length > 1 ? words[words.length - 2] : undefined;
      learnWord(lastWord.toLowerCase(), prevWord?.toLowerCase());
      // Auto-speak the cumulative phrase (not just the last word) so the
      // user hears "we can help" instead of fragmented "we" → "can" → "help".
      // speakLocal() cancels any in-flight utterance, so each space
      // restarts speech with the latest accumulated text.
      if (autoSpeak && soundEnabled) speakWord(currentText.trim(), speechRate, speechVolume, ttsCode);
    }
    appendChar(' ');
  }, [learnWord, autoSpeak, soundEnabled, speechRate, speechVolume, appendChar]);

  const handleSpeak = useCallback(() => {
    tapFeedback();
    const currentText = useMessageStore.getState().text.trim();
    if (!currentText || !soundEnabled) return;
    addToHistory(currentText);
    speak(currentText, speechRate, speechVolume, ttsCode, activeTone);
  }, [soundEnabled, speechRate, speechVolume, addToHistory, ttsCode, activeTone]);

  const handleBackspace = useCallback(() => {
    deleteFeedback();
    useMessageStore.getState().deleteLastChar();
  }, []);

  // Big keys — full width, fill remaining viewport. Letter glyphs are
  // intentionally large (the smallest viewport this app targets is iPhone
  // 6.1" portrait, where each row only fits 10 keys, so we have headroom).
  // Caps-lock pushes letter size up another tier as a visual confirmation
  // that the lock is engaged — important for users with reduced visual
  // acuity or attention.
  const kc =
    'aac-key surface-key text-primary rounded-xl font-bold select-none flex items-center justify-center';
  const letterSize = capsLock
    ? 'text-[clamp(1.5rem,4vw,3.5rem)]'
    : 'text-[clamp(1.25rem,3.5vw,2.75rem)]';
  const utilSize = 'text-[clamp(1rem,2.2vw,1.75rem)]';
  const wordSize = 'text-[clamp(0.875rem,1.8vw,1.5rem)]';

  // Caps-lock visual state on the shift key: green = caps-lock, yellow =
  // one-shot shift, neutral = lowercase. Distinct colors so the user can
  // distinguish "next letter only" from "every letter from now on".
  const shiftStyle = capsLock
    ? 'bg-[#4CAF50] text-white'
    : isUpperCase
      ? 'bg-[#FFD700] text-black'
      : '';
  const shiftLabel = capsLock ? 'Caps lock on' : isUpperCase ? 'Shift on' : 'Shift off';
  const shiftGlyph = capsLock ? 'A' : isUpperCase ? '⇧' : '⇪';

  return (
    <div className="flex flex-col gap-[clamp(0.2rem,0.6svh,0.5rem)] p-[clamp(0.25rem,0.5vw,0.75rem)] mt-auto">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[clamp(0.25rem,0.5vw,0.625rem)] justify-center h-[clamp(2.5rem,8vw,3.75rem)]">
          {ri === 2 && keyboardMode === 'letters' && (
            <button
              onPointerDown={handleShiftDown}
              onPointerUp={handleShiftUp}
              onPointerLeave={() => { if (shiftHoldTimer.current) { clearTimeout(shiftHoldTimer.current); shiftHoldTimer.current = null; } }}
              aria-label={shiftLabel}
              aria-pressed={capsLock}
              data-testid="shift-key"
              className={`${kc} ${utilSize} px-[clamp(0.5rem,1vw,1rem)] min-w-[clamp(2.5rem,6vw,4.5rem)] ${shiftStyle}`}
            >
              {shiftGlyph}
            </button>
          )}
          {row.map((key) => (
            <button key={key} onClick={() => handleKey(key)} aria-label={key} className={`${kc} ${letterSize} flex-1`}>
              {keyboardMode === 'letters' ? (showUpper ? key : key.toLowerCase()) : key}
            </button>
          ))}
          {ri === 2 && keyboardMode === 'letters' && (
            <button onClick={handleBackspace} aria-label="Backspace" className={`${kc} ${utilSize} px-[clamp(0.5rem,1vw,1rem)] min-w-[clamp(2.5rem,6vw,4.5rem)]`}>⌫</button>
          )}
        </div>
      ))}

      <div className="flex gap-[clamp(0.25rem,0.5vw,0.625rem)] h-[clamp(2.5rem,8vw,3.75rem)]">
        <button onClick={() => { tapFeedback(); toggleKeyboardMode(); }} aria-label="Switch keyboard mode" className={`${kc} ${wordSize} min-w-[clamp(3rem,7vw,5rem)] px-[clamp(0.5rem,0.8vw,0.75rem)]`}>
          {keyboardMode === 'letters' ? '123' : keyboardMode === 'numbers' ? '#+=' : 'ABC'}
        </button>
        <button onClick={handleSpace} aria-label={t('space')} className={`${kc} ${wordSize} flex-[6]`}>{t('space')}</button>
        <button onClick={() => handleKey('.')} aria-label="." className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)]`}>.</button>
        <button onClick={() => handleKey(',')} aria-label="," className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)]`}>,</button>
        <button onClick={() => handleKey('?')} aria-label="?" className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)]`}>?</button>
        <button
          onClick={handleSpeak}
          aria-label={t('speak')}
          className={`aac-btn aac-speak bg-[#4CAF50] text-white rounded-xl font-bold px-[clamp(0.75rem,2vw,1.75rem)] min-w-[clamp(5rem,12vw,8.75rem)] ${wordSize} select-none flex items-center justify-center`}
        >
          {t('speak')}
        </button>
      </div>
    </div>
  );
}
