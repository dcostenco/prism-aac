'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { askAI } from '@/services/aiService';
import { aacSpeak } from '@/services/aacSpeak';
import { useSettingsStore } from '@/store/settingsStore';
import { isVoiceInputSupported, startVoiceInput, VoiceSession } from '@/services/voiceInputService';
import { correctText } from '@/services/textCorrectService';
import { registerAISubmit, clearAISubmit, triggerAISubmit } from '@/services/aiChatBridge';
import { checkCrisisSafety } from '@/services/crisisSafetyFilter';
import { estimateSpeechDurationMs } from '@/services/ttsHighlightBus';
import ColoredText from './ColoredText';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const voiceRef = useRef<VoiceSession | null>(null);
  // Lifted out of toggleVoice scope so the stop-tap branch can also access
  // the last interim transcript to submit on stop.
  const lastInterimRef = useRef('');
  const voiceSubmittedRef = useRef(false);
  const voiceFinalizeRef = useRef<((text: string) => void) | null>(null);
  const askAbortRef = useRef<AbortController | null>(null);
  const voiceSupported = isVoiceInputSupported();
  const activeRef = useRef(sidePanel === 'ai-chat');
  useEffect(() => {
    activeRef.current = sidePanel === 'ai-chat';
  }, [sidePanel]);

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
      // Stream just started — scroll so user message + AI reply are both visible.
      const userRow = rows.length >= 2 ? rows[rows.length - 2] : rows[rows.length - 1];
      userRow?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (justFinished && rows.length > 0) {
      // Stream done — show from user message so full exchange is visible.
      const userRow = rows.length >= 2 ? rows[rows.length - 2] : rows[rows.length - 1];
      userRow?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (messages.length > 0 && !loading) {
      // New user message just added (no active stream) — show it at top.
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

  const handleAsk = useCallback(async () => {
    // Using getState() rather than reactive text to avoid stale closure — reads latest text at submit time.
    // H14: strip Unicode control characters (bidirectional overrides, zero-width spaces, etc.)
    const question = useMessageStore.getState().text.trim().slice(0, 500)
      .replace(/[\u00ad\u0600-\u0605\u061c\u06dd\u070f\u08e2\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb]/g, '');
    if (!question || loading) return;
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
        { role: 'user' as const, text: question },
        { role: 'ai' as const, text: safety.response, lines: safety.response.split('\n').filter(Boolean) },
      ]);
      return;
    }

    // Clear the message bar immediately — next typed text is the follow-up.
    useMessageStore.getState().setText('');

    setMessages((m) => [
      ...m,
      { role: 'user' as const, text: question },
      { role: 'ai' as const, text: '', lines: [] },
    ].slice(-MAX_MESSAGES) as ChatMessage[]);
    setLoading(true);

    let buffer = '';
    let spokenUpTo = 0;
    let scheduled = false;
    const sentenceQueue: string[] = [];
    let speaking = false;
    const queueTimers: ReturnType<typeof setTimeout>[] = [];

    // Do NOT override spokenLang for AI streaming speech. The AI may respond
    // in any language (native 1.7B on iOS often responds in English even when
    // prompted in Russian). Let aacSpeak detect the language naturally via its
    // translation/script-detection logic — same as the non-streaming tap path
    // on line 89 which passes no spokenLang and works correctly.

    const drainQueue = () => {
      if (speaking || sentenceQueue.length === 0 || !soundEnabled) return;
      speaking = true;
      const sentence = sentenceQueue.shift()!;
      // interrupt=true required: PROTECT_PLAY_MS (azureTTS.ts:417) drops any
      // non-interrupt aacSpeak call while another source has played <600ms.
      // Streaming sentences arrive in tight succession and were being silently
      // dropped — chat text appeared on screen but audio stayed silent.
      // Each sentence is gated behind its own duration timer, so we DO want
      // interrupt semantics: the previous source has finished (per timer).
      aacSpeak(sentence, speechRate, speechVolume, undefined, true);
      const dur = estimateSpeechDurationMs(sentence, speechRate * 0.6) + 300;
      const timer = setTimeout(() => { speaking = false; drainQueue(); }, dur);
      queueTimers.push(timer);
    };

    const enqueueSentence = (sentence: string) => {
      if (!sentence.trim()) return;
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
      const t = buffer;
      const checkText = t;
      const safety = checkCrisisSafety(checkText);
      const safeText = safety.safe ? t : safety.response;
      const lines = safeText.split(/\n+/).filter((l) => l.trim());
      setMessages((prev) => {
        const updated = prev.slice();
        updated[updated.length - 1] = { role: 'ai', text: safeText, lines };
        return updated;
      });
    };

    try {
      const response = await askAI(question, undefined, (delta) => {
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
      }, useSettingsStore.getState().outputLanguage || useSettingsStore.getState().language);
      // Fallback for non-streaming providers (local Ollama path uses stream:false
      // and never calls onChunk). Without this, the AI bubble renders empty even
      // though askAI returned a full response. Treat the full return value as
      // one big chunk arriving at the end.
      if (!buffer && response?.text) {
        buffer = response.text;
      }
      flush();
      const tail = buffer.slice(spokenUpTo).trim();
      if (tail) enqueueSentence(tail);
    } catch (e: unknown) {
      queueTimers.forEach(clearTimeout);
      if (askController.signal.aborted) {
        return;
      }
      console.warn('[ai-chat] request failed:', e instanceof Error ? e.message : e);
      const msg = t('could_not_reach_ai');
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: msg, lines: [msg] };
        return updated;
      });
    }
    if (askAbortRef.current === askController) askAbortRef.current = null;
    if (!activeRef.current) return;
    setLoading(false);
  // language/outputLanguage removed from deps — read via getState() inside
  // the callback to avoid recreating handleAsk on every settings change.
  }, [loading, t]);

  // Register / clear the Speak-button intercept for this panel's lifetime.
  useEffect(() => {
    if (sidePanel === 'ai-chat') {
      registerAISubmit(handleAsk);
    }
    return () => clearAISubmit();
  }, [sidePanel, handleAsk]);

  // Stop voice and abort in-flight AI request when panel closes.
  useEffect(() => {
    if (sidePanel !== 'ai-chat') {
      askAbortRef.current?.abort();
      askAbortRef.current = null;
      if (voiceRef.current) {
        voiceRef.current.stop();
        voiceRef.current = null;
        setListening(false);
        setInterim('');
      }
    }
  }, [sidePanel]);

  // Stop voice, abort in-flight AI request, and reset scroll-tracking ref on unmount.
  useEffect(() => {
    return () => {
      askAbortRef.current?.abort();
      askAbortRef.current = null;
      voiceRef.current?.stop();
      voiceRef.current = null;
      wasLoadingRef.current = false;  // prevent stale justFinished scroll on remount
    };
  }, []);

  if (sidePanel !== 'ai-chat') return null;

  const toggleVoice = () => {
    tapFeedback();
    if (voiceRef.current) {
      // Stop tap: if user has spoken anything, submit it. Otherwise just cancel.
      voiceRef.current.stop();
      const pending = lastInterimRef.current.trim();
      if (pending && !voiceSubmittedRef.current && voiceFinalizeRef.current) {
        voiceFinalizeRef.current(pending);
      } else {
        voiceRef.current = null;
        setListening(false);
        setInterim('');
      }
      return;
    }
    // Track the last interim so we can fall back to it if the engine
    // ends the session WITHOUT producing a final result. Some browsers
    // emit interims then end without finalizing when rec.stop() is called
    // mid-utterance, which would otherwise discard everything the user said.
    lastInterimRef.current = '';
    voiceSubmittedRef.current = false;
    const finalize = (text: string) => {
      if (voiceSubmittedRef.current) return;
      voiceSubmittedRef.current = true;
      voiceRef.current = null;
      setListening(false);
      setInterim('');
      const trimmed = text.trim();
      if (!trimmed || !activeRef.current) return;
      void correctText(trimmed, language).then((fixed) => {
        if (!activeRef.current) return;
        appendText((fixed || trimmed) + ' ');
        setTimeout(() => { if (activeRef.current) triggerAISubmit(); }, 80);
      });
    };
    voiceFinalizeRef.current = finalize;
    const session = startVoiceInput({
      lang: ttsCode,
      silenceMs: 2500,  // give the user time to actually finish a phrase
      onInterim: (t) => {
        lastInterimRef.current = t;
        setInterim(t);
      },
      onFinal: (t) => finalize(t),
      // Silence detected after speech started. Stop the recognition
      // (which causes the engine to emit a final result if it has one),
      // then wait briefly. If onFinal fires, it submits. If it doesn't
      // (some engines skip the final on rec.stop()), use the last interim.
      onSilence: () => {
        if (!voiceRef.current || voiceSubmittedRef.current) return;
        try { voiceRef.current.stop(); } catch { /* engine already stopped */ }
        setTimeout(() => {
          if (!voiceSubmittedRef.current) finalize(lastInterimRef.current);
        }, 600);
      },
      onError: (err) => {
        if (voiceSubmittedRef.current) return;
        voiceRef.current = null;
        setListening(false);
        setInterim('');
        // Surface the failure code so the user knows WHY mic didn't work.
        // Code values come from the native bridge (denied / restricted /
        // not-determined / unavailable / audio-session-failed /
        // audio-engine-failed / recognition-failed / invalid-language /
        // timeout) or the Web Speech API errors.
        const reason = err === 'denied'
          ? 'Microphone or Speech Recognition permission denied. Allow it in Settings → Privacy.'
          : err === 'not-determined'
          ? 'Microphone permission not granted yet. Tap mic and accept the prompt.'
          : err === 'unavailable'
          ? 'Speech recognition unavailable for the current language.'
          : err === 'audio-session-failed' || err === 'audio-engine-failed'
          ? 'Microphone is busy (another app may be using it).'
          : err === 'ondevice-unavailable'
          ? 'On-device speech recognition unavailable (typical on iOS Simulator). Try a real device, or check internet connection for server-based recognition.'
          : `Mic error: ${err}`;
        setMicError(reason);
        setTimeout(() => setMicError(null), 6000);
      },
    });
    if (session) {
      voiceRef.current = session;
      setListening(true);
    } else if (!voiceSupported) {
      setMicError('Voice input not available on this device.');
      setTimeout(() => setMicError(null), 4000);
    }
  };

  return (
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
                : t('type_or_speak')}
            </p>
            <p className="text-sm opacity-50 mt-1">
              Press <strong>Speak</strong> to send your question
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}-${msg.text.slice(0, 8)}`} className={msg.role === 'user' ? 'ml-8' : 'mr-4'}>
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
                      key={`line-${li}-${line.slice(0, 12)}`}
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

      {/* Interim voice hint — only when listening */}
      {listening && interim && (
        <div className="shrink-0 px-4 py-2 border-t border-theme text-[#4CAF50] text-base text-center truncate">
          🎙 &ldquo;{interim.slice(0, 200)}{interim.length > 200 ? '…' : ''}&rdquo;
        </div>
      )}
    </section>
  );
}
