'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useMessageStore, setLatestTranslated } from '@/store/messageStore';
import {
  useSettingsStore,
  getSpeechFeedbackMode,
  nextSpeechFeedbackMode,
  speechFeedbackFlags,
} from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { aacSpeak } from '@/services/aacSpeak';
import type { SupportedLanguage } from '@/engine/i18n';
import { tapFeedback, deleteFeedback, speakFeedback } from '@/services/feedback';
import { ddAction } from '@/lib/datadog';
import { correctText } from '@/services/textCorrectService';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';
import { subscribeTtsHighlight } from '@/services/ttsHighlightBus';
import { TONE_OPTIONS, warmupAzureAudio } from '@/services/azureTTS';
import { translateWithAIRefine, looksLikeTargetLang, isPhraseBoundary, translateForSpeech } from '@/services/translateService';
import { usePredictionStore } from '@/store/predictionStore';
import { useAuthStore } from '@/store/authStore';
import { triggerAISubmit } from '@/services/aiChatBridge';
import {
  getPredictionSessionScope,
  rememberConfirmedPhrase,
} from '@/services/predictionMemoryService';

function normalizeSpokenText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}


function trailingSpokenWord(value: string): string {
  const lastToken = value.trim().split(/\s+/).at(-1) ?? '';
  return lastToken.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * `compact` is phone landscape (viewport under 500px tall). The bar stays
 * mounted there — it carries the composed message and the Play button, and an
 * AAC user who cannot see the sentence they are building has lost the point of
 * the app — but it gives up its vertical padding so the keyboard keeps the
 * height. The controls already size from vw/svh clamps, so they shrink on
 * their own; only the box needs to be told to stop reserving 72px.
 */
export default function MessageBar({ compact = false }: { compact?: boolean } = {}) {
  const text = useMessageStore((s) => s.text);
  const activeTone = useMessageStore((s) => s.activeTone);
  const toneMode = useMessageStore((s) => s.toneMode);
  const setTone = useMessageStore((s) => s.setTone);
  const setToneMode = useMessageStore((s) => s.setToneMode);
  const speakSelectionFeedback = useSettingsStore((s) => s.speakSelectionFeedback);
  const speakOnSentenceEnd = useSettingsStore((s) => s.speakOnSentenceEnd);
  const speechMode = getSpeechFeedbackMode({ speakSelectionFeedback, speakOnSentenceEnd });
  const updateSettings = useSettingsStore((s) => s.update);
  const soundEnabled = useMessageStore((s) => s.soundEnabled);
  const deleteLastWord = useMessageStore((s) => s.deleteLastWord);
  const clearAll = useMessageStore((s) => s.clearAll);
  const undo = useMessageStore((s) => s.undo);
  const addToHistory = useMessageStore((s) => s.addToHistory);
  const setText = useMessageStore((s) => s.setText);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const speechVolume = useSettingsStore((s) => s.speechVolume);
  const language = useSettingsStore((s) => s.language);
  const aiAutocorrectEnabled = useSettingsStore((s) => s.aiAutocorrectEnabled);
  const cloudPredictionEnabled = useSettingsStore((s) => s.cloudPredictionEnabled);
  const authenticatedProfile = useAuthStore((s) => s.profile);
  const { t } = useT();
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTones, setShowTones] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
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
  // Tracks speech already triggered by a direct tile/word action so the
  // composition silence timer does not repeat the same utterance.
  const lastAutoSpokenRef = useRef({ text: '', at: 0 });
  // Timer ref for phrase-level auto-speak after composition silence.
  const compositionSpeakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const normalizedSpokenText = normalizeSpokenText(event.text);
      lastAutoSpokenRef.current = {
        text: normalizedSpokenText,
        at: Date.now(),
      };
      // Direct tile/space/prediction speech already delivered this trailing
      // word. Mark it here so the independent autocorrect-silence path cannot
      // send a second, last-word-only cloud request moments later.
      lastSilenceSpokenRef.current = trailingSpokenWord(normalizedSpokenText);
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
    // Translation is derived from the current text/language pair and must be
    // cleared before starting a replacement request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTranslated(null);
    if (language === outputLanguage || !text.trim()) return;
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
    // Deliberately does NOT abort the refine. This cleanup runs on EVERY text
    // change, including the keystroke that just created the phrase — and by
    // then the keyboard's sentence-end handler may already have scheduled and
    // joined a refine for it, which aborting would cancel out from under the
    // speaker. The `cancelled` flag below is what prevents a stale result from
    // being applied, and translateWithAIRefine now cancels on its own whenever
    // the phrase genuinely changes, so nothing is left running for old text.
    return () => { cancelled = true; };
  }, [text, language, outputLanguage]);

  // Play / Speak is the "manual" half of the phrase-detected-or-manual rule.
  // translateWithAIRefine only spends a cloud call at a phrase boundary, so an
  // utterance with no closing punctuation ("I want water") would otherwise be
  // spoken straight from the offline dictionary. Pressing Play is an explicit
  // "I am done", so force the refine here and give it a bounded window before
  // speaking. The budget is deliberately short: speaking the slightly-worse
  // offline translation on time beats making an AAC user wait for the network.
  // Play is the "manual" half of the phrase-detected-or-manual rule. Shared
  // with the keyboard's Speak key via translateForSpeech — see that helper for
  // why both controls must go through the same path.
  const forceTranslateForSpeech = useCallback(async (): Promise<string | null> => {
    const ss = useSettingsStore.getState();
    if (ss.language === ss.outputLanguage) return null;
    const phrase = useMessageStore.getState().text.trim();
    if (!phrase) return null;
    if (translatedRef.current && isPhraseBoundary(phrase)) {
      // The boundary refine already ran for this exact phrase.
      return translatedRef.current;
    }
    const best = await translateForSpeech(
      phrase,
      ss.language as SupportedLanguage,
      ss.outputLanguage as SupportedLanguage,
      (t) => setTranslated(t),
    );
    return best ?? translatedRef.current;
  }, []);

  // ── Phrase auto-speak after silence: REMOVED ────────────────────────────
  //
  // This used to speak the whole composed message after 400ms (a confident
  // complete word) or 2s of silence. That is MESSAGE speech — the public
  // utterance to a communication partner — produced because the user PAUSED,
  // which is not consent to say anything. Pausing is what AAC users do while
  // composing; switch scanning, head tracking and eye gaze all pause
  // constantly. Every draft, false start and typo was broadcast, and a
  // partial message can invert the meaning of the finished one.
  //
  // The message is spoken when the user presses Speak. Optional auditory
  // feedback (settings: speakSelectionFeedback) confirms each SELECTION by
  // speaking the item just chosen, which is the channel that actually serves
  // scanning users.

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
      // the input is well-formed (server returned no real change), replay
      // the cumulative phrase. This replaces the previous
      // per-keystroke letter echo (which Azure pronounced as letter
      // names "aitch / double-yu / tee"). Word-level speech is the right
      // granularity for AAC: confirms what the user typed without
      // spelling. Dedup via lastSilenceSpokenRef so an unchanged trailing
      // word doesn't replay the phrase on every render.
      if (inputIsValid) {
        // Speech removed. This spoke the whole trimmed message once the
        // autocorrect round-trip confirmed the input was well-formed — i.e.
        // because the user PAUSED and the server said "looks fine". Neither
        // is consent to say anything aloud. It is MESSAGE speech and it now
        // happens only when the user presses Speak.
        //
        // `lastSilenceSpokenRef` is retained: the Speak handlers still use it
        // to avoid double-speaking a phrase.
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

  // One authoritative positive signal feeds both local and signed-in cloud
  // memory. Merely displaying a correction or prediction never learns it.
  const recordConfirmedPhrase = useCallback((phrase: string) => {
    const predictionScope = getPredictionSessionScope(authenticatedProfile?.email);
    try {
      import('../services/hrrContext').then(async ({ recordPhrase, initAacHrr }) => {
        if (await initAacHrr(predictionScope)) {
          const hour = new Date().getHours();
          recordPhrase(phrase, {
            language,
            scope: predictionScope,
            timeOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
          });
        }
      }).catch(() => {});
    } catch { /* Local memory is optional. */ }

    if (authenticatedProfile && cloudPredictionEnabled) {
      void rememberConfirmedPhrase(phrase, language);
    }
  }, [authenticatedProfile, cloudPredictionEnabled, language]);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    tapFeedback();
    const accepted = suggestion;
    setText(accepted);
    setSuggestion(null);
    // Reinforce the accepted utterance so the engine learns the user's
    // patterns (e.g. "лукоморья|дуб" trigram after accepting Pushkin).
    learnUtterance(accepted);
    recordConfirmedPhrase(accepted);
    // Pre-mark the trailing word as "already spoken" so the silence-
    // detect useEffect (which fires 400ms after this setText updates
    // text) doesn't immediately re-speak the last word in a different
    // (wrong) voice. The user just heard the full phrase via aacSpeak
    // below — they don't need it again word-by-word.
    const acceptedTokens = accepted.trim().split(/\s+/);
    lastSilenceSpokenRef.current = acceptedTokens[acceptedTokens.length - 1] || '';
    // Accepting a correction does NOT speak.
    //
    // This used to voice the whole message on tap, arguing that tapping the
    // suggestion is an explicit "I want this". It is — but it is an explicit
    // request for the CORRECTION, not a request to be heard. The rule is that
    // voice requires the Speak control or an emergency/help action, and an
    // edit is neither. The user fixes their text, then decides to say it.
  }, [suggestion, setText, learnUtterance, recordConfirmedPhrase, soundEnabled, translated, speechRate, speechVolume, activeTone]);

  const handleSpeak = useCallback(() => {
    void warmupAzureAudio();
    speakFeedback();
    // When AI Chat panel is open, ▶ sends the message to AI instead of speaking aloud.
    // Same routing that Keyboard.tsx Speak key does.
    if (useUIStore.getState().sidePanel === 'ai-chat') {
      triggerAISubmit();
      return;
    }
    const original = text.trim();
    // soundEnabled is a master mute and Play does not override it. Someone who
    // muted deliberately — a caregiver in a classroom, a user in a quiet room —
    // must not be made audible by pressing Play, and must not have their mute
    // silently cleared as a side effect.
    if (!original || !soundEnabled) return;
    // Play is authoritative: it must replace any delayed composition speech.
    // The prediction seed can resolve after this click, so clearing an
    // already-created timeout is not sufficient by itself. We also mark the
    // source phrase as directly spoken below, which makes a late timer no-op.
    if (compositionSpeakTimer.current) {
      clearTimeout(compositionSpeakTimer.current);
      compositionSpeakTimer.current = null;
    }

    // Prediction/correction strings are advisory. Play speaks exactly what
    // the user authored and never rewrites the message buffer. A correction
    // enters the buffer only through the visible explicit-accept button.
    const toSpeak = original;

    addToHistory(toSpeak);
    const ssState = useSettingsStore.getState();
    ddAction('aac.speak', { wordCount: toSpeak.split(/\s+/).length, language: ssState.language, outputLanguage: ssState.outputLanguage, autoApplied: false });
    recordConfirmedPhrase(toSpeak);

    // Speak is the strongest learning signal: the user just authoritatively
    // communicated this exact utterance. Reinforce every word and adjacent
    // pair/triple. We learn from the SOURCE-language text (what the user
    // typed), not the translation, since that's what they'll type next.
    learnUtterance(toSpeak);

    // Pre-mark trailing word so silence-detect doesn't re-speak it after
    // correction/translation effects re-run.
    const toSpeakTokens = toSpeak.split(/\s+/);
    lastSilenceSpokenRef.current = toSpeakTokens[toSpeakTokens.length - 1] || '';

    // Mark the source as directly spoken BEFORE any await, so a composition
    // timer that matures while the forced translation is in flight cannot
    // double-speak the phrase.
    lastAutoSpokenRef.current = {
      text: normalizeSpokenText(original),
      at: Date.now(),
    };

    // interrupt=true: Speak button always overrides any currently-playing audio,
    // regardless of PROTECT_PLAY_MS. This flag travels through aacSpeak→speak→speakAzure
    // as a parameter (not a shared flag) so concurrent autoSpeak calls can't steal it.
    const translating = useSettingsStore.getState().language !== useSettingsStore.getState().outputLanguage;
    if (!translating) {
      aacSpeak(toSpeak, speechRate, speechVolume, activeTone, true);
      return;
    }
    // Play is the "manual" half of the phrase-detected-or-manual translation
    // rule, so force the cloud refine here and give it a bounded window before
    // speaking. aacSpeak emits its highlight synchronously; the composition
    // timer is keyed to the SOURCE phrase, which is why lastAutoSpokenRef was
    // already marked above, before this await.
    void forceTranslateForSpeech().then((best) => {
      const spoken = best || translatedRef.current;
      if (spoken) {
        aacSpeak(spoken, speechRate, speechVolume, activeTone, true, outputLanguage as SupportedLanguage);
      } else {
        aacSpeak(toSpeak, speechRate, speechVolume, activeTone, true);
      }
      lastAutoSpokenRef.current = {
        text: normalizeSpokenText(original),
        at: Date.now(),
      };
    });
  }, [text, soundEnabled, speechRate, speechVolume, activeTone, addToHistory, learnUtterance, recordConfirmedPhrase, outputLanguage, forceTranslateForSpeech]);

  const cancelDelete = useCallback(() => {
    if (deleteTimer.current) { clearTimeout(deleteTimer.current); deleteTimer.current = null; }
  }, []);

  const handleDeleteDown = useCallback(() => {
    deleteTimer.current = setTimeout(() => {
      deleteFeedback();
      clearAll();
      deleteTimer.current = null;
    }, 1500);
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
  const hasVisibleMessageContent = Boolean(
    text.trim() || translated?.trim() || suggestion?.trim(),
  );

  return (
    <div
      data-scan-group="message-bar"
      data-content-state={hasVisibleMessageContent ? 'populated' : 'empty'}
      className={`flex items-center gap-[clamp(0.2rem,0.4vw,0.4rem)] mx-1 my-[1px] surface-bar rounded-xl px-[clamp(0.4rem,0.6vw,0.75rem)] shrink-0 relative border border-theme ${
        compact ? 'py-0' : 'py-[clamp(0.3rem,0.6svh,0.6rem)]'
      }`}
      style={{
        minHeight: compact
          ? 'clamp(44px, 13svh, 56px)'
          : isMessagingMode ? 'clamp(100px, 14svh, 180px)' : 'clamp(72px, 10svh, 132px)',
      }}
      data-compact={compact ? '1' : '0'}
      data-messaging-mode={isMessagingMode ? '1' : '0'}
    >
      {/* Quick toggle for auditory feedback ("Echo").
          It used to toggle `autoSpeak` and was labelled "Auto-speak", which
          after the speak-only change described behaviour that no longer
          exists: the message is never spoken automatically. Worse, because
          feedback defaults off, the button did NOTHING on a default install —
          verified by tapping a tile with it both on and off and getting
          silence either way. It now toggles the real feature flag, so the
          message bar and Settings are two surfaces on one concept. The
          toolbar speaker remains the master mute. */}
      {/* Three modes on one control, because AAC feature-matching expects a
          device to offer "speak after each word or sentence, or only when the
          entire message is selected" and the team picks per user. Tapping
          cycles off -> word -> sentence; no mode is reachable only from
          Settings. aria-pressed is deliberately absent: it is a binary state
          and would misreport a three-state control to a screen reader. */}
      <button
        onClick={() => {
          tapFeedback();
          updateSettings(speechFeedbackFlags(nextSpeechFeedbackMode(speechMode)));
        }}
        aria-label={
          speechMode === 'word' ? t('selection_feedback_on')
            : speechMode === 'sentence' ? t('selection_feedback_sentence')
              : t('selection_feedback_off')
        }
        data-testid="echo-toggle"
        data-speech-mode={speechMode}
        className={`aac-btn w-[clamp(2.75rem,5vw,4rem)] h-[clamp(2.75rem,5vw,4rem)] rounded-xl flex flex-col items-center justify-center shrink-0 border border-theme ${
          speechMode !== 'off' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-muted'
        }`}
      >
        <span className="text-[clamp(1rem,1.8vw,1.375rem)]">
          {speechMode === 'word' ? '🔊' : speechMode === 'sentence' ? '💬' : '🔈'}
        </span>
        <span className="text-[clamp(8px,0.8vw,11px)] mt-0.5">
          {speechMode === 'word' ? t('speech_mode_word')
            : speechMode === 'sentence' ? t('speech_mode_sentence')
              : t('echo')}
        </span>
      </button>

      {/* Tone selector — mirrors the Auto/Sound button:
          green-active when in 'auto' mode (adaptiveEngine picks tone), neutral
          when in 'manual' mode (user-picked tone forced). Click opens picker. */}
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

      <div data-testid="message-content" className={`flex-1 flex flex-col justify-center overflow-hidden ${
          isMessagingMode
            ? 'min-h-[clamp(96px,18svh,144px)]'
            : 'min-h-[clamp(72px,13svh,108px)]'
        }`}>
        <div
          data-testid="message-text"
          className={`text-[clamp(1rem,2.5vw,1.5rem)] leading-snug break-words text-primary whitespace-normal ${
            isMessagingMode
              ? 'line-clamp-4 min-h-[5em]'
              : 'line-clamp-3 min-h-[3.75em]'
          }`}
          role="status"
          aria-live="polite"
          aria-label={t('message_text')}
        >
          {!text && (
            <span
              data-testid="message-empty-prompt"
              className="aac-composer-empty-prompt"
              aria-hidden="true"
            >
              <span className="aac-composer-caret" aria-hidden="true" />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {t('type_here')}
              </span>
            </span>
          )}
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
              className="aac-btn text-left text-base md:text-lg text-[#4CAF50] mt-1 flex items-center gap-2 min-h-[36px] px-2 py-1 rounded-lg hover:bg-[rgba(76,175,80,0.1)]"
            >
              <span className="text-xl shrink-0">✅</span>
              <span className="font-semibold whitespace-normal break-words leading-snug">
                {suggestion}
              </span>
            </button>
          )}
        </div>
      </div>

      <button onClick={() => { tapFeedback(); undo(); }} aria-label={t('undo')} className="aac-btn w-[clamp(2.75rem,5vw,4rem)] h-[clamp(2.75rem,5vw,4rem)] rounded-xl surface-key text-muted text-[clamp(1rem,1.8vw,1.375rem)] flex items-center justify-center shrink-0 border border-theme">↩</button>

      <button onClick={handleSpeak} aria-label={t('speak')} className="aac-btn aac-speak w-[clamp(3.5rem,7vw,5.5rem)] h-[clamp(3.5rem,7vw,5.5rem)] rounded-xl bg-[#4CAF50] text-white text-[clamp(1.125rem,2vw,1.75rem)] flex items-center justify-center shrink-0">▶</button>

      <button
        onPointerDown={handleDeleteDown} onPointerUp={handleDeleteUp} onPointerLeave={cancelDelete} onPointerCancel={cancelDelete}
        aria-label={t('delete')} className="aac-btn aac-delete w-[clamp(3rem,5.5vw,4.5rem)] h-[clamp(3rem,5.5vw,4.5rem)] rounded-xl bg-[#F44336] text-white text-[clamp(1.125rem,2vw,1.75rem)] flex items-center justify-center shrink-0 select-none"
      >⌫</button>

      {/* Tone picker popup — "Auto" sentinel comes first as the default
          mode (matches README's auto tone-switch behavior). Selecting any
          specific tone flips toneMode to 'manual' (via setTone). */}
      {showTones && (
        <div
          className="absolute left-16 bottom-full mb-2 surface-bar border border-theme rounded-2xl p-2 z-50 shadow-xl"
          onKeyDown={(e) => { if (e.key === 'Escape') setShowTones(false); }}
        >
          <div className="grid grid-cols-3 gap-1.5" role="listbox">
            <button
              key="auto"
              onClick={() => { tapFeedback(); setToneMode('auto'); setShowTones(false); }}
              aria-pressed={toneMode === 'auto'}
              role="option"
              aria-selected={toneMode === 'auto'}
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
                role="option"
                aria-selected={toneMode === 'manual' && activeTone === tone.id}
                className={`aac-btn rounded-xl px-3 py-2 flex flex-col items-center border border-theme ${
                  toneMode === 'manual' && activeTone === tone.id ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                }`}
              >
                <span className="text-xl">{tone.icon}</span>
                <span className="text-[10px] mt-0.5">{tone.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
