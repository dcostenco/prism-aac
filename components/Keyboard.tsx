'use client';
import { useCallback, useRef } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak, speakWord } from '@/services/speechService';
import { keyFeedback, tapFeedback, deleteFeedback } from '@/services/feedback';
import { LETTERS_ROWS, NUMBERS_ROWS, SYMBOLS_ROWS } from '@/constants/keyboardLayouts';
import { useT } from '@/engine/useT';

const CAPS_LOCK_HOLD_MS = 500;

export default function Keyboard() {
  const { appendChar, addToHistory, autoSpeak, soundEnabled, activeTone } = useMessageStore();
  const { keyboardMode, isUpperCase, capsLock, toggleKeyboardMode, toggleCase, toggleCapsLock } = useUIStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const { t, ttsCode } = useT();

  const rows = keyboardMode === 'letters' ? LETTERS_ROWS : keyboardMode === 'numbers' ? NUMBERS_ROWS : SYMBOLS_ROWS;
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
      if (autoSpeak && soundEnabled) speakWord(currentText.trim(), speechRate, speechVolume);
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
    ? 'text-xl landscape:text-lg sm:text-3xl md:text-5xl'
    : 'text-lg landscape:text-base sm:text-2xl md:text-4xl';
  const utilSize = 'text-base landscape:text-sm sm:text-xl md:text-2xl';
  const wordSize = 'text-sm landscape:text-xs sm:text-base md:text-xl';

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
    <div className="flex-1 flex flex-col gap-1 landscape:gap-0.5 sm:gap-2 md:gap-2.5 p-1 landscape:p-0.5 sm:p-2 md:p-3">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1 landscape:gap-0.5 sm:gap-2 md:gap-2.5 justify-center flex-1">
          {ri === 2 && keyboardMode === 'letters' && (
            <button
              onPointerDown={handleShiftDown}
              onPointerUp={handleShiftUp}
              onPointerLeave={() => { if (shiftHoldTimer.current) { clearTimeout(shiftHoldTimer.current); shiftHoldTimer.current = null; } }}
              aria-label={shiftLabel}
              aria-pressed={capsLock}
              data-testid="shift-key"
              className={`${kc} ${utilSize} px-2 sm:px-3 md:px-4 min-w-[44px] sm:min-w-[56px] md:min-w-[72px] ${shiftStyle}`}
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
            <button onClick={handleBackspace} aria-label="Backspace" className={`${kc} ${utilSize} px-2 sm:px-3 md:px-4 min-w-[44px] sm:min-w-[56px] md:min-w-[72px]`}>⌫</button>
          )}
        </div>
      ))}

      <div className="flex gap-1.5 sm:gap-2 md:gap-2.5 flex-1">
        <button onClick={() => { tapFeedback(); toggleKeyboardMode(); }} aria-label="Switch keyboard mode" className={`${kc} ${wordSize} min-w-[48px] sm:min-w-[64px] md:min-w-[80px] px-2 sm:px-3`}>
          {keyboardMode === 'letters' ? '123' : keyboardMode === 'numbers' ? '#+=' : 'ABC'}
        </button>
        <button onClick={handleSpace} aria-label={t('space')} className={`${kc} ${wordSize} flex-[6]`}>{t('space')}</button>
        <button onClick={() => handleKey('.')} aria-label="." className={`${kc} ${utilSize} min-w-[40px] sm:min-w-[56px] md:min-w-[72px]`}>.</button>
        <button onClick={() => handleKey(',')} aria-label="," className={`${kc} ${utilSize} min-w-[40px] sm:min-w-[56px] md:min-w-[72px]`}>,</button>
        <button onClick={() => handleKey('?')} aria-label="?" className={`${kc} ${utilSize} min-w-[40px] sm:min-w-[56px] md:min-w-[72px]`}>?</button>
        <button
          onClick={handleSpeak}
          aria-label={t('speak')}
          className={`aac-btn aac-speak bg-[#4CAF50] text-white rounded-xl font-bold px-3 sm:px-5 md:px-7 min-w-[80px] sm:min-w-[112px] md:min-w-[140px] ${wordSize} select-none flex items-center justify-center`}
        >
          {t('speak')}
        </button>
      </div>
    </div>
  );
}
