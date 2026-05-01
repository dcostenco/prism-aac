'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { askAI } from '@/services/aiService';
import { speakWord } from '@/services/speechService';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { isVoiceInputSupported, startVoiceInput, VoiceSession } from '@/services/voiceInputService';
import { correctText } from '@/services/textCorrectService';
import ColoredText from './ColoredText';
import { useT } from '@/engine/useT';

/**
 * AI Chat — inline panel docked above the keyboard.
 *
 * Renders as a flex child between PredictionBar and Keyboard, taking all the
 * remaining vertical space. The user keeps typing on the same soft keyboard
 * (no separate input field), text appears in the shared MessageBar, and the
 * AI conversation occupies the panel above. Tapping any AI line copies it to
 * the message bar (preserves authorship — Valencia et al., CHI 2023).
 */

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  lines?: string[];
}

export default function AIChatPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { text, appendText, clearAll, autoSpeak, soundEnabled } = useMessageStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const profile = useAuthStore((s) => s.profile);
  const { ttsCode } = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const voiceSupported = isVoiceInputSupported();
  const configured = !!profile;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleTapLine = useCallback(
    (line: string) => {
      tapFeedback();
      appendText(line);
      if (autoSpeak && soundEnabled) speakWord(line, speechRate, speechVolume, ttsCode);
    },
    [appendText, autoSpeak, soundEnabled, speechRate, speechVolume, ttsCode],
  );

  // Stop listening when modal closes.
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
      lang: language,
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

  const handleAsk = async () => {
    const question = text.trim();
    if (!question) return;
    tapFeedback();

    setMessages((m) => [
      ...m,
      { role: 'user', text: question },
      { role: 'ai', text: '', lines: [] },
    ]);
    setLoading(true);

    // Accumulate streamed text outside React state and flush at most once per
    // animation frame. Avoids 1 setState per chunk (the prior pattern caused
    // hundreds of full-tree re-renders on long responses).
    let buffer = '';
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      const text = buffer;
      const lines = text.split(/\n+/).filter((l) => l.trim());
      setMessages((prev) => {
        const updated = prev.slice();
        updated[updated.length - 1] = { role: 'ai', text, lines };
        return updated;
      });
    };

    try {
      await askAI(question, undefined, (delta) => {
        buffer += delta;
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(flush);
        }
      });
      flush();
      clearAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not reach AI';
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: msg, lines: [msg] };
        return updated;
      });
    }
    setLoading(false);
  };

  return (
    <section
      aria-label="AI Chat"
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
      data-testid="ai-chat-panel"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-2xl md:text-3xl">✨ AI Chat</span>
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label="Close AI chat"
          className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme"
        >
          ✕
        </button>
      </header>

      {!configured ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-primary font-bold text-2xl md:text-3xl mb-4">AI Chat requires a Synalux account.</p>
          <p className="text-muted text-lg md:text-xl mb-3">Sign in via Settings to enable AI Chat, web search, and all platform modules.</p>
          <p className="text-dim text-base md:text-lg">Core AAC features (keyboard, categories, predictions) work without an account.</p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-muted text-center py-6">
                <p className="text-xl md:text-2xl mb-2">Type a question on the keyboard, then tap</p>
                <p className="text-[#4CAF50] font-bold text-2xl md:text-3xl">Ask AI ✨</p>
                <p className="mt-3 text-base md:text-lg text-dim">Tap any AI response to add it to your message.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'ml-8' : 'mr-4'}>
                <div
                  className={`rounded-xl p-3 border border-theme ${
                    msg.role === 'user' ? 'bg-[#dbeafe] text-[#14161d] dark:bg-[#2a3a5e] dark:text-[#e0e0e0]' : 'surface-key'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-xl md:text-2xl">{msg.text}</p>
                  ) : (
                    <div className="space-y-2">
                      {(msg.lines ?? [msg.text]).map((line, li) => (
                        <button
                          key={li}
                          onClick={() => handleTapLine(line)}
                          aria-label={`Use: ${line}`}
                          className="aac-btn block w-full text-left rounded-lg p-2 hover:bg-black/5 transition-colors"
                        >
                          <ColoredText text={line} className="text-xl md:text-2xl leading-relaxed" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-dim text-base mt-1 px-1">{msg.role === 'user' ? 'You' : 'AI'}</p>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-muted text-xl px-2">
                <span className="animate-pulse">Thinking…</span>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-theme shrink-0">
            <div className="text-muted text-base md:text-lg mb-2 text-center truncate">
              {listening && interim ? (
                <span className="text-[#4CAF50]">🎙 &ldquo;{interim}&rdquo;</span>
              ) : text.trim() ? (
                <>Question: <span className="text-primary font-semibold">&ldquo;{text.trim()}&rdquo;</span></>
              ) : (
                voiceSupported
                  ? 'Type on the keyboard or tap 🎙 to speak.'
                  : 'Type your question on the keyboard.'
              )}
            </div>
            <div className="flex gap-2">
              {voiceSupported && (
                <button
                  onClick={toggleVoice}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                  aria-pressed={listening}
                  data-testid="ai-mic"
                  className={`aac-btn rounded-xl font-bold text-2xl px-5 min-w-[72px] flex items-center justify-center ${
                    listening
                      ? 'bg-[#F44336] text-white animate-pulse'
                      : 'surface-key text-primary border border-theme'
                  }`}
                >
                  {listening ? '⏺' : '🎙'}
                </button>
              )}
              <button
                onClick={handleAsk}
                disabled={!text.trim() || loading}
                className={`aac-btn aac-speak flex-1 py-4 rounded-xl font-bold text-xl md:text-2xl ${
                  text.trim() && !loading ? 'bg-[#4CAF50] text-white' : 'surface-key text-dim border border-theme'
                }`}
              >
                {loading ? 'Thinking…' : 'Ask AI ✨'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
