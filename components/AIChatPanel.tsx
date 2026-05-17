'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { askAI, translateAI } from '@/services/aiService';
import { aacSpeak } from '@/services/aacSpeak';
import { useSettingsStore } from '@/store/settingsStore';
import { isVoiceInputSupported, startVoiceInput, VoiceSession } from '@/services/voiceInputService';
import { correctText } from '@/services/textCorrectService';
import { registerAISubmit, clearAISubmit } from '@/services/aiChatBridge';
import { checkCrisisSafety } from '@/services/crisisSafetyFilter';
import { estimateSpeechDurationMs } from '@/services/ttsHighlightBus';
import { startWakeWordDetection, isWakeWordSupported, WakeWordSession } from '@/services/wakeWordService';
import ColoredText from './ColoredText';
import BedsideOverlay from './BedsideOverlay';
import { useT } from '@/engine/useT';

/**
 * AI Chat — full-panel chat when sidePanel === 'ai-chat'.
 *
 * The user types on the shared keyboard, then presses the green Speak
 * button (which is intercepted via aiChatBridge) to send. No separate
 * "Ask AI" button — the Speak key IS the send key in this mode.
 * All available space belongs to the conversation.
 */

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  lines?: string[];
}

export default function AIChatPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { text, appendText, autoSpeak, soundEnabled } = useMessageStore();
  // Only subscribe to settings values used in the render or in stable callbacks.
  // language/outputLanguage are read via getState() inside handleAsk to avoid
  // recreating handleAsk on every settings change → which overflows React (#300).
  const speechRate = useSettingsStore((s) => s.speechRate);
  const speechVolume = useSettingsStore((s) => s.speechVolume);
  const language = useSettingsStore((s) => s.language); // used in voice input ttsCode + onFinal correctText
  const { t, ttsCode } = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const MAX_MESSAGES = 50;
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  // Bedside / hands-free / wake word state
  const [bedsideModeActive, setBedsideModeActive] = useState(false);
  const [handsFreeModeActive, setHandsFreeModeActive] = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const voiceRef = useRef<VoiceSession | null>(null);
  const askAbortRef = useRef<AbortController | null>(null);
  const handleAskRef = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);
  const handsFreeRef = useRef(false);
  const wakeWordSessionRef = useRef<WakeWordSession | null>(null);
  // Synchronous loading guard — prevents double-submission race that the React
  // state `loading` can't catch (setState is async; two taps can slip through
  // before the first re-render). Set to true synchronously at the top of
  // handleAsk; cleared at every exit path before setLoading(false).
  const isLoadingRef = useRef(false);
  // Track micError dismiss timers so we can clear them on unmount (avoids
  // setState-on-unmounted-component warnings and timer leaks).
  const micErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the 600 ms onSilence finalize delay so it can be cancelled on
  // unmount/panel-close — otherwise it fires after cleanup and calls handleAskRef
  // with stale refs (setListening, appendText, etc.).
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceSupported = isVoiceInputSupported();
  const wakeWordSupported = isWakeWordSupported();
  const activeRef = useRef(sidePanel === 'ai-chat');
  useEffect(() => {
    activeRef.current = sidePanel === 'ai-chat';
  }, [sidePanel]);
  useEffect(() => { handsFreeRef.current = handsFreeModeActive; }, [handsFreeModeActive]);

  // Scroll strategy: when streaming finishes, show the START of the AI
  // reply so the user reads top-down. During streaming: no scroll (user
  // can see the response beginning). New exchange: scroll to user message.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const justStarted = !wasLoadingRef.current && loading;
    const justFinished = wasLoadingRef.current && !loading;
    wasLoadingRef.current = loading;

    const rows = container.querySelectorAll<HTMLElement>(':scope > div');

    if (justStarted && rows.length > 0) {
      const userRow = rows.length >= 2 ? rows[rows.length - 2] : rows[rows.length - 1];
      userRow?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (justFinished && rows.length > 0) {
      const userRow = rows.length >= 2 ? rows[rows.length - 2] : rows[rows.length - 1];
      userRow?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (messages.length > 0 && !loading) {
      const userRow = rows[Math.max(0, rows.length - 2)];
      userRow?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [messages.length, loading]);

  const handleTapLine = useCallback(
    (line: string) => {
      tapFeedback();
      appendText(line);
      if (autoSpeak && soundEnabled) aacSpeak(line, speechRate, speechVolume);
    },
    [appendText, autoSpeak, soundEnabled, speechRate, speechVolume],
  );

  // ── startListening — extracted so effects and BedsideOverlay can call it ──
  const startListening = useCallback(() => {
    if (voiceRef.current || !isVoiceInputSupported()) return;
    let lastInterim = '';
    let submitted = false;
    const finalize = (finalText: string) => {
      if (submitted) return;
      submitted = true;
      const session = voiceRef.current;
      voiceRef.current = null;
      session?.stop();
      setListening(false);
      setInterim('');
      const trimmed = finalText.trim();
      if (!trimmed || !activeRef.current) return;
      void correctText(trimmed, language).then((fixed) => {
        if (!activeRef.current) return;
        // If hands-free restarted the mic while correctText was running
        // (can take up to 5s on a slow connection), discard this stale
        // finalize to avoid appending to a mid-capture voice session.
        if (voiceRef.current) return;
        appendText((fixed || trimmed) + ' ');
        setTimeout(() => { handleAskRef.current?.(); }, 80);
      });
    };
    const session = startVoiceInput({
      lang: ttsCode,
      silenceMs: 2500,
      onInterim: (tx) => { lastInterim = tx; setInterim(tx); },
      onFinal: (tx) => finalize(tx),
      onSilence: () => {
        if (!voiceRef.current || submitted) return;
        try { voiceRef.current.stop(); } catch { /* engine already stopped */ }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null;
          if (!submitted) finalize(lastInterim);
        }, 600);
      },
      onError: (err) => {
        if (submitted) return;
        voiceRef.current = null;
        setListening(false);
        setInterim('');
        // Map both native-bridge strings (denied, not-determined, …) and
        // WebSpeech API strings (not-allowed, audio-capture, network, …) to
        // human-readable messages so the user never sees a raw error code.
        const reason = err === 'denied' || err === 'not-allowed' || err === 'service-not-allowed'
          ? 'Microphone or Speech Recognition permission denied. Allow it in Settings → Privacy.'
          : err === 'not-determined'
          ? 'Microphone permission not granted yet. Tap mic and accept the prompt.'
          : err === 'unavailable' || err === 'language-not-supported'
          ? 'Speech recognition unavailable for the current language.'
          : err === 'audio-session-failed' || err === 'audio-engine-failed' || err === 'audio-capture'
          ? 'Microphone is busy (another app may be using it).'
          : err === 'ondevice-unavailable'
          ? 'On-device speech recognition unavailable (typical on iOS Simulator). Try a real device, or check internet connection for server-based recognition.'
          : err === 'network'
          ? 'Network error — check internet connection for speech recognition.'
          : `Mic error: ${err}`;
        setMicError(reason);
        if (micErrorTimerRef.current) clearTimeout(micErrorTimerRef.current);
        micErrorTimerRef.current = setTimeout(() => setMicError(null), 6000);
      },
    });
    if (session) {
      voiceRef.current = session;
      setListening(true);
    } else if (!voiceSupported) {
      setMicError('Voice input not available on this device.');
      if (micErrorTimerRef.current) clearTimeout(micErrorTimerRef.current);
      micErrorTimerRef.current = setTimeout(() => setMicError(null), 4000);
    }
  }, [language, ttsCode, appendText, voiceSupported]);
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  // Hands-free: auto-restart mic 1 s after the AI response completes.
  useEffect(() => {
    if (loading || !handsFreeModeActive || listening) return;
    const timer = setTimeout(() => {
      if (!voiceRef.current && handsFreeRef.current && activeRef.current) {
        startListeningRef.current?.();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [loading, handsFreeModeActive, listening]);

  // Wake word: run a background "Hey Prism" detector when idle.
  // Skipped when hands-free is on (auto-restart supersedes it) or
  // while the mic or AI is active (audio session conflict).
  useEffect(() => {
    if (!wakeWordActive || handsFreeModeActive || listening || loading) {
      wakeWordSessionRef.current?.stop();
      wakeWordSessionRef.current = null;
      return;
    }
    const session = startWakeWordDetection(ttsCode, () => {
      wakeWordSessionRef.current?.stop();
      wakeWordSessionRef.current = null;
      startListeningRef.current?.();
    });
    wakeWordSessionRef.current = session;
    return () => {
      session?.stop();
      wakeWordSessionRef.current = null;
    };
  }, [wakeWordActive, handsFreeModeActive, listening, loading, ttsCode]);

  const handleAsk = useCallback(async () => {
    // Using getState() rather than reactive text to avoid stale closure — reads latest text at submit time.
    // H14: strip Unicode control characters (bidirectional overrides, zero-width spaces, etc.)
    const question = useMessageStore.getState().text.trim().slice(0, 500)
      .replace(/[­؀-؅؜۝܏࣢᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻]/g, '');
    if (!question || isLoadingRef.current) return;
    // Set synchronously — prevents a rapid double-tap from passing the guard
    // on the next tick before React re-renders with loading=true. Must be set
    // here, before the crisis-filter branch, so even the synchronous fast-path
    // holds the lock long enough for the re-render to suppress the button.
    isLoadingRef.current = true;
    tapFeedback();

    // Cancel any previous in-flight stream before starting a new one.
    if (askAbortRef.current) askAbortRef.current.abort();
    const askController = new AbortController();
    askAbortRef.current = askController;

    // Layer 1 — deterministic crisis safety filter (synchronous, no network).
    const safety = checkCrisisSafety(question);
    if (!safety.safe) {
      useMessageStore.getState().setText('');
      setMessages((m) => [
        ...m,
        { id: Math.random().toString(36).slice(2), role: 'user' as const, text: question },
        { id: Math.random().toString(36).slice(2), role: 'ai' as const, text: safety.response, lines: safety.response.split('\n').filter(Boolean) },
      ].slice(-MAX_MESSAGES) as ChatMessage[]);
      isLoadingRef.current = false;
      // Speak crisis response immediately — nonverbal child cannot read the screen.
      // Must be after setMessages so TTS and UI update together, not before.
      if (useMessageStore.getState().soundEnabled) {
        const { speechRate: sr, speechVolume: sv } = useSettingsStore.getState();
        aacSpeak(safety.response, sr, sv, 'serious', true);
      }
      return;
    }

    // Clear the message bar immediately — next typed text is the follow-up.
    useMessageStore.getState().setText('');

    setMessages((m) => [
      ...m,
      { id: Math.random().toString(36).slice(2), role: 'user' as const, text: question },
      { id: Math.random().toString(36).slice(2), role: 'ai' as const, text: '', lines: [] },
    ].slice(-MAX_MESSAGES) as ChatMessage[]);
    setLoading(true);

    let buffer = '';
    let spokenUpTo = 0;
    let scheduled = false;
    const sentenceQueue: string[] = [];
    let speaking = false;
    let cancelled = false;
    let bufferIsCleanCrisisResponse = false;
    const queueTimers: ReturnType<typeof setTimeout>[] = [];

    const drainQueue = () => {
      if (cancelled) return;
      // Read live values via getState() — not the closure-captured ones from
      // callback creation time, which can be stale if the user mutes or
      // changes rate while a streaming response is already playing.
      const { soundEnabled: se } = useMessageStore.getState();
      const { speechRate: sr, speechVolume: sv } = useSettingsStore.getState();
      if (speaking || sentenceQueue.length === 0 || !se) return;
      speaking = true;
      const sentence = sentenceQueue.shift()!;
      const dur = estimateSpeechDurationMs(sentence, Math.max(0.1, sr) * 0.6) + 300;
      const timer = setTimeout(() => { if (!cancelled) { speaking = false; drainQueue(); } }, dur);
      // Push BEFORE aacSpeak so any crisis handler that clears queueTimers
      // synchronously during speech teardown always finds this timer in the array.
      queueTimers.push(timer);
      if (!cancelled) aacSpeak(sentence, sr, sv, undefined, true);
    };

    const enqueueSentence = (sentence: string) => {
      if (!sentence.trim()) return;
      // Apply crisis filter per-sentence before TTS — flush() runs on a
      // requestAnimationFrame tick AFTER onChunk, so a jailbroken model
      // streaming a harmful sentence would speak it before the full-buffer
      // check in flush() fires. Check here to intercept at enqueue time.
      const sentenceSafety = checkCrisisSafety(sentence);
      if (!sentenceSafety.safe) {
        cancelled = true;
        queueTimers.forEach(clearTimeout);
        buffer = sentenceSafety.response;
        bufferIsCleanCrisisResponse = true;
        // flush() reads askController.signal.aborted — call it BEFORE abort()
        // so the crisis response is actually rendered. abort() terminates the stream.
        flush();
        // Speak crisis response — nonverbal child cannot read the screen.
        if (useMessageStore.getState().soundEnabled) {
          const { speechRate: sr, speechVolume: sv } = useSettingsStore.getState();
          aacSpeak(sentenceSafety.response, sr, sv, 'serious', true);
        }
        askController.abort();
        return;
      }
      sentenceQueue.push(sentence.trim());
      drainQueue();
    };

    const checkNewSentences = () => {
      const unspoken = buffer.slice(spokenUpTo);
      const re = /[.!?。！？]\s/g;
      let match: RegExpExecArray | null;
      let lastEnd = 0;
      const sentences: string[] = [];
      let prev = 0;
      while ((match = re.exec(unspoken)) !== null) {
        sentences.push(unspoken.slice(prev, match.index + 1));
        prev = match.index + match[0].length;
        lastEnd = prev;
      }
      if (lastEnd > 0) {
        spokenUpTo += lastEnd;
        for (const s of sentences) enqueueSentence(s);
      }
    };

    const flush = () => {
      if (!activeRef.current) return;
      if (askController.signal.aborted) return;
      scheduled = false;
      const tx = buffer;
      // Skip re-check when buffer is already the crisis response — the text contains
      // "call 911" / "988" which would re-trigger the filter and waste 100+ regex evals.
      const safeguard = bufferIsCleanCrisisResponse ? { safe: true as const } : checkCrisisSafety(tx);
      const safeText = safeguard.safe ? tx : safeguard.response;
      const lines = safeText.split(/\n+/).filter((l) => l.trim());
      setMessages((prev) => {
        const updated = prev.slice();
        updated[updated.length - 1] = { ...updated[updated.length - 1], role: 'ai', text: safeText, lines };
        return updated;
      });
    };

    try {
      const outputLang = useSettingsStore.getState().outputLanguage;
      const inputLang = useSettingsStore.getState().language || language;
      const needsTranslation = !!(outputLang && inputLang && outputLang !== inputLang);
      const targetLang = needsTranslation ? outputLang : (outputLang || inputLang);

      const onChunk = (delta: string) => {
        if (cancelled) return;
        if (buffer.length < 32_000) {
          buffer += delta;
        } else if (!buffer.endsWith('…')) {
          buffer += '…';
        }
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(flush);
        }
        checkNewSentences();
      };

      let responseText = '';
      if (needsTranslation) {
        responseText = await translateAI(question, inputLang, outputLang, onChunk, askController.signal);
      } else {
        const response = await askAI(question, undefined, onChunk, targetLang, askController.signal);
        responseText = response?.text ?? '';
      }
      // Fallback for non-streaming providers (local Ollama path uses stream:false
      // and never calls onChunk). Without this, the AI bubble renders empty even
      // though askAI returned a full response. Treat the full return value as
      // one big chunk arriving at the end.
      if (!buffer && responseText) {
        buffer = responseText;
      }
      if (!askController.signal.aborted && !cancelled) {
        flush();
        const tail = buffer.slice(spokenUpTo).trim();
        if (tail) enqueueSentence(tail);
      }
    } catch (e: unknown) {
      cancelled = true;
      queueTimers.forEach(clearTimeout);
      if (askController.signal.aborted) {
        isLoadingRef.current = false;
        setLoading(false);
        return;
      }
      console.warn('[ai-chat] request failed:', e instanceof Error ? e.message : e);
      const msg = t('could_not_reach_ai');
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], role: 'ai', text: msg, lines: [msg] };
        return updated;
      });
    }
    // If the request was superseded (new ask started) or panel closed while
    // the fetch was still running, stop TTS and bail without updating state.
    if (askController.signal.aborted) {
      cancelled = true;
      queueTimers.forEach(clearTimeout);
      isLoadingRef.current = false;
      setLoading(false);
      return;
    }
    if (askAbortRef.current === askController) askAbortRef.current = null;
    if (!activeRef.current) {
      cancelled = true;
      queueTimers.forEach(clearTimeout);
      isLoadingRef.current = false;
      setLoading(false);
      return;
    }
    isLoadingRef.current = false;
    setLoading(false);
  // loading removed from deps — guard uses isLoadingRef (synchronous, no stale closure).
  // language/outputLanguage removed from deps — read via getState() inside the callback.
  }, [t]);
  useEffect(() => { handleAskRef.current = handleAsk; }, [handleAsk]);

  // Register / clear the Speak-button intercept for this panel's lifetime.
  // Use the stable ref so bridge re-registration doesn't happen on every
  // loading state flip — a gap between clearAISubmit and registerAISubmit
  // would swallow a Speak event on a safety-critical communication device.
  useEffect(() => {
    if (sidePanel !== 'ai-chat') { clearAISubmit(); return; }
    registerAISubmit(() => handleAskRef.current?.());
    return () => clearAISubmit();
  }, [sidePanel]);

  // Stop voice and abort in-flight AI request when panel closes.
  // Also reset bedside/hands-free/wake-word state so re-opening the panel
  // doesn't auto-trigger the mic without the user's intent.
  useEffect(() => {
    if (sidePanel !== 'ai-chat') {
      askAbortRef.current?.abort();
      askAbortRef.current = null;
      wakeWordSessionRef.current?.stop();
      wakeWordSessionRef.current = null;
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      if (voiceRef.current) {
        voiceRef.current.stop();
        voiceRef.current = null;
        setListening(false);
        setInterim('');
      }
      setBedsideModeActive(false);
      setHandsFreeModeActive(false);
      setWakeWordActive(false);
    }
  }, [sidePanel]);

  // Stop voice, abort in-flight AI request, and reset scroll-tracking ref on unmount.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      askAbortRef.current?.abort();
      askAbortRef.current = null;
      wakeWordSessionRef.current?.stop();
      wakeWordSessionRef.current = null;
      voiceRef.current?.stop();
      voiceRef.current = null;
      wasLoadingRef.current = false;
      if (micErrorTimerRef.current) clearTimeout(micErrorTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  if (sidePanel !== 'ai-chat') return null;

  const toggleVoice = () => {
    tapFeedback();
    if (voiceRef.current) {
      // Cancel the 600 ms silence finalize before stopping the session so it
      // cannot fire after the user has explicitly dismissed the mic.
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      voiceRef.current.stop();
      voiceRef.current = null;
      setListening(false);
      setInterim('');
      return;
    }
    startListening();
  };

  const lastAIMessage = [...messages].reverse().find((m) => m.role === 'ai') ?? null;

  return (
    <>
      {bedsideModeActive && (
        <BedsideOverlay
          listening={listening}
          loading={loading}
          interim={interim}
          handsFreeModeActive={handsFreeModeActive}
          wakeWordActive={wakeWordActive}
          wakeWordSupported={wakeWordSupported}
          lastAIText={lastAIMessage?.text ?? ''}
          lastAILines={lastAIMessage?.lines ?? []}
          onToggleVoice={toggleVoice}
          onSetHandsFree={setHandsFreeModeActive}
          onSetWakeWord={setWakeWordActive}
          onTapLine={handleTapLine}
          onClose={() => setBedsideModeActive(false)}
        />
      )}
      <section
        aria-label={t('ai_chat_title')}
        aria-busy={loading}
        className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme"
        data-testid="ai-chat-panel"
        data-state="expanded"
      >
        {micError && (
          <div
            role="alert"
            data-testid="ai-mic-error"
            className="bg-[#F44336] text-white text-sm font-semibold px-3 py-2 text-center shrink-0"
          >
            {micError}
          </div>
        )}
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
          <span className="text-primary font-bold text-xl">✨ {t('ai_chat_title')}</span>
          <div className="flex items-center gap-2">
            {/* Hands-free toggle */}
            <button
              onClick={() => { tapFeedback(); setHandsFreeModeActive((v) => !v); }}
              aria-label={handsFreeModeActive ? 'Disable hands-free mode' : 'Enable hands-free mode'}
              aria-pressed={handsFreeModeActive}
              data-testid="ai-hands-free"
              title="Hands-free: mic auto-restarts after each AI response"
              className={`aac-btn rounded-lg text-base px-2.5 h-9 flex items-center justify-center ${
                handsFreeModeActive
                  ? 'bg-[#4CAF50] text-white'
                  : 'surface-key text-muted border border-theme'
              }`}
            >
              🔁
            </button>
            {/* Bedside mode button */}
            <button
              onClick={() => { tapFeedback(); setBedsideModeActive((v) => !v); }}
              aria-label="Open Bedside Mode"
              aria-pressed={bedsideModeActive}
              data-testid="ai-bedside"
              title="Bedside Mode: full-screen, hands-free, for phone-in-stand use"
              className="aac-btn rounded-lg text-base px-2.5 h-9 flex items-center justify-center surface-key text-muted border border-theme"
            >
              🛏
            </button>
            {/* Mic button */}
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                aria-label={listening ? t('stop_voice') : t('start_voice')}
                aria-pressed={listening}
                data-testid="ai-mic"
                className={`aac-btn rounded-lg font-bold text-xl px-3 h-9 flex items-center justify-center ${
                  listening
                    ? 'bg-[#F44336] text-white animate-pulse'
                    : 'surface-key text-primary border border-theme'
                }`}
              >
                {listening ? '⏺' : '🎙'}
              </button>
            )}
            <button
              onClick={() => { tapFeedback(); closeSidePanel(); }}
              aria-label={t('close_ai_chat')}
              className="aac-btn w-9 h-9 rounded-lg surface-key text-muted text-lg flex items-center justify-center border border-theme"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Typed-input preview — MessageBar is hidden globally in ai-chat mode
            (PrismApp.tsx suppresses it), so without this strip the user types
            into the void: keys land in useMessageStore but nothing displays.
            The strip is read-only here; Keyboard's existing Backspace already
            mutates messageStore. */}
        <div
          className="shrink-0 px-4 py-2 border-b border-theme bg-black/5 dark:bg-white/5"
          data-testid="ai-chat-input-preview"
        >
          <p
            className="text-xl text-primary leading-snug min-h-[1.75rem] break-words"
            aria-label={t('current_message')}
          >
            {text || (
              <span className="text-muted text-base italic">{t('type_or_speak')}</span>
            )}
            {text && <span className="text-muted animate-pulse">▎</span>}
          </p>
        </div>

        {/* Chat scroll area */}
        <div ref={scrollRef} aria-live="polite" aria-atomic="false" className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted px-6">
              <span className="text-5xl">✨</span>
              <p className="text-lg font-medium">{t('ai_chat_title')}</p>
              <p className="text-base opacity-70">
                {listening
                  ? interim || t('type_or_speak')
                  : wakeWordActive
                  ? 'Say "Hey Prism" to start'
                  : t('type_or_speak')}
              </p>
              <p className="text-sm opacity-50 mt-1">
                Press <strong>Speak</strong> to send your question
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'ml-8' : 'mr-4'}>
              <div
                className={`rounded-xl p-3 border border-theme ${
                  msg.role === 'user'
                    ? 'bg-[#dbeafe] text-[#14161d] dark:bg-[#2a3a5e] dark:text-[#e0e0e0]'
                    : 'surface-key'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-xl">{msg.text}</p>
                ) : (
                  <div className="space-y-2">
                    {(msg.lines ?? [msg.text]).map((line, li) => (
                      <button
                        key={`line-${msg.id}-${li}`}
                        onClick={() => handleTapLine(line)}
                        aria-label={`Use: ${line}`}
                        className="aac-btn block w-full text-left rounded-lg p-2 hover:bg-black/5 transition-colors"
                      >
                        <ColoredText text={line} className="text-xl leading-relaxed" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-dim text-sm mt-1 px-1">
                {msg.role === 'user' ? t('you') : t('ai_chat')}
              </p>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-muted text-xl px-2">
              <span className="animate-pulse">{t('thinking')}</span>
            </div>
          )}
        </div>

        {/* Status bar — wake word / hands-free indicators */}
        {(wakeWordActive || handsFreeModeActive) && !listening && !loading && (
          <div className="shrink-0 px-4 py-1.5 border-t border-theme flex items-center gap-3 text-sm text-muted">
            {wakeWordActive && <span>🎯 Listening for &ldquo;Hey Prism&rdquo;</span>}
            {handsFreeModeActive && <span>🔁 Hands-free on</span>}
          </div>
        )}

        {/* Interim voice hint — only when listening */}
        {listening && interim && (
          <div className="shrink-0 px-4 py-2 border-t border-theme text-[#4CAF50] text-base text-center truncate">
            🎙 &ldquo;{interim.slice(0, 200)}{interim.length > 200 ? '…' : ''}&rdquo;
          </div>
        )}
      </section>
    </>
  );
}
