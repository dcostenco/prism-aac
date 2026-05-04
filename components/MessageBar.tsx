'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback, deleteFeedback } from '@/services/feedback';
import { correctText } from '@/services/textCorrectService';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';
import { TONE_OPTIONS } from '@/services/azureTTS';
import { translateWithAIRefine } from '@/services/translateService';
import { useAuthStore } from '@/store/authStore';
import { usePredictionStore } from '@/store/predictionStore';

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1).fill(0).map((_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function isSafeAutoCorrection(original: string, fixed: string): boolean {
  const o = original.trim();
  const f = fixed.trim();
  if (!o || !f || o === f) return false;
  const oTokens = o.split(/\s+/).length;
  const fTokens = f.split(/\s+/).length;
  if (Math.abs(oTokens - fTokens) > 1) return false;
  const dist = levenshtein(o.toLowerCase(), f.toLowerCase());
  return dist <= Math.max(2, Math.floor(o.length * 0.30));
}

export default function MessageBar() {
  const { text, activeTone, toneMode, setTone, setToneMode, autoSpeak, soundEnabled, deleteLastWord, clearAll, undo, addToHistory, toggleAutoSpeak, setText } = useMessageStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const { t } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTones, setShowTones] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const isPaid = !!profile?.plan && profile.plan !== 'free';
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const [translated, setTranslated] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => { if (mounted) setTranslated(null); });
    if (language === outputLanguage || !text.trim()) return;
    let cancelled = false;
    const instant = translateWithAIRefine(
      text.trim(), language, outputLanguage,
      (refined) => { if (!cancelled) setTranslated(refined); },
    );
    if (instant.toLowerCase() !== text.trim().toLowerCase()) {
      queueMicrotask(() => { if (mounted) setTranslated(instant); });
    }
    return () => { cancelled = true; mounted = false; };
  }, [text, language, outputLanguage]);

  // Debounced background suggestion — child must explicitly tap to accept,
  // never auto-applied.
  //
  // Two modes:
  //   - When the input ends with whitespace ("good evening "), run pure
  //     CORRECTION: fix typos in already-typed words.
  //   - When the input is mid-word ("у лукоморья д"), run COMPLETION:
  //     predict the most likely full word for the trailing fragment and
  //     optionally extend by 1-3 words. This is what makes mid-typing
  //     suggestions useful instead of echoing the partial back.
  //
  // After the call returns we still reject useless results (suggestion
  // identical to input modulo case/whitespace, or suggestion that left
  // the trailing partial unchanged in completion mode).
  const setAiCompletion = usePredictionStore((s) => s.setAiCompletion);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setSuggestion(null);
        setAiCompletion(null);
      }
    });
    const trimmed = text.trim();
    if (trimmed.length < 4) return;
    const isMidWord = !/\s$/.test(text);
    const mode = isMidWord ? 'complete' : 'correct';
    let cancelled = false;
    const timer = setTimeout(async () => {
      const fixed = await correctText(trimmed, language, mode);
      if (cancelled || !fixed || fixed === trimmed) return;
      // Reject "echo" suggestions — same content modulo case/whitespace.
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      if (norm(fixed) === norm(trimmed)) return;
      const inputTokens = trimmed.split(/\s+/);
      const fixedTokens = fixed.trim().split(/\s+/);
      // In completion mode, attempt to extract a completion token for the PredictionBar.
      // Even if we fail (e.g. the AI autocorrected "togoso" -> "to go so" instead of completing),
      // we still want to show the full autocorrect suggestion below the bar.
      if (isMidWord) {
        const inputLast = inputTokens[inputTokens.length - 1] ?? '';
        // Find the AI's completion token. It must strictly extend the partial word.
        // Because the AI might have fixed spacing in earlier words, the index
        // could have shifted. We search all tokens and pick the closest one.
        const candidates = [];
        for (let i = 0; i < fixedTokens.length; i++) {
          if (fixedTokens[i].toLowerCase().startsWith(inputLast.toLowerCase()) && fixedTokens[i].length > inputLast.length) {
            candidates.push({ token: fixedTokens[i], index: i });
          }
        }
        
        if (candidates.length > 0) {
          const expectedIndex = inputTokens.length - 1;
          candidates.sort((a, b) => Math.abs(a.index - expectedIndex) - Math.abs(b.index - expectedIndex));
          
          const aiCompletion = candidates[0].token;
          setAiCompletion(aiCompletion);
        }
      }
      setSuggestion(fixed);
    }, 400);
    return () => { cancelled = true; mounted = false; clearTimeout(timer); };
  }, [text, language, setAiCompletion]);

  const learnWord = usePredictionStore((s) => s.learnWord);

  // Record every word + adjacent bigrams/trigrams in a finalized utterance
  // so the prediction engine learns from it. Used both when the user
  // accepts an AI suggestion (committing to those words) and when they
  // press Speak (the strongest possible signal — "this is what I actually
  // communicated"). User n-grams get a 10× boost over corpus on the next
  // prediction pass, so a few utterances quickly personalize the bar.
  const learnUtterance = useCallback((utterance: string) => {
    const words = utterance.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase();
      const prev = i > 0 ? words[i - 1].toLowerCase() : undefined;
      const prevPrev = i > 1 ? words[i - 2].toLowerCase() : undefined;
      learnWord(w, prev, prevPrev);
    }
  }, [learnWord]);

  // Decide whether the AI suggestion is a "safe" auto-correction — a
  // typo fix or small cleanup, not a big rewrite. Auto-applying on Speak
  // saves the user an extra tap (motor friction is real for AAC users)
  // BUT only for low-risk changes:
  //   - Same number of tokens, OR differs by exactly 1 (fixed missing
  //     space → "программычто" splits into "программа что")
  //   - Edit distance ≤ 30% of input length (otherwise it's a paraphrase)
  // Big rewrites and word-completions still need an explicit tap, so the
  // child's authorship is preserved when the AI gets creative.
  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    tapFeedback();
    setText(suggestion);
    setSuggestion(null);
    // Reinforce the accepted utterance so the engine learns the user's
    // patterns (e.g. "лукоморья|дуб" trigram after accepting Pushkin).
    learnUtterance(suggestion);
  }, [suggestion, setText, learnUtterance]);

  const handleSpeak = useCallback(() => {
    tapFeedback();
    const original = text.trim();
    if (!original || !soundEnabled) return;

    // Auto-apply *safe* AI corrections on Speak. The Speak button is the
    // user's "I'm done" signal — clear typos like "программычто" should
    // not require an extra tap to fix. Big rewrites and word-completions
    // still need explicit acceptance (isSafeAutoCorrection rejects them).
    // Authorship: the child can still see/edit the corrected text in the
    // bar; undo brings back the original; speech history holds the spoken
    // version. The original raw text is also still passed to learnUtterance
    // when we decide NOT to auto-apply.
    let toSpeak = original;
    if (suggestion && isSafeAutoCorrection(original, suggestion)) {
      toSpeak = suggestion.trim();
      setText(toSpeak);
      setSuggestion(null);
    }

    addToHistory(toSpeak);

    // Speak is the strongest learning signal: the user just authoritatively
    // communicated this exact utterance. Reinforce every word and adjacent
    // pair/triple. We learn from the SOURCE-language text (what the user
    // typed), not the translation, since that's what they'll type next.
    learnUtterance(toSpeak);

    if (translated) {
      aacSpeak(translated, speechRate, speechVolume, activeTone);
    } else {
      aacSpeak(toSpeak, speechRate, speechVolume, activeTone);
    }
  }, [text, soundEnabled, speechRate, speechVolume, activeTone, addToHistory, translated, learnUtterance, suggestion, setText]);

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
    <div className="flex items-center gap-[clamp(0.2rem,0.4vw,0.4rem)] mx-1 my-[1px] surface-bar rounded-xl px-[clamp(0.4rem,0.6vw,0.75rem)] py-[clamp(0.3rem,0.6svh,0.6rem)] min-h-[clamp(64px,12svh,96px)] shrink-0 relative border border-theme">
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

      {/* Tone selector — paid tiers only. Mirrors the Auto/Sound button:
          green-active when in 'auto' mode (adaptiveEngine picks tone), neutral
          when in 'manual' mode (user-picked tone forced). Click opens picker. */}
      {isPaid && (
        <button
          onClick={() => { tapFeedback(); setShowTones(!showTones); }}
          aria-label={toneMode === 'auto' ? 'Tone: auto' : `Tone: ${currentTone?.label}`}
          aria-pressed={toneMode === 'auto'}
          className={`aac-btn w-[clamp(2.75rem,5vw,4rem)] h-[clamp(2.75rem,5vw,4rem)] rounded-xl flex flex-col items-center justify-center shrink-0 border border-theme ${
            toneMode === 'auto' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
          }`}
        >
          <span className="text-[clamp(1rem,1.8vw,1.375rem)]">{toneMode === 'auto' ? '🎚' : (currentTone?.icon ?? '😊')}</span>
          <span className={`text-[clamp(8px,0.8vw,11px)] mt-0.5 ${toneMode === 'auto' ? '' : 'text-muted'}`}>{t('tone')}</span>
        </button>
      )}

      <div className="flex-1 min-h-[clamp(48px,9svh,72px)] flex flex-col justify-center overflow-hidden">
        <div
          className="text-[clamp(1rem,2.5vw,1.5rem)] leading-snug break-words text-primary line-clamp-2 whitespace-normal min-h-[2.5em]"
          role="status"
          aria-live="polite"
          aria-label={t('message_text')}
        >
          {text ? <ColoredText text={text} /> : <span className="text-dim">{t('type_here')}</span>}
        </div>
        {translated && (
          <div className="text-[clamp(0.75rem,2vw,1.1rem)] text-[#2196F3] font-semibold leading-snug line-clamp-2 whitespace-normal min-h-[2.5em]">
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

      {/* Tone picker popup — "Auto" sentinel comes first as the default
          mode (matches README's auto tone-switch behavior). Selecting any
          specific tone flips toneMode to 'manual' (via setTone). */}
      {showTones && (
        <div className="absolute left-16 bottom-full mb-2 surface-bar border border-theme rounded-2xl p-2 grid grid-cols-3 gap-1.5 z-50 shadow-xl">
          <button
            key="auto"
            onClick={() => { tapFeedback(); setToneMode('auto'); setShowTones(false); }}
            aria-pressed={toneMode === 'auto'}
            className={`aac-btn rounded-xl px-3 py-2 flex flex-col items-center border border-theme col-span-3 ${
              toneMode === 'auto' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
            }`}
          >
            <span className="text-xl">🎚</span>
            <span className="text-[10px] mt-0.5 font-bold">Auto (recommended)</span>
          </button>
          {TONE_OPTIONS.map(tone => (
            <button
              key={tone.id}
              onClick={() => { tapFeedback(); setTone(tone.id); setShowTones(false); }}
              aria-pressed={toneMode === 'manual' && activeTone === tone.id}
              className={`aac-btn rounded-xl px-3 py-2 flex flex-col items-center border border-theme ${
                toneMode === 'manual' && activeTone === tone.id ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
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
