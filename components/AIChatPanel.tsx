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
import { registerAISubmit, clearAISubmit } from '@/services/aiChatBridge';
import { checkCrisisSafety } from '@/services/crisisSafetyFilter';
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
  const { speechRate, speechVolume, language } = useSettingsStore();
  const { t, ttsCode } = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const MAX_MESSAGES = 50;
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const voiceRef = useRef<VoiceSession | null>(null);
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

    const justFinished = wasLoadingRef.current && !loading;
    wasLoadingRef.current = loading;

    if (justFinished && messages.length > 0) {
      // Stream done — scroll AI reply to the top of the view.
      const rows = container.querySelectorAll(':scope > div');
      const aiRow = rows[rows.length - 1] as HTMLElement | undefined;
      aiRow?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (messages.length > 0 && !loading) {
      // New user message just added — show it at the top.
      const rows = container.querySelectorAll(':scope > div');
      const userRow = rows[Math.max(0, rows.length - 2)] as HTMLElement | undefined;
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
    let scheduled = false;
    const flush = () => {
      if (!activeRef.current) return;  // panel no longer active
      if (askController.signal.aborted) return;  // request was cancelled
      scheduled = false;
      const t = buffer;
      // Post-check AI response for crisis content (model jailbreak defense).
      // H13: check FULL response — do not sample edges (injected content in middle is missed)
      const checkText = t; // was: t.length <= 2000 ? t : t.slice(0, 500) + ' ' + t.slice(-500)
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
      await askAI(question, undefined, (delta) => {
        // Cap at 32KB — sufficient for any AAC clinical exchange.
        // The service-level cap is 1MB (STREAM_CAP_BYTES); this is a UI guard.
        // Truncation is indicated by '…' appended to buffer.
        if (buffer.length < 32_000) {
          buffer += delta;
        } else if (!buffer.endsWith('…')) {
          buffer += '…';  // mark truncation
        }
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(flush);
        }
      }, language);
      flush();
    } catch (e: unknown) {
      if (askController.signal.aborted) {
        // Request was intentionally cancelled (panel closed) — don't update UI.
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
  }, [loading, language, t]);

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
      voiceRef.current.stop();
      voiceRef.current = null;
      setListening(false);
      setInterim('');
      return;
    }
    const session = startVoiceInput({
      lang: ttsCode,
      onInterim: (t) => setInterim(t),
      onFinal: async (t) => {
        const fixed = await correctText(t.trim(), language);
        if (!voiceRef.current) return;  // panel closed while awaiting
        appendText((fixed || t).trim() + ' ');
        setInterim('');
      },
      onError: () => {
        setListening(false);
        setInterim('');
        voiceRef.current = null;
      },
    });
    if (session) {
      voiceRef.current = session;
      setListening(true);
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
