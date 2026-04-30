'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { askAI, hasApiKey } from '@/services/aiService';
import { speakWord } from '@/services/speechService';
import { useSettingsStore } from '@/store/settingsStore';
import ColoredText from './ColoredText';

/**
 * AI Chat Panel — side panel for child interaction with AI.
 *
 * The child types a question using the keyboard → message bar → taps [Ask AI].
 * AI responds with short, colored, tappable lines.
 * Tapping a line copies it to the message bar for speaking.
 *
 * CLINICAL SAFETY (Valencia et al., CHI 2023):
 *   - AI responses are suggestions, never auto-inserted
 *   - Child must explicitly tap to use a response
 *   - Preserves authorship and agency
 */

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  lines?: string[];
}

export default function AIChatPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { text, appendText, clearAll, autoSpeak, soundEnabled } = useMessageStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (sidePanel !== 'ai-chat') return null;

  const handleAsk = async () => {
    const question = text.trim();
    if (!question) return;
    tapFeedback();

    setMessages((m) => [...m, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const response = await askAI(question);
      setMessages((m) => [...m, { role: 'ai', text: response.text, lines: response.lines }]);
      clearAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not reach AI';
      setMessages((m) => [...m, { role: 'ai', text: msg, lines: [msg] }]);
      // Don't clear — child can retry without retyping
    }
    setLoading(false);
  };

  const handleTapLine = useCallback((line: string) => {
    tapFeedback();
    appendText(line);
    if (autoSpeak && soundEnabled) speakWord(line, speechRate, speechVolume);
  }, [appendText, autoSpeak, soundEnabled, speechRate, speechVolume]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const configured = hasApiKey();

  return (
    <div className="w-[340px] bg-[#16162a] border-r border-[#2a2a3e] flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3e]">
        <span className="text-[#888] font-semibold text-sm">AI Chat</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-11 h-11 rounded-xl bg-[#2a2a3e] text-[#aaa] text-lg flex items-center justify-center">✕</button>
      </div>

      {!configured ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-[#888] text-sm mb-4">AI Chat requires a Synalux account.</p>
          <p className="text-[#555] text-xs mb-4">Sign in via Settings to enable AI Chat, web search, and all platform modules.</p>
          <p className="text-[#444] text-xs">Core AAC features (keyboard, categories, predictions) work without an account.</p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-[#555] text-sm text-center py-8">
                <p className="mb-2">Type a question, then tap</p>
                <p className="text-[#4CAF50] font-semibold">Ask AI</p>
                <p className="mt-4 text-xs text-[#444]">Tap any AI response to add it to your message.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`${msg.role === 'user' ? 'ml-8' : 'mr-4'}`}>
                <div className={`rounded-xl p-3 ${
                  msg.role === 'user'
                    ? 'bg-[#2a3a5e] text-[#e0e0e0]'
                    : 'bg-[#1e1e2e]'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.text}</p>
                  ) : (
                    <div className="space-y-2">
                      {(msg.lines ?? [msg.text]).map((line, li) => (
                        <button
                          key={li}
                          onClick={() => handleTapLine(line)}
                          aria-label={`Use: ${line}`}
                          className="aac-btn block w-full text-left rounded-lg p-2 hover:bg-[#2a2a3e] transition-colors"
                        >
                          <ColoredText text={line} className="text-sm leading-relaxed" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[#444] text-xs mt-1 px-1">
                  {msg.role === 'user' ? 'You' : 'AI'}
                </p>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[#888] text-sm px-2">
                <span className="animate-pulse">Thinking...</span>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-[#2a2a3e]">
            <button
              onClick={handleAsk}
              disabled={!text.trim() || loading}
              className={`aac-btn aac-speak w-full py-3 rounded-xl font-bold text-sm ${
                text.trim() && !loading
                  ? 'bg-[#4CAF50] text-white'
                  : 'bg-[#2a2a3e] text-[#555]'
              }`}
            >
              {loading ? 'Thinking...' : 'Ask AI ✨'}
            </button>
            <p className="text-[#444] text-xs text-center mt-2">
              Type your question above, then tap Ask AI
            </p>
          </div>
        </>
      )}
    </div>
  );
}
