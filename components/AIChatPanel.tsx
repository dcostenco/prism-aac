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

  // Compact when there's nothing to show. THIRD pass at this fix —
  // first attempt only flipped flex-[3]→flex-none (DOM compact, render
  // 500px). Second attempt dropped the body but kept the footer
  // (hint + 🎙 + Ask AI), still ~230px on a wide viewport — keyboard's
  // bottom row clipped (user screenshot 2026-05-07: "nothing fixed").
  // Real-real fix: drop the FOOTER too in compact mode. Header only
  // (~60px). The user types on the qwerty; first character flips
  // text.trim() truthy → panel becomes expanded → full footer with
  // hint + mic + Ask AI button reappears. The mic moves into the
  // header in compact mode so voice input stays discoverable.
  const isCompact = (configured && messages.length === 0 && !loading && !text.trim()) || !configured;

  return (
    <section
      aria-label={t('ai_chat_title')}
      className={
        isCompact
          ? 'flex-none flex flex-col surface-bar border-y border-theme'
          : 'flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme'
      }
      data-testid="ai-chat-panel"
      data-state={isCompact ? 'compact' : 'expanded'}
    >
      <header className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-xl md:text-2xl">✨ {t('ai_chat_title')}</span>
        <div className="flex items-center gap-2">
          {/* Mic button is part of the header in compact mode so voice
              input stays one tap away even when the footer is hidden. */}
          {isCompact && configured && voiceSupported && (
            <button
              onClick={toggleVoice}
              aria-label={listening ? t('stop_voice') : t('start_voice')}
              aria-pressed={listening}
              data-testid="ai-mic-compact"
              className={`aac-btn rounded-lg font-bold text-xl px-3 min-h-[40px] flex items-center justify-center ${
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
            className="aac-btn w-10 h-10 rounded-lg surface-key text-muted text-xl flex items-center justify-center border border-theme"
          >
            ✕
          </button>
        </div>
      </header>

      {!configured ? (
        // Unconfigured: a single short hint inside the header strip
        // is enough; no body, no footer, no big vertical-centered card.
        <div className="px-4 py-1.5 text-center shrink-0 border-b border-theme">
          <p className="text-primary font-bold text-sm">{t('ai_chat_requires_account')}</p>
        </div>
      ) : (
        <>
          {/* Body — only rendered when there's something to show. The
              empty-state placeholder was redundant: the green Ask AI
              button in the footer already telegraphs the action. */}
          {!isCompact && (
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
          )}

          {/* Footer — hint + mic + Ask AI. ONLY rendered when not
              compact, i.e. user has typed something or there are
              messages. In compact (empty) mode the footer is gone
              and the qwerty fills its space; the in-header mic stays
              discoverable. */}
          {!isCompact && (
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
          )}
        </>
      )}
    </section>
  );
}
