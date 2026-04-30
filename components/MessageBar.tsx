'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak } from '@/services/speechService';
import { tapFeedback, deleteFeedback } from '@/services/feedback';
import { correctText } from '@/services/textCorrectService';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';
import { TONE_OPTIONS } from '@/services/azureTTS';

export default function MessageBar() {
  const { text, activeTone, setTone, autoSpeak, soundEnabled, deleteLastWord, clearAll, undo, addToHistory, toggleAutoSpeak, setText } = useMessageStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const { t, ttsCode } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTones, setShowTones] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const isPaid = !!(typeof window !== 'undefined' && localStorage.getItem('prism-aac-auth-token'));

  // Debounced background correction. As the user types, we ask the
  // /api/v1/text/correct endpoint for the most likely intended utterance.
  // The suggestion is shown inline (greyed) and auto-applied on Speak —
  // critical for users with motor impairments who can't type precisely
  // ("bowlof,ri" → "bowl of rice").
  useEffect(() => {
    setSuggestion(null);
    const trimmed = text.trim();
    if (trimmed.length < 4) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const fixed = await correctText(trimmed, language);
      if (!cancelled && fixed && fixed !== trimmed) setSuggestion(fixed);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, language]);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    tapFeedback();
    setText(suggestion);
    setSuggestion(null);
  }, [suggestion, setText]);

  const handleSpeak = useCallback(async () => {
    tapFeedback();
    const original = text.trim();
    if (!original || !soundEnabled) return;
    // Auto-apply the latest suggestion (or fetch one synchronously) so the
    // user hears their intended phrase, not their typo.
    let toSpeak = original;
    if (suggestion && suggestion !== original) {
      toSpeak = suggestion;
      setText(suggestion);
      setSuggestion(null);
    } else {
      const fixed = await correctText(original, language);
      if (fixed && fixed !== original) {
        toSpeak = fixed;
        setText(fixed);
      }
    }
    addToHistory(toSpeak);
    speak(toSpeak, speechRate, speechVolume, ttsCode, activeTone);
  }, [text, soundEnabled, suggestion, language, speechRate, speechVolume, ttsCode, activeTone, addToHistory, setText]);

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

  const currentTone = TONE_OPTIONS.find(opt => opt.id === activeTone);

  return (
    <div className="flex items-center gap-2 mx-3 my-1.5 surface-bar rounded-2xl px-4 py-3 min-h-[68px] shrink-0 relative border border-theme">
      <button
        onClick={() => { tapFeedback(); toggleAutoSpeak(); }}
        aria-label={autoSpeak ? t('auto_speak_on') : t('auto_speak_off')}
        aria-pressed={autoSpeak}
        className={`aac-btn w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border border-theme ${
          autoSpeak ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-muted'
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
          className="aac-btn w-14 h-14 rounded-xl surface-key text-primary flex flex-col items-center justify-center shrink-0 border border-theme"
        >
          <span className="text-lg">{currentTone?.icon ?? '😊'}</span>
          <span className="text-[9px] mt-0.5 text-muted">{t('tone')}</span>
        </button>
      )}

      <div className="flex-1 min-h-[48px] flex flex-col justify-center overflow-hidden">
        <div className="text-2xl flex items-center break-words text-primary truncate" role="status" aria-live="polite" aria-label="Message text">
          {text ? <ColoredText text={text} /> : <span className="text-dim">{t('type_here')}</span>}
        </div>
        {suggestion && (
          <button
            onClick={acceptSuggestion}
            aria-label={`Auto-correct to ${suggestion}`}
            data-testid="autocorrect-suggestion"
            className="text-left text-base md:text-lg text-[#4CAF50] truncate hover:underline mt-1"
          >
            ✨ Did you mean: <span className="font-semibold">{suggestion}</span> <span className="text-dim text-sm">— tap or press ▶</span>
          </button>
        )}
      </div>

      <button onClick={() => { tapFeedback(); undo(); }} aria-label={t('undo')} className="aac-btn w-14 h-14 rounded-xl surface-key text-muted text-lg flex items-center justify-center shrink-0 border border-theme">↩</button>

      <button onClick={handleSpeak} aria-label={t('speak')} className="aac-btn aac-speak w-16 h-16 rounded-xl bg-[#4CAF50] text-white text-2xl flex items-center justify-center shrink-0">▶</button>

      <button
        onPointerDown={handleDeleteDown} onPointerUp={handleDeleteUp} onPointerLeave={cancelDelete} onPointerCancel={cancelDelete}
        aria-label={t('delete')} className="aac-btn aac-delete w-16 h-16 rounded-xl bg-[#F44336] text-white text-2xl flex items-center justify-center shrink-0 select-none"
      >⌫</button>

      {/* Tone picker popup */}
      {showTones && (
        <div className="absolute left-16 bottom-full mb-2 surface-bar border border-theme rounded-2xl p-2 grid grid-cols-3 gap-1.5 z-50 shadow-xl">
          {TONE_OPTIONS.map(tone => (
            <button
              key={tone.id}
              onClick={() => { tapFeedback(); setTone(tone.id); setShowTones(false); }}
              className={`aac-btn rounded-xl px-3 py-2 flex flex-col items-center border border-theme ${
                activeTone === tone.id ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
              }`}
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
