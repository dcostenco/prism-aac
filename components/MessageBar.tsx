'use client';
import { useRef, useCallback } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak } from '@/services/speechService';
import { tapFeedback, deleteFeedback } from '@/services/feedback';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';

export default function MessageBar() {
  const { text, autoSpeak, soundEnabled, deleteLastWord, clearAll, undo, addToHistory, toggleAutoSpeak } = useMessageStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const { t, ttsCode } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpeak = useCallback(() => {
    tapFeedback();
    if (!text.trim() || !soundEnabled) return;
    addToHistory(text.trim());
    speak(text.trim(), speechRate, speechVolume, ttsCode);
  }, [text, soundEnabled, speechRate, speechVolume, ttsCode, addToHistory]);

  const cancelDelete = useCallback(() => {
    if (deleteTimer.current) { clearTimeout(deleteTimer.current); deleteTimer.current = null; }
  }, []);

  const handleDeleteDown = useCallback(() => {
    deleteTimer.current = setTimeout(() => {
      deleteFeedback();
      clearAll();
      deleteTimer.current = null;
    }, 600);
  }, [clearAll]);

  const handleDeleteUp = useCallback(() => {
    if (deleteTimer.current !== null) {
      clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
      deleteFeedback();
      deleteLastWord();
    }
  }, [deleteLastWord]);

  const handleUndo = useCallback(() => {
    tapFeedback();
    undo();
  }, [undo]);

  return (
    <div className="flex items-center gap-2 mx-3 my-1.5 bg-[#1e1e2e] rounded-2xl px-4 py-3 min-h-[68px] shrink-0">
      <button
        onClick={() => { tapFeedback(); toggleAutoSpeak(); }}
        aria-label={autoSpeak ? 'Auto-speak on, tap to turn off' : 'Auto-speak off, tap to turn on'}
        aria-pressed={autoSpeak}
        className={`aac-btn w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${
          autoSpeak ? 'bg-[#4CAF50] text-white' : 'bg-[#2a2a3e] text-[#888]'
        }`}
      >
        <span className="text-lg">{autoSpeak ? '🔊' : '🔈'}</span>
        <span className="text-[9px] mt-0.5">Auto</span>
      </button>

      <div className="flex-1 text-2xl min-h-[48px] flex items-center overflow-x-auto break-words" role="status" aria-live="polite" aria-label="Message text">
        {text ? <ColoredText text={text} /> : <span className="text-[#555]">{t('type_here')}</span>}
      </div>

      <button
        onClick={handleUndo}
        aria-label="Undo last action"
        className="aac-btn w-14 h-14 rounded-xl bg-[#2a2a3e] text-[#aaa] text-lg flex items-center justify-center shrink-0"
      >
        ↩
      </button>

      <button
        onClick={handleSpeak}
        aria-label="Speak full sentence"
        className="aac-btn aac-speak w-16 h-16 rounded-xl bg-[#4CAF50] text-white text-2xl flex items-center justify-center shrink-0"
      >
        ▶
      </button>

      <button
        onPointerDown={handleDeleteDown}
        onPointerUp={handleDeleteUp}
        onPointerLeave={cancelDelete}
        onPointerCancel={cancelDelete}
        aria-label="Delete last word, hold to clear all"
        className="aac-btn aac-delete w-16 h-16 rounded-xl bg-[#F44336] text-white text-2xl flex items-center justify-center shrink-0 select-none"
      >
        ⌫
      </button>
    </div>
  );
}
