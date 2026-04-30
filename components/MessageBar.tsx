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

  const handleSpeak = useCallback(() => {
    tapFeedback();
    const original = text.trim();
    if (!original || !soundEnabled) return;
    // Speak NEVER blocks on correction. If the background correction has
    // already produced a suggestion, prefer that — otherwise speak the
    // user's original text immediately. The user can't be left waiting
    // on a slow network for their voice. The background correctText() is
    // still running, and the suggestion will appear inline next to the
    // message bar; if the user taps Speak again after it lands, they get
    // the corrected version.
    const toSpeak = (suggestion && suggestion !== original) ? suggestion : original;
    if (suggestion && suggestion !== original) {
      setText(suggestion);
      setSuggestion(null);
    }
    addToHistory(toSpeak);
    speak(toSpeak, speechRate, speechVolume, ttsCode, activeTone);
  }, [text, soundEnabled, suggestion, speechRate, speechVolume, ttsCode, activeTone, addToHistory, setText]);

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
    <div className="flex items-center gap-2 max-sm:gap-1 landscape:gap-0.5 mx-3 max-sm:mx-1.5 landscape:mx-0.5 my-1.5 max-sm:my-0.5 landscape:my-0 surface-bar rounded-2xl max-sm:rounded-xl landscape:rounded-lg px-4 max-sm:px-2 landscape:px-1 py-3 max-sm:py-1 landscape:py-0.5 min-h-[68px] max-sm:min-h-[48px] landscape:min-h-[32px] shrink-0 relative border border-theme">
      <button
        onClick={() => { tapFeedback(); toggleAutoSpeak(); }}
        aria-label={autoSpeak ? t('auto_speak_on') : t('auto_speak_off')}
        aria-pressed={autoSpeak}
        className={`aac-btn w-14 h-14 max-sm:w-10 max-sm:h-10 landscape:w-7 landscape:h-7 rounded-xl max-sm:rounded-lg landscape:rounded flex flex-col items-center justify-center shrink-0 border border-theme ${
          autoSpeak ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-muted'
        }`}
      >
        <span className="text-lg max-sm:text-sm leading-none">{autoSpeak ? '🔊' : '🔈'}</span>
        <span className="text-[9px] mt-0.5 max-sm:hidden">Auto</span>
      </button>

      {/* Tone selector — paid tiers only */}
      {isPaid && (
        <button
          onClick={() => { tapFeedback(); setShowTones(!showTones); }}
          aria-label={`Tone: ${currentTone?.label}`}
          className="aac-btn w-14 h-14 max-sm:w-10 max-sm:h-10 landscape:w-7 landscape:h-7 rounded-xl max-sm:rounded-lg landscape:rounded surface-key text-primary flex flex-col items-center justify-center shrink-0 border border-theme"
        >
          <span className="text-lg max-sm:text-sm leading-none">{currentTone?.icon ?? '😊'}</span>
          <span className="max-sm:hidden text-[9px] mt-0.5 text-muted">{t('tone')}</span>
        </button>
      )}

      <div className="flex-1 min-w-0 min-h-[48px] max-sm:min-h-[32px] landscape:min-h-[24px] flex flex-col justify-center overflow-hidden">
        <div className="text-2xl max-sm:text-sm landscape:text-xs flex items-center break-words text-primary truncate" role="status" aria-live="polite" aria-label="Message text">
          {text ? <ColoredText text={text} /> : <span className="text-dim">{t('type_here')}</span>}
        </div>
        {suggestion && (
          <button
            onClick={acceptSuggestion}
            aria-label={`Auto-correct to ${suggestion}`}
            data-testid="autocorrect-suggestion"
            className="text-left text-base max-sm:text-xs md:text-lg text-[#4CAF50] truncate hover:underline mt-0.5 max-sm:mt-0.5"
          >
            ✨ <span className="font-semibold">{suggestion}</span> <span className="max-sm:hidden text-dim text-sm">— tap or press ▶</span>
          </button>
        )}
      </div>

      <button onClick={() => { tapFeedback(); undo(); }} aria-label={t('undo')} className="aac-btn w-14 h-14 max-sm:w-9 max-sm:h-9 landscape:w-7 landscape:h-7 rounded-xl max-sm:rounded-lg landscape:rounded surface-key text-muted text-lg max-sm:text-sm landscape:text-xs flex items-center justify-center shrink-0 border border-theme">↩</button>

      <button onClick={handleSpeak} aria-label={t('speak')} className="aac-btn aac-speak w-16 h-16 max-sm:w-11 max-sm:h-11 landscape:w-8 landscape:h-8 rounded-xl max-sm:rounded-lg landscape:rounded bg-[#4CAF50] text-white text-2xl max-sm:text-base landscape:text-sm flex items-center justify-center shrink-0">▶</button>

      <button
        onPointerDown={handleDeleteDown} onPointerUp={handleDeleteUp} onPointerLeave={cancelDelete} onPointerCancel={cancelDelete}
        aria-label={t('delete')} className="aac-btn aac-delete w-16 h-16 max-sm:w-11 max-sm:h-11 landscape:w-8 landscape:h-8 rounded-xl max-sm:rounded-lg landscape:rounded bg-[#F44336] text-white text-2xl max-sm:text-base landscape:text-sm flex items-center justify-center shrink-0 select-none"
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
