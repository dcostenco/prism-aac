'use client';
import { useRef, useCallback, useState } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak } from '@/services/speechService';
import { tapFeedback, deleteFeedback } from '@/services/feedback';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';
import { TONE_OPTIONS, ToneStyle } from '@/services/azureTTS';

export default function MessageBar() {
  const { text, activeTone, setTone, autoSpeak, soundEnabled, deleteLastWord, clearAll, undo, addToHistory, toggleAutoSpeak } = useMessageStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const { t, ttsCode } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTones, setShowTones] = useState(false);
  const isPaid = !!( typeof window !== 'undefined' && localStorage.getItem('prism-aac-auth-token'));

  const handleSpeak = useCallback(() => {
    tapFeedback();
    if (!text.trim() || !soundEnabled) return;
    addToHistory(text.trim());
    speak(text.trim(), speechRate, speechVolume, ttsCode, activeTone);
  }, [text, soundEnabled, speechRate, speechVolume, ttsCode, activeTone, addToHistory]);

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

  const currentTone = TONE_OPTIONS.find(t => t.id === activeTone);

  return (
    <div className="flex items-center gap-2 mx-3 my-1.5 bg-[#1e1e2e] rounded-2xl px-4 py-3 min-h-[68px] shrink-0 relative">
      <button
        onClick={() => { tapFeedback(); toggleAutoSpeak(); }}
        aria-label={autoSpeak ? t('auto_speak_on') : t('auto_speak_off')}
        aria-pressed={autoSpeak}
        className={`aac-btn w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${
          autoSpeak ? 'bg-[#4CAF50] text-white' : 'bg-[#2a2a3e] text-[#888]'
        }`}
      >
        <span className="text-lg">{autoSpeak ? '🔊' : '🔈'}</span>
        <span className="text-[9px] mt-0.5">Auto</span>
      </button>

      {/* Tone selector — paid tiers only */}
      {isPaid && (
        <button
          onClick={() => { tapFeedback(); setShowTones(!showTones); }}
          aria-label={`Tone: ${currentTone?.label}`}
          className="aac-btn w-14 h-14 rounded-xl bg-[#2a2a3e] flex flex-col items-center justify-center shrink-0"
        >
          <span className="text-lg">{currentTone?.icon ?? '😊'}</span>
          <span className="text-[9px] mt-0.5 text-[#888]">{t('tone')}</span>
        </button>
      )}

      <div className="flex-1 text-2xl min-h-[48px] flex items-center overflow-x-auto break-words" role="status" aria-live="polite" aria-label="Message text">
        {text ? <ColoredText text={text} /> : <span className="text-[#555]">{t('type_here')}</span>}
      </div>

      <button onClick={() => { tapFeedback(); undo(); }} aria-label={t('undo')} className="aac-btn w-14 h-14 rounded-xl bg-[#2a2a3e] text-[#aaa] text-lg flex items-center justify-center shrink-0">↩</button>

      <button onClick={handleSpeak} aria-label={t('speak')} className="aac-btn aac-speak w-16 h-16 rounded-xl bg-[#4CAF50] text-white text-2xl flex items-center justify-center shrink-0">▶</button>

      <button
        onPointerDown={handleDeleteDown} onPointerUp={handleDeleteUp} onPointerLeave={cancelDelete} onPointerCancel={cancelDelete}
        aria-label={t('delete')} className="aac-btn aac-delete w-16 h-16 rounded-xl bg-[#F44336] text-white text-2xl flex items-center justify-center shrink-0 select-none"
      >⌫</button>

      {/* Tone picker popup */}
      {showTones && (
        <div className="absolute left-16 bottom-full mb-2 bg-[#1e1e2e] border border-[#2a2a3e] rounded-2xl p-2 grid grid-cols-3 gap-1.5 z-50 shadow-xl">
          {TONE_OPTIONS.map(tone => (
            <button
              key={tone.id}
              onClick={() => { tapFeedback(); setTone(tone.id); setShowTones(false); }}
              className={`aac-btn rounded-xl px-3 py-2 flex flex-col items-center ${activeTone === tone.id ? 'bg-[#4CAF50] text-white' : 'bg-[#2a2a3e] text-[#e0e0e0]'}`}
            >
              <span className="text-xl">{tone.icon}</span>
              <span className="text-[10px] mt-0.5">{tone.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
