'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { askAI } from '@/services/aiService';
import { aacSpeak } from '@/services/aacSpeak';
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
  const { text, appendText, autoSpeak, soundEnabled } = useMessageStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const profile = useAuthStore((s) => s.profile);
  const { t, ttsCode, outputTtsCode } = useT();
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
      if (autoSpeak && soundEnabled) aacSpeak(line, speechRate, speechVolume);
    },
    [appendText, autoSpeak, soundEnabled, speechRate, speechVolume, outputTtsCode],
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
      }, language);
      flush();
      // Preserve the user's typed question in the message bar — they may
      // want to edit it, speak it via the Speak button, or compose a
      // follow-up. Earlier behaviour cleared the bar on completion which
      // killed the AAC user's typing context (verified-shipping note:
      // user reported "AI keyboard should be preserved" after seeing
      // input wiped post-Ask).
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('could_not_reach_ai');
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: msg, lines: [msg] };
        return updated;
      });
    }
    setLoading(false);
  };

  // FOURTH pass. Round 1 flipped flex (still 500px). Round 2 hid body
  // (still 200px footer). Round 3 hid footer + tightened header (59px).
  // Round 4 (this version): user feedback 2026-05-07 — "doesnt make
  // any sense, expand type here panel instead" + "remove ai chat line,
  // microphone button already existed on the top panel". So when the
  // panel is compact (nothing to show yet), it unmounts entirely. The
  // toolbar AI button toggles the panel open/closed; MessageBar reads
  // sidePanel and grows by one line so the user has a fatter compose
  // area for the question. As soon as text.trim() is truthy → panel
  // remounts in expanded form with conversation body + Ask AI footer.
  const isCompact = (configured && messages.length === 0 && !loading && !text.trim()) || !configured;
  if (isCompact) return null;

  // Below this point: configured && (messages.length > 0 || loading || text typed).
  // No more isCompact branching needed.
  return (
    <section
      aria-label={t('ai_chat_title')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
      data-testid="ai-chat-panel"
      data-state="expanded"
    >
      <header className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-xl md:text-2xl">✨ {t('ai_chat_title')}</span>
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label={t('close_ai_chat')}
          className="aac-btn w-10 h-10 rounded-lg surface-key text-muted text-xl flex items-center justify-center border border-theme"
        >
          ✕
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
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
                <p className="text-dim text-base mt-1 px-1">{msg.role === 'user' ? t('you') : t('ai_chat')}</p>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-muted text-xl px-2">
                <span className="animate-pulse">{t('thinking')}</span>
              </div>
            )}
      </div>

      {/* Footer — hint + mic + Ask AI. Only renders when expanded, and
          we already early-returned when compact, so it's unconditional
          here. */}
          <div className="p-3 border-t border-theme shrink-0">
            <div className="text-muted text-base md:text-lg mb-2 text-center truncate">
              {listening && interim ? (
                <span className="text-[#4CAF50]">🎙 &ldquo;{interim}&rdquo;</span>
              ) : text.trim() ? (
                <>{t('question_label')} <span className="text-primary font-semibold">&ldquo;{text.trim()}&rdquo;</span></>
              ) : (
                voiceSupported
                  ? t('type_or_speak')
                  : t('type_question')
              )}
            </div>
            <div className="flex gap-2">
              {voiceSupported && (
                <button
                  onClick={toggleVoice}
                  aria-label={listening ? t('stop_voice') : t('start_voice')}
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
                {loading ? t('thinking') : `${t('ask_ai')} ✨`}
              </button>
            </div>
          </div>
    </section>
  );
}
