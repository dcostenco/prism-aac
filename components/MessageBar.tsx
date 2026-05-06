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

/**
 * Returns true if `f` looks like a 1-letter-at-a-time expansion of `o`,
 * i.e. every character of o (lowercased, ignoring whitespace) appears
 * in f IN ORDER. Used to gate short-partial auto-expansion: "iwa" →
 * "I want a" preserves i,w,a in order ✓; "iwa" → "okay then" doesn't
 * (no i / no w) and so should require an explicit tap.
 */
function isSubsequence(o: string, f: string): boolean {
  const oChars = o.toLowerCase().replace(/\s+/g, '');
  const fChars = f.toLowerCase();
  let i = 0;
  for (const c of fChars) {
    if (oChars[i] === c) i++;
    if (i === oChars.length) return true;
  }
  return i === oChars.length;
}

function isSafeAutoCorrection(original: string, fixed: string): boolean {
  const o = original.trim();
  const f = fixed.trim();
  if (!o || !f || o === f) return false;
  const oToks = o.split(/\s+/);
  const fToks = f.split(/\s+/);

  // Lane 1 — whole-input short-partial: AAC users typing 2-4 chars in
  // total (e.g. "hw", "ok", "iwa") clearly haven't finished a thought.
  // Allow up to 3-token expansion BUT only if input letters survive as
  // a subsequence in the expansion. Prevents Gemini from rewriting
  // "ok" → "yes please"; accepts "iwa" → "I want a" (i,w,a in order).
  if (o.length <= 4 && oToks.length === 1 && fToks.length <= 3 && isSubsequence(o, f)) {
    return true;
  }

  // Lane 2 — mid-word completion with short trailing partial.
  // User typed normal words plus a short trailing fragment, e.g.
  //   "i Want y"  → "i Want you to"     (3 → 4 tokens, partial "y")
  //   "she go"    → "she goes home"     (2 → 3 tokens, partial "go")
  //   "lets pl"   → "lets play outside" (2 → 3 tokens, partial "pl")
  // The shape we trust: every PREFIX token matches the corresponding
  // fixed token (case-insensitive), the fixed token at the partial's
  // index STARTS WITH the partial, and at most +2 trailing tokens are
  // added. Without this lane the user has to tap to accept what is
  // obviously a completion and Speak reads "y" as the letter "wai".
  if (
    fToks.length >= oToks.length
    && fToks.length <= oToks.length + 2
    && oToks[oToks.length - 1].length <= 3
  ) {
    const lastIdx = oToks.length - 1;
    let prefixMatches = true;
    for (let i = 0; i < lastIdx; i++) {
      if (oToks[i].toLowerCase() !== fToks[i].toLowerCase()) {
        prefixMatches = false;
        break;
      }
    }
    const partial = oToks[lastIdx].toLowerCase();
    const partialMatch = fToks[lastIdx]?.toLowerCase().startsWith(partial);
    if (prefixMatches && partialMatch) {
      return true;
    }
  }

  // Lane 3 — standard: same-or-±1-token cleanup with bounded
  // Levenshtein. Used for typo fixes ("программычто" → "программа
  // что") and similar small repairs that are clearly the user's
  // intent, not a paraphrase.
  if (Math.abs(oToks.length - fToks.length) > 1) return false;
  const dist = levenshtein(o.toLowerCase(), f.toLowerCase());
  return dist <= Math.max(2, Math.floor(o.length * 0.30));
}

export default function MessageBar() {
  const { text, activeTone, toneMode, setTone, setToneMode, autoSpeak, soundEnabled, deleteLastWord, clearAll, undo, addToHistory, toggleAutoSpeak, setText } = useMessageStore();
  const { speechRate, speechVolume, language, aiAutocorrectEnabled } = useSettingsStore();
  const { t } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTones, setShowTones] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const isPaid = !!profile?.plan && profile.plan !== 'free';
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const [translated, setTranslated] = useState<string | null>(null);
  // Tracks the most recent word we silence-spoke so we don't repeat
  // "want" every time the user pauses with the same trailing word.
  // Updated by the autocorrect useEffect after a "no correction
  // needed" round-trip (the input is well-formed).
  const lastSilenceSpokenRef = useRef('');

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
    if (!aiAutocorrectEnabled) return;
    const trimmed = text.trim();
    // 2-char minimum so partials like "hw" → "how", "ok" stays "ok"
    // also get a chance at the bar. Below 2 chars there isn't enough
    // signal for a meaningful prediction. Previously 4, but AAC users
    // expect help on short keystrokes (motor friction → fewer chars
    // typed before they want assistance) and Speak otherwise reads
    // unknown 2-letter strings letter-by-letter.
    if (trimmed.length < 2) return;
    const isMidWord = !/\s$/.test(text);
    const mode = isMidWord ? 'complete' : 'correct';
    let cancelled = false;
    const timer = setTimeout(async () => {
      const fixed = await correctText(trimmed, language, mode);
      if (cancelled) return;
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      const inputIsValid = !fixed || fixed === trimmed || norm(fixed) === norm(trimmed);

      // Silence-detect speech. After the autocorrect roundtrip confirms
      // the input is well-formed (server returned no real change), speak
      // the most recently completed word. This replaces the previous
      // per-keystroke letter echo (which Azure pronounced as letter
      // names "aitch / double-yu / tee"). Word-level speech is the right
      // granularity for AAC: confirms what the user typed without
      // spelling. Dedup via lastSilenceSpokenRef so the same trailing
      // word doesn't re-speak on every render.
      if (inputIsValid) {
        // Read fresh state from stores rather than relying on closure
        // captures from the outer render — speechRate / activeTone
        // could have changed between text-change and timer fire.
        const ms = useMessageStore.getState();
        const ss = useSettingsStore.getState();
        if (ms.soundEnabled) {
          const tokens = trimmed.split(/\s+/);
          const lastWord = tokens[tokens.length - 1] || '';
          if (lastWord && lastWord !== lastSilenceSpokenRef.current) {
            lastSilenceSpokenRef.current = lastWord;
            aacSpeak(lastWord, ss.speechRate, ss.speechVolume, ms.activeTone);
          }
        }
        return;
      }
      // Reset silence-spoken tracker — input changed enough to need a
      // suggestion, so the next "input is valid" event should re-speak.
      lastSilenceSpokenRef.current = '';
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
    const accepted = suggestion;
    setText(accepted);
    setSuggestion(null);
    // Reinforce the accepted utterance so the engine learns the user's
    // patterns (e.g. "лукоморья|дуб" trigram after accepting Pushkin).
    learnUtterance(accepted);
    // Speak the accepted text immediately. Tapping the suggestion bar
    // is an explicit "I want this" — without speaking, the user has to
    // hit Speak as a second tap, which is exactly the friction the
    // suggestion was supposed to remove. Mirror handleSpeak's
    // translation handling: speak the translated string when one is
    // active, else the source text.
    if (soundEnabled) {
      aacSpeak(translated || accepted, speechRate, speechVolume, activeTone);
    }
  }, [suggestion, setText, learnUtterance, soundEnabled, translated, speechRate, speechVolume, activeTone]);

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
    let autoApplied = false;
    if (suggestion && isSafeAutoCorrection(original, suggestion)) {
      toSpeak = suggestion.trim();
      setText(toSpeak);
      setSuggestion(null);
      autoApplied = true;
    }

    // Defense against letter-by-letter TTS. When auto-apply didn't fire
    // (no suggestion yet, server down, suggestion rejected by safety
    // gate) AND the input ends with a single-character trailing token
    // preceded by at least one full word, strip that trailing char
    // before speaking. Without this, "i Want y" gets spoken as "i Want
    // wai", "она пошла д" as "она пошла deh", etc. Language-agnostic:
    // we don't keep a per-locale exception list, we just trust that a
    // user who typed 2+ words plus a 1-char tail meant the tail as a
    // partial, not as a standalone word. Keeps the rest of the
    // utterance speakable instead of pronouncing the letter.
    if (!autoApplied) {
      const tokens = toSpeak.split(/\s+/);
      if (tokens.length >= 2 && tokens[tokens.length - 1].length === 1) {
        const trimmed = tokens.slice(0, -1).join(' ');
        if (trimmed) toSpeak = trimmed;
      }
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
        {/* Autocorrect bar — shows ALONGSIDE the translation pane (not
            instead of). Suppressing the bar whenever a translation was
            shown was the cause of "no suggestion bar appears" in
            multilingual setups: users with EN→RO translation enabled
            never saw autocorrect suggestions even when the server had
            a perfect one. Both signals are useful independently — the
            translation tells the user what their text means in the
            target language; the autocorrect tells them what they
            probably meant to type. Show both, let the user pick. */}
        {suggestion && (
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
