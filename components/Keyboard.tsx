'use client';
import { useCallback } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak, speakWord } from '@/services/speechService';
import { keyFeedback, tapFeedback, deleteFeedback } from '@/services/feedback';
import { LETTERS_ROWS, NUMBERS_ROWS, SYMBOLS_ROWS } from '@/constants/keyboardLayouts';

export default function Keyboard() {
  const { appendChar, addToHistory, autoSpeak, soundEnabled } = useMessageStore();
  const { keyboardMode, isUpperCase, toggleKeyboardMode, toggleCase } = useUIStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume } = useSettingsStore();

  const rows = keyboardMode === 'letters' ? LETTERS_ROWS : keyboardMode === 'numbers' ? NUMBERS_ROWS : SYMBOLS_ROWS;

  const handleKey = useCallback((key: string) => {
    keyFeedback();
    const char = keyboardMode === 'letters' ? (isUpperCase ? key : key.toLowerCase()) : key;
    appendChar(char);
  }, [appendChar, isUpperCase, keyboardMode]);

  const handleSpace = useCallback(() => {
    keyFeedback();
    const currentText = useMessageStore.getState().text;
    const words = currentText.trim().split(/\s+/).filter(Boolean);
    const lastWord = words.length > 0 ? words[words.length - 1] : '';
    if (lastWord) {
      const prevWord = words.length > 1 ? words[words.length - 2] : undefined;
      learnWord(lastWord.toLowerCase(), prevWord?.toLowerCase());
      if (autoSpeak && soundEnabled) speakWord(lastWord, speechRate, speechVolume);
    }
    appendChar(' ');
  }, [learnWord, autoSpeak, soundEnabled, speechRate, speechVolume, appendChar]);

  const handleSpeak = useCallback(() => {
    tapFeedback();
    const currentText = useMessageStore.getState().text.trim();
    if (!currentText || !soundEnabled) return;
    addToHistory(currentText);
    speak(currentText, speechRate, speechVolume);
  }, [soundEnabled, speechRate, speechVolume, addToHistory]);

  const handleBackspace = useCallback(() => {
    deleteFeedback();
    useMessageStore.getState().deleteLastChar();
  }, []);

  const kc = 'aac-key bg-[#2a2a3e] text-[#e0e0e0] rounded-xl font-semibold select-none flex items-center justify-center';

  return (
    <div className="flex-1 flex flex-col gap-2.5 p-2.5">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2.5 justify-center flex-1">
          {ri === 2 && keyboardMode === 'letters' && (
            <button onClick={() => { tapFeedback(); toggleCase(); }} aria-label={isUpperCase ? 'Shift on' : 'Shift off'} className={`${kc} px-4 min-w-[56px] ${isUpperCase ? 'bg-[#4CAF50] text-white' : ''}`}>
              {isUpperCase ? '⇧' : '⇪'}
            </button>
          )}
          {row.map((key) => (
            <button key={key} onClick={() => handleKey(key)} aria-label={key} className={`${kc} flex-1 text-lg min-h-[48px]`}>
              {keyboardMode === 'letters' ? (isUpperCase ? key : key.toLowerCase()) : key}
            </button>
          ))}
          {ri === 2 && keyboardMode === 'letters' && (
            <button onClick={handleBackspace} aria-label="Backspace" className={`${kc} px-4 min-w-[56px]`}>⌫</button>
          )}
        </div>
      ))}

      <div className="flex gap-2.5 flex-1">
        <button onClick={() => { tapFeedback(); toggleKeyboardMode(); }} aria-label="Switch keyboard mode" className={`${kc} min-w-[64px] px-3 text-sm`}>
          {keyboardMode === 'letters' ? '123' : keyboardMode === 'numbers' ? '#+=':'ABC'}
        </button>
        <button onClick={handleSpace} aria-label="Space" className={`${kc} flex-1 text-sm`}>space</button>
        <button onClick={() => handleKey('.')} aria-label="Period" className={`${kc} min-w-[56px] text-lg`}>.</button>
        <button onClick={() => handleKey(',')} aria-label="Comma" className={`${kc} min-w-[56px] text-lg`}>,</button>
        <button onClick={() => handleKey('?')} aria-label="Question mark" className={`${kc} min-w-[56px] text-lg`}>?</button>
        <button onClick={handleSpeak} aria-label="Speak full message" className="aac-btn aac-speak bg-[#4CAF50] text-white rounded-xl font-bold px-5 min-w-[88px] text-sm select-none flex items-center justify-center">
          Speak
        </button>
      </div>
    </div>
  );
}
