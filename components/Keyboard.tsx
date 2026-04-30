'use client';
import { useCallback } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak, speakWord } from '@/services/speechService';
import { keyFeedback, tapFeedback, deleteFeedback } from '@/services/feedback';
import { LETTERS_ROWS, NUMBERS_ROWS, SYMBOLS_ROWS } from '@/constants/keyboardLayouts';
import { useT } from '@/engine/useT';

export default function Keyboard() {
  const { appendChar, addToHistory, autoSpeak, soundEnabled, activeTone } = useMessageStore();
  const { keyboardMode, isUpperCase, toggleKeyboardMode, toggleCase } = useUIStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const { t, ttsCode } = useT();

  const rows = keyboardMode === 'letters' ? LETTERS_ROWS : keyboardMode === 'numbers' ? NUMBERS_ROWS : SYMBOLS_ROWS;

  const handleKey = useCallback((key: string) => {
    keyFeedback();
    const char = keyboardMode === 'letters' ? (isUpperCase ? key : key.toLowerCase()) : key;
    appendChar(char);
    if (isUpperCase && keyboardMode === 'letters') toggleCase();
  }, [appendChar, isUpperCase, keyboardMode, toggleCase]);

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

  // Big keys — full width, fill remaining viewport. Tailwind responsive scales
  // min height so iPad gets noticeably taller keys than phone landscape.
  const kc =
    'aac-key surface-key text-primary rounded-xl font-semibold select-none flex items-center justify-center text-xl md:text-2xl';

  return (
    <div className="flex-1 flex flex-col gap-2 md:gap-2.5 p-2 md:p-3">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2 md:gap-2.5 justify-center flex-1">
          {ri === 2 && keyboardMode === 'letters' && (
            <button onClick={() => { tapFeedback(); toggleCase(); }} aria-label={isUpperCase ? 'Shift on' : 'Shift off'} className={`${kc} px-3 md:px-4 min-w-[56px] md:min-w-[72px] ${isUpperCase ? 'bg-[#4CAF50] text-white' : ''}`}>
              {isUpperCase ? '⇧' : '⇪'}
            </button>
          )}
          {row.map((key) => (
            <button key={key} onClick={() => handleKey(key)} aria-label={key} className={`${kc} flex-1`}>
              {keyboardMode === 'letters' ? (isUpperCase ? key : key.toLowerCase()) : key}
            </button>
          ))}
          {ri === 2 && keyboardMode === 'letters' && (
            <button onClick={handleBackspace} aria-label="Backspace" className={`${kc} px-3 md:px-4 min-w-[56px] md:min-w-[72px]`}>⌫</button>
          )}
        </div>
      ))}

      <div className="flex gap-2 md:gap-2.5 flex-1">
        <button onClick={() => { tapFeedback(); toggleKeyboardMode(); }} aria-label="Switch keyboard mode" className={`${kc} min-w-[64px] md:min-w-[80px] px-3 text-base md:text-lg`}>
          {keyboardMode === 'letters' ? '123' : keyboardMode === 'numbers' ? '#+=' : 'ABC'}
        </button>
        <button onClick={handleSpace} aria-label={t('space')} className={`${kc} flex-[6] text-base md:text-lg`}>{t('space')}</button>
        <button onClick={() => handleKey('.')} aria-label="." className={`${kc} min-w-[56px] md:min-w-[72px]`}>.</button>
        <button onClick={() => handleKey(',')} aria-label="," className={`${kc} min-w-[56px] md:min-w-[72px]`}>,</button>
        <button onClick={() => handleKey('?')} aria-label="?" className={`${kc} min-w-[56px] md:min-w-[72px]`}>?</button>
        <button
          onClick={handleSpeak}
          aria-label={t('speak')}
          className="aac-btn aac-speak bg-[#4CAF50] text-white rounded-xl font-bold px-5 md:px-7 min-w-[112px] md:min-w-[140px] text-base md:text-lg select-none flex items-center justify-center"
        >
          {t('speak')}
        </button>
      </div>
    </div>
  );
}
