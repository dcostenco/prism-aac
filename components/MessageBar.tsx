'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useMessageStore, setLatestTranslated } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { aacSpeak } from '@/services/aacSpeak';
import type { SupportedLanguage } from '@/engine/i18n';
import { tapFeedback, deleteFeedback } from '@/services/feedback';
import { correctText } from '@/services/textCorrectService';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';
import { subscribeTtsHighlight } from '@/services/ttsHighlightBus';
import { TONE_OPTIONS, warmupAzureAudio } from '@/services/azureTTS';
import { translateWithAIRefine, looksLikeTargetLang, abortTranslation } from '@/services/translateService';
import { useAuthStore } from '@/store/authStore';
import { usePredictionStore } from '@/store/predictionStore';
import { triggerAISubmit } from '@/services/aiChatBridge';
import { isSafeAutoCorrection } from '@/services/autocorrectSafety';

export default function MessageBar() {
  const text = useMessageStore((s) => s.text);
  const activeTone = useMessageStore((s) => s.activeTone);
  const toneMode = useMessageStore((s) => s.toneMode);
  const setTone = useMessageStore((s) => s.setTone);
  const setToneMode = useMessageStore((s) => s.setToneMode);
  const autoSpeak = useMessageStore((s) => s.autoSpeak);
  const soundEnabled = useMessageStore((s) => s.soundEnabled);
  const deleteLastWord = useMessageStore((s) => s.deleteLastWord);
  const clearAll = useMessageStore((s) => s.clearAll);
  const undo = useMessageStore((s) => s.undo);
  const addToHistory = useMessageStore((s) => s.addToHistory);
  const toggleAutoSpeak = useMessageStore((s) => s.toggleAutoSpeak);
  const setText = useMessageStore((s) => s.setText);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const speechVolume = useSettingsStore((s) => s.speechVolume);
  const language = useSettingsStore((s) => s.language);
  const aiAutocorrectEnabled = useSettingsStore((s) => s.aiAutocorrectEnabled);
  const { t } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTones, setShowTones] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const isPaid = !!profile?.plan && profile.plan !== 'free';
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  // When AI Chat or AAC Chat is open, those panels collapse to invisible
  // in their compact (empty) state. The freed vertical space goes here:
  // the message bar grows by one extra line so the user has more room
  // to compose a question / message without the input feeling cramped.
  // Per user feedback 2026-05-07: "expand type here panel for 1 more
  // line instead" of showing a redundant AI Chat header strip.
  const sidePanel = useUIStore((s) => s.sidePanel);
  const isMessagingMode = sidePanel === 'ai-chat' || sidePanel === 'aac-chat';
  const [translated, setTranslated] = useState<string | null>(null);
  // Ref so the 2s translation auto-speak timer always reads the latest
  // translated value even when `translated` is excluded from its deps array.
  const translatedRef = useRef(translated);
  useEffect(() => {
    translatedRef.current = translated;
    setLatestTranslated(translated);
  }, [translated]);
  // Tracks the most recent word we silence-spoke so we don't repeat
  // "want" every time the user pauses with the same trailing word.
  // Updated by the autocorrect useEffect after a "no correction
  // needed" round-trip (the input is well-formed).
  const lastSilenceSpokenRef = useRef('');
  // Timer ref for translation-mode auto-speak after silence.
  const translationSpeakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── TTS word highlight (Read & Write parity) ────────────────────
  //
  // Subscribes to the ttsHighlight bus. When a speak event fires
  // (Speak button, sentence-end, accept-suggestion, anywhere aacSpeak
  // runs), we receive (text, estimatedDurationMs) and start a
  // setInterval that advances `activeWordIndex` until the spoken text
  // has been fully covered. The render path passes activeWordIndex
  // into ColoredText which paints the matching word with a yellow
  // background.
  //
  // Notes:
  //   - Duration is ESTIMATED (60 ms/char @ rate=0.5). Real TTS
  //     duration depends on the backend; the highlight may finish
  //     slightly before/after audio. Acceptable trade-off vs a full
  //     audio-element refactor — the visible "follow along" benefit
  //     dominates a small drift.
  //   - We highlight ONLY the bar's `text` (what the user typed). If
  //     a different string is spoken (e.g. a tutor result), the bus
  //     event still fires but the renderer shows no highlight because
  //     no word in `text` matches the spoken string. That's correct:
  //     don't try to follow-along a string you can't see.
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const highlightTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const stopHighlight = () => {
      if (highlightTickRef.current) { clearInterval(highlightTickRef.current); highlightTickRef.current = null; }
      if (highlightEndRef.current) { clearTimeout(highlightEndRef.current); highlightEndRef.current = null; }
      setActiveWordIndex(null);
    };
    const unsubscribe = subscribeTtsHighlight((event) => {
      if (event.type === 'tts-highlight-end') {
        stopHighlight();
        return;
      }
      // tts-highlight-start
      stopHighlight();
      // Tokenise the SPOKEN text the same way the renderer does so the
      // word index matches. We only highlight if the spoken string is
      // (a prefix of) the current message bar text — sentence-end
      // events speak the LAST sentence which is a suffix; for those
      // we'd need a smarter alignment. MVP: highlight when spoken text
      // === current text exactly OR is a tail substring of it.
      const currentBar = useMessageStore.getState().text;
      const spokenWords = event.text.trim().split(/\s+/).filter(Boolean);
      if (spokenWords.length === 0) return;
      // Word offset inside the bar text. If the spoken text starts
      // somewhere in the middle (sentence-end case), find that offset.
      const barWords = currentBar.trim().split(/\s+/).filter(Boolean);
      let offset = 0;
      if (event.text.trim() !== currentBar.trim()) {
        // Search for the spoken first-word in the bar's word list,
        // walking from the END so a repeated word ("Mr. Mr.") binds
        // to the most recent occurrence.
        for (let i = barWords.length - spokenWords.length; i >= 0; i--) {
          if (barWords[i]?.toLowerCase() === spokenWords[0].toLowerCase()) {
            offset = i;
            break;
          }
        }
      }
      const perWordMs = Math.max(80, Math.round(event.estimatedDurationMs / spokenWords.length));
      let wordIdx = 0;
      setActiveWordIndex(offset);
      highlightTickRef.current = setInterval(() => {
        wordIdx++;
        if (wordIdx >= spokenWords.length) {
          stopHighlight();
          return;
        }
        setActiveWordIndex(offset + wordIdx);
      }, perWordMs);
      // Safety net: clear after the estimated total (in case an interval
      // tick is dropped under heavy main-thread load).
      highlightEndRef.current = setTimeout(stopHighlight, event.estimatedDurationMs + 500);
    });
    return () => { unsubscribe(); stopHighlight(); };
  }, []);

  useEffect(() => {
    setTranslated(null);
    if (language === outputLanguage || !text.trim()) return;
    let mounted = true;
    let cancelled = false;
    const instant = translateWithAIRefine(
      text.trim(), language, outputLanguage,
      (refined) => { if (!cancelled) setTranslated(refined); },
    );
    // Only show the offline-dict result if it actually looks like the target
    // language script (≥60% matching letters). Partial offline results like
    // "Я хочу К быть - best player" (mixed script) are hidden — the AI
    // refine fires after 200ms and shows the correct translation instead.
    const isChanged = instant.toLowerCase() !== text.trim().toLowerCase();
    if (isChanged && looksLikeTargetLang(instant, outputLanguage)) {
      setTranslated(instant);
    }
    return () => { cancelled = true; abortTranslation(); };
  }, [text, language, outputLanguage]);

  // ── Translation auto-speak after silence ─────────────────────────────────
  // When translation mode is active (language ≠ outputLanguage) and autoSpeak
  // is on, speak the full translated phrase after 2 seconds of inactivity.
  // This replaces word-by-word auto-speak (suppressed in translation mode) with
  // a single clean utterance in the target language once the user pauses.
  const TRANSLATION_SILENCE_MS = 2000;
  useEffect(() => {
    if (translationSpeakTimer.current) clearTimeout(translationSpeakTimer.current);
    const { language: lang, outputLanguage: outLang } = useSettingsStore.getState();
    const translationActive = lang !== outLang;
    const { autoSpeak: as, soundEnabled: se } = useMessageStore.getState();
    if (!translationActive || !as || !se || !text.trim()) return;

    translationSpeakTimer.current = setTimeout(() => {
      const { autoSpeak, soundEnabled } = useMessageStore.getState();
      if (!autoSpeak || !soundEnabled) return;
      // Use translatedRef.current so we always read the latest AI-refined
      // translation — the closure over `translated` would be stale here
      // because `translated` is intentionally excluded from the deps array.
      const latestTranslated = translatedRef.current;
      const outLang = useSettingsStore.getState().outputLanguage as SupportedLanguage | undefined;
      aacSpeak(latestTranslated || text.trim(), speechRate, speechVolume, activeTone, false, latestTranslated ? outLang : undefined);
    }, TRANSLATION_SILENCE_MS);

    return () => {
      if (translationSpeakTimer.current) clearTimeout(translationSpeakTimer.current);
    };
  // NOTE: `translated` intentionally excluded from deps — including it would
  // restart the 2s timer when AI-refine updates the translation, causing a
  // second auto-speak. The timer callback reads translated state at fire time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speechRate, speechVolume, activeTone]);

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
          // Skip silence speech for short trailing partials (≤2 chars).
          // "i Want y" — server echoed input as "valid" but the trailing
          // "y" is clearly a partial mid-word, not a finished word the
          // user wants spoken. Speaking it here would produce the same
          // "letter by letter wai" complaint Speak's strip-fallback was
          // designed to prevent. Only speak words ≥3 chars; users in
          // mid-typing get silent feedback until they finish a word.
          // In translation mode, suppress word-by-word silence-detect speech.
          // Speaking individual source-language words with the target voice produces
          // mixed-language audio (ro-RO + ru-RU simultaneously). The user presses
          // Speak to hear the full translated phrase.
          const translationActive = ss.language !== ss.outputLanguage;
          if (!translationActive && lastWord.length >= 3 && lastWord.toLowerCase() !== lastSilenceSpokenRef.current.toLowerCase()) {
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
  }, [text, language, setAiCompletion, aiAutocorrectEnabled]);

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
    // Pre-mark the trailing word as "already spoken" so the silence-
    // detect useEffect (which fires 400ms after this setText updates
    // text) doesn't immediately re-speak the last word in a different
    // (wrong) voice. The user just heard the full phrase via aacSpeak
    // below — they don't need it again word-by-word.
    const acceptedTokens = accepted.trim().split(/\s+/);
    lastSilenceSpokenRef.current = acceptedTokens[acceptedTokens.length - 1] || '';
    // Speak the accepted text immediately. Tapping the suggestion bar
    // is an explicit "I want this" — without speaking, the user has to
    // hit Speak as a second tap, which is exactly the friction the
    // suggestion was supposed to remove. Mirror handleSpeak's
    // translation handling: speak the translated string when one is
    // active, else the source text.
    if (soundEnabled) {
      const outLang = useSettingsStore.getState().outputLanguage as SupportedLanguage | undefined;
      aacSpeak(translated || accepted, speechRate, speechVolume, activeTone, false, translated ? outLang : undefined);
    }
  }, [suggestion, setText, learnUtterance, soundEnabled, translated, speechRate, speechVolume, activeTone]);

  const handleSpeak = useCallback(() => {
    void warmupAzureAudio();
    tapFeedback();
    // When AI Chat panel is open, ▶ sends the message to AI instead of speaking aloud.
    // Same routing that Keyboard.tsx Speak key does.
    if (useUIStore.getState().sidePanel === 'ai-chat') {
      triggerAISubmit();
      return;
    }
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

    // Pre-mark trailing word so silence-detect doesn't re-speak it after
    // the autocorrect useEffect re-runs (text just changed via setText
    // when auto-apply fired).
    const toSpeakTokens = toSpeak.split(/\s+/);
    lastSilenceSpokenRef.current = toSpeakTokens[toSpeakTokens.length - 1] || '';

    // interrupt=true: Speak button always overrides any currently-playing audio,
    // regardless of PROTECT_PLAY_MS. This flag travels through aacSpeak→speak→speakAzure
    // as a parameter (not a shared flag) so concurrent autoSpeak calls can't steal it.
    if (translated) {
      aacSpeak(translated, speechRate, speechVolume, activeTone, true, outputLanguage as SupportedLanguage);
    } else {
      aacSpeak(toSpeak, speechRate, speechVolume, activeTone, true);
    }
  }, [text, soundEnabled, speechRate, speechVolume, activeTone, addToHistory, translated, learnUtterance, suggestion, setText, outputLanguage]);

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
    <div
      className="flex items-center gap-[clamp(0.2rem,0.4vw,0.4rem)] mx-1 my-[1px] surface-bar rounded-xl px-[clamp(0.4rem,0.6vw,0.75rem)] py-[clamp(0.3rem,0.6svh,0.6rem)] shrink-0 relative border border-theme"
      style={{ minHeight: isMessagingMode ? 'clamp(100px, 14svh, 180px)' : 'clamp(72px, 10svh, 132px)' }}
      data-messaging-mode={isMessagingMode ? '1' : '0'}
    >
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

      <div className={`flex-1 flex flex-col justify-center overflow-hidden ${
          isMessagingMode
            ? 'min-h-[clamp(96px,18svh,144px)]'
            : 'min-h-[clamp(72px,13svh,108px)]'
        }`}>
        <div
          className={`text-[clamp(1rem,2.5vw,1.5rem)] leading-snug break-words text-primary whitespace-normal ${
            isMessagingMode
              ? 'line-clamp-4 min-h-[5em]'
              : 'line-clamp-3 min-h-[3.75em]'
          }`}
          role="status"
          aria-live="polite"
          aria-label={t('message_text')}
        >
          {/* Empty state: render nothing instead of a "Type here..."
              placeholder — on narrow viewports it clipped to "Typ" /
              "Type" which looked like a render bug (user report
              Image #26 2026-05-08). The Auto / Tone / Speak / ⌫
              buttons frame the input area clearly enough on their
              own; the placeholder was redundant noise. */}
          {text && <ColoredText text={text} activeWordIndex={activeWordIndex} />}
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
        <div aria-live="polite" aria-atomic="true">
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
