'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speak, speakWord } from '@/services/speechService';
import { tapFeedback, deleteFeedback } from '@/services/feedback';
import { correctText } from '@/services/textCorrectService';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';
import { getTTSCode } from '@/engine/i18n';
import { TONE_OPTIONS } from '@/services/azureTTS';
import { translateText, translateTextSync } from '@/services/translateService';

export default function MessageBar() {
  const { text, activeTone, setTone, autoSpeak, soundEnabled, deleteLastWord, clearAll, undo, addToHistory, toggleAutoSpeak, setText } = useMessageStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const { t, ttsCode, outputTtsCode } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTones, setShowTones] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const isPaid = !!(typeof window !== 'undefined' && localStorage.getItem('prism-aac-auth-token'));
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const [translated, setTranslated] = useState<string | null>(null);

  const prevTextRef = useRef(text);
  useEffect(() => {
    const prev = prevTextRef.current;
    prevTextRef.current = text;

    setTranslated(null);
    if (language === outputLanguage || !text.trim()) return;

    const result = translateTextSync(text.trim(), language, outputLanguage);
    if (result !== text.trim()) {
      setTranslated(result);
      const justCompletedWord = text.endsWith(' ') && !prev.endsWith(' ') && prev.trim().length > 0;
      if (justCompletedWord && autoSpeak && soundEnabled) {
        const outCode = getTTSCode(outputLanguage);
        speakWord(result, speechRate, speechVolume, outCode);
      }
    }
  }, [text, language, outputLanguage, autoSpeak, soundEnabled, speechRate, speechVolume]);

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

    const toSpeak = suggestion && suggestion !== original ? suggestion : original;
    if (suggestion && suggestion !== original) { setText(suggestion); setSuggestion(null); }
    addToHistory(toSpeak);

    if (translated) {
      speak(translated, speechRate, speechVolume, outputTtsCode, activeTone);
    } else {
      speak(toSpeak, speechRate, speechVolume, outputTtsCode, activeTone);
    }
  }, [text, soundEnabled, suggestion, speechRate, speechVolume, outputTtsCode, activeTone, addToHistory, setText, translated]);

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
    <div className="flex items-center gap-[clamp(0.2rem,0.4vw,0.4rem)] mx-1 my-[1px] surface-bar rounded-xl px-[clamp(0.4rem,0.6vw,0.75rem)] py-[clamp(0.2rem,0.5svh,0.5rem)] h-[clamp(40px,8svh,64px)] shrink-0 relative border border-theme">
      <button
        onClick={() => { tapFeedback(); toggleAutoSpeak(); }}
        aria-label={autoSpeak ? t('auto_speak_on') : t('auto_speak_off')}
        aria-pressed={autoSpeak}
        className={`aac-btn w-[clamp(2.75rem,5vw,4rem)] h-[clamp(2.75rem,5vw,4rem)] rounded-xl flex flex-col items-center justify-center shrink-0 border border-theme ${
          autoSpeak ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-muted'
        }`}
      >
        <span className="text-[clamp(1rem,1.8vw,1.375rem)]">{autoSpeak ? '🔊' : '🔈'}</span>
        <span className="text-[clamp(8px,0.8vw,11px)] mt-0.5">{t('auto')}</span>
      </button>

      {/* Tone selector — paid tiers only */}
      {isPaid && (
        <button
          onClick={() => { tapFeedback(); setShowTones(!showTones); }}
          aria-label={`Tone: ${currentTone?.label}`}
          className="aac-btn w-[clamp(2.75rem,5vw,4rem)] h-[clamp(2.75rem,5vw,4rem)] rounded-xl surface-key text-primary flex flex-col items-center justify-center shrink-0 border border-theme"
        >
          <span className="text-[clamp(1rem,1.8vw,1.375rem)]">{currentTone?.icon ?? '😊'}</span>
          <span className="text-[clamp(8px,0.8vw,11px)] mt-0.5 text-muted">{t('tone')}</span>
        </button>
      )}

      <div className="flex-1 min-h-[clamp(32px,5svh,48px)] flex flex-col justify-center overflow-hidden">
        <div className="text-[clamp(1rem,2.5vw,1.5rem)] flex items-center break-words text-primary truncate" role="status" aria-live="polite" aria-label={t('message_text')}>
          {text ? <ColoredText text={text} /> : <span className="text-dim">{t('type_here')}</span>}
        </div>
        {translated && (
          <div className="text-[clamp(0.75rem,2vw,1.1rem)] text-[#2196F3] font-semibold truncate">
            🌐 {translated}
          </div>
        )}
        {suggestion && !translated && (
          <button
            onClick={acceptSuggestion}
            aria-label={`Auto-correct to ${suggestion}`}
            data-testid="autocorrect-suggestion"
            className="text-left text-base md:text-lg text-[#4CAF50] truncate hover:underline mt-1"
          >
            ✨ {t('did_you_mean')} <span className="font-semibold">{suggestion}</span> <span className="text-dim text-sm">{t('tap_or_press')}</span>
          </button>
        )}
      </div>

      <button onClick={() => { tapFeedback(); undo(); }} aria-label={t('undo')} className="aac-btn w-[clamp(2.75rem,5vw,4rem)] h-[clamp(2.75rem,5vw,4rem)] rounded-xl surface-key text-muted text-[clamp(1rem,1.8vw,1.375rem)] flex items-center justify-center shrink-0 border border-theme">↩</button>

      <button onClick={handleSpeak} aria-label={t('speak')} className="aac-btn aac-speak w-[clamp(3rem,5.5vw,4.5rem)] h-[clamp(3rem,5.5vw,4.5rem)] rounded-xl bg-[#4CAF50] text-white text-[clamp(1.125rem,2vw,1.75rem)] flex items-center justify-center shrink-0">▶</button>

      <button
        onPointerDown={handleDeleteDown} onPointerUp={handleDeleteUp} onPointerLeave={cancelDelete} onPointerCancel={cancelDelete}
        aria-label={t('delete')} className="aac-btn aac-delete w-[clamp(3rem,5.5vw,4.5rem)] h-[clamp(3rem,5.5vw,4.5rem)] rounded-xl bg-[#F44336] text-white text-[clamp(1.125rem,2vw,1.75rem)] flex items-center justify-center shrink-0 select-none"
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
