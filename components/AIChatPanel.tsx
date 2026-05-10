'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { askAI, translateAI } from '@/services/aiService';
import { speak } from '@/services/speechService';
import { getTTSCode, SupportedLanguage } from '@/engine/i18n';
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
  const { speechRate, speechVolume, language, outputLanguage } = useSettingsStore();
  const isTranslatorMode = language !== outputLanguage;
  const { t, ttsCode } = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const voiceRef = useRef<VoiceSession | null>(null);
  const voiceSupported = isVoiceInputSupported();

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
    const question = useMessageStore.getState().text.trim();
    if (!question || loading) return;
    tapFeedback();

    // Layer 1 — deterministic crisis safety filter (synchronous, no network).
    const safety = checkCrisisSafety(question);
    if (!safety.safe) {
      useMessageStore.getState().setText('');
      setMessages((m) => [
        ...m,
        { role: 'user', text: question },
        { role: 'ai', text: safety.response, lines: safety.response.split('\n').filter(Boolean) },
      ]);
      return;
    }

    // Clear the message bar immediately — next typed text is the follow-up.
    useMessageStore.getState().setText('');

    setMessages((m) => [
      ...m,
      { role: 'user', text: question },
      { role: 'ai', text: '', lines: [] },
    ]);
    setLoading(true);

    let buffer = '';
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      const t = buffer;
      const lines = t.split(/\n+/).filter((l) => l.trim());
      setMessages((prev) => {
        const updated = prev.slice();
        updated[updated.length - 1] = { role: 'ai', text: t, lines };
        return updated;
      });
    };

    try {
      if (isTranslatorMode) {
        await translateAI(question, language, outputLanguage, (delta) => {
          buffer += delta;
          if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
        });
        flush();
        // Speak the translation directly in the output language.
        // speak() bypasses aacSpeak's offline re-translate (which would treat
        // the already-translated text as input-language — wrong direction).
        const finalText = buffer.trim();
        if (finalText && soundEnabled) {
          speak(finalText, speechRate, speechVolume, getTTSCode(outputLanguage as SupportedLanguage), 'auto', true).catch(() => {});
        }
      } else {
        await askAI(question, undefined, (delta) => {
          buffer += delta;
          if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
        }, language);
        flush();
        // Regular AI chat: do NOT auto-speak — user taps lines to insert/speak them.
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('could_not_reach_ai');
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: msg, lines: [msg] };
        return updated;
      });
    }
    setLoading(false);
  }, [loading, language, outputLanguage, isTranslatorMode, soundEnabled, speechRate, speechVolume, t]);

  // Register / clear the Speak-button intercept for this panel's lifetime.
  useEffect(() => {
    if (sidePanel === 'ai-chat') {
      registerAISubmit(handleAsk);
    }
    return () => clearAISubmit();
  }, [sidePanel, handleAsk]);

  // Stop voice when panel closes.
  useEffect(() => {
    if (sidePanel !== 'ai-chat' && voiceRef.current) {
      voiceRef.current.stop();
      voiceRef.current = null;
      setListening(false);
      setInterim('');
    }
  }, [sidePanel]);

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
      className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme"
      data-testid="ai-chat-panel"
      data-state="expanded"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-xl">
          {isTranslatorMode
            ? `🔄 ${language.toUpperCase()} → ${outputLanguage.toUpperCase()}`
            : `✨ ${t('ai_chat_title')}`}
        </span>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted px-6">
            <span className="text-5xl">{isTranslatorMode ? '🔄' : '✨'}</span>
            <p className="text-lg font-medium">
              {isTranslatorMode
                ? `Translator: ${language.toUpperCase()} → ${outputLanguage.toUpperCase()}`
                : t('ai_chat_title')}
            </p>
            <p className="text-base opacity-70">
              {listening
                ? interim || t('type_or_speak')
                : t('type_or_speak')}
            </p>
            <p className="text-sm opacity-50 mt-1">
              Press <strong>Speak</strong> to {isTranslatorMode ? 'translate' : 'send your question'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'ml-8' : 'mr-4'}>
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
                      key={li}
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
          🎙 &ldquo;{interim}&rdquo;
        </div>
      )}
    </section>
  );
}
