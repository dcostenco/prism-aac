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
import ColoredText from './ColoredText';

/**
 * AI Chat — integrated modal anchored above the keyboard.
 *
 * The child types a question on the unified keyboard → text appears in the
 * shared message bar → opens this modal and taps [Ask AI ✨]. Tapping any AI
 * line copies it to the message bar (preserves authorship — Valencia et al.,
 * CHI 2023). No second input field. The modal does not cover the keyboard or
 * message bar so the user can keep typing.
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const voiceSupported = isVoiceInputSupported();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleTapLine = useCallback(
    (line: string) => {
      tapFeedback();
      appendText(line);
      if (autoSpeak && soundEnabled) speakWord(line, speechRate, speechVolume);
    },
    [appendText, autoSpeak, soundEnabled, speechRate, speechVolume],
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
      onFinal: (t) => {
        appendText(t.trim() + ' ');
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

  const configured = !!useAuthStore((s) => s.profile);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-6"
      onClick={() => { tapFeedback(); closeSidePanel(); }}
    >
      <div
        className="surface-bar w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl flex flex-col max-h-[80svh] md:max-h-[70svh] border border-theme overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <span className="text-primary font-semibold text-base">✨ AI Chat</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close AI chat" className="aac-btn w-11 h-11 rounded-xl surface-key text-muted text-lg flex items-center justify-center border border-theme">✕</button>
        </div>

        {!configured ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-muted text-sm mb-3">AI Chat requires a Synalux account.</p>
            <p className="text-dim text-xs mb-3">Sign in via Settings to enable AI Chat, web search, and all platform modules.</p>
            <p className="text-dim text-xs">Core AAC features (keyboard, categories, predictions) work without an account.</p>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px]">
              {messages.length === 0 && (
                <div className="text-muted text-sm text-center py-8">
                  <p className="mb-2">Type a question on the keyboard, then tap</p>
                  <p className="text-[#4CAF50] font-semibold">Ask AI ✨</p>
                  <p className="mt-3 text-xs text-dim">Tap any AI response to add it to your message.</p>
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
                      <p className="text-sm">{msg.text}</p>
                    ) : (
                      <div className="space-y-2">
                        {(msg.lines ?? [msg.text]).map((line, li) => (
                          <button
                            key={li}
                            onClick={() => handleTapLine(line)}
                            aria-label={`Use: ${line}`}
                            className="aac-btn block w-full text-left rounded-lg p-2 hover:bg-black/5 transition-colors"
                          >
                            <ColoredText text={line} className="text-sm leading-relaxed" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-dim text-xs mt-1 px-1">{msg.role === 'user' ? 'You' : 'AI'}</p>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-muted text-sm px-2">
                  <span className="animate-pulse">Thinking…</span>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-theme">
              <div className="text-dim text-xs mb-2 text-center truncate">
                {listening && interim ? (
                  <span className="text-[#4CAF50]">🎙 &ldquo;{interim}&rdquo;</span>
                ) : text.trim() ? (
                  <>Question: <span className="text-muted">&ldquo;{text.trim()}&rdquo;</span></>
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
                    className={`aac-btn rounded-xl font-bold text-base px-4 min-w-[64px] flex items-center justify-center ${
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
                  className={`aac-btn aac-speak flex-1 py-3 rounded-xl font-bold text-base ${
                    text.trim() && !loading ? 'bg-[#4CAF50] text-white' : 'surface-key text-dim border border-theme'
                  }`}
                >
                  {loading ? 'Thinking…' : 'Ask AI ✨'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
