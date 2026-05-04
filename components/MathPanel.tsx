'use client';
import { useState, useCallback, useRef, useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { tapFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { askAI } from '@/services/aiService';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/engine/useT';
import { MATH_ITEMS } from '@/constants/mathSymbols';
import type { MathCategory } from '@/types';

const CATEGORIES: { key: MathCategory; i18n: string; icon: string }[] = [
  { key: 'basic',      i18n: 'math_basic',          icon: '+-' },
  { key: 'digits',     i18n: 'math_numbers',        icon: '#' },
  { key: 'algebra',    i18n: 'math_algebra',        icon: 'x²' },
  { key: 'constants',  i18n: 'math_constants',      icon: 'π' },
  { key: 'trig',       i18n: 'math_trigonometry',   icon: 'sin' },
  { key: 'calculus',   i18n: 'math_calculus',       icon: '∫' },
  { key: 'greek',      i18n: 'math_greek_letters',  icon: 'α' },
  { key: 'logic-sets', i18n: 'math_logic_sets',     icon: '∈' },
];

const TTS_MAP: Record<string, string> = Object.fromEntries(
  MATH_ITEMS.map((m) => [m.symbol, m.ttsText])
);

const MATH_TUTOR_CONTEXT = 'math-tutor';

function expressionToSpeech(expr: string): string {
  let speech = expr;
  const sorted = Object.entries(TTS_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [sym, word] of sorted) {
    speech = speech.replaceAll(sym, ` ${word} `);
  }
  return speech.replace(/\s+/g, ' ').trim();
}

export default function MathPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { appendText } = useMessageStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const profile = useAuthStore((s) => s.profile);
  const { t, outputTtsCode } = useT();
  const [expression, setExpression] = useState('');
  const [activeCategory, setActiveCategory] = useState<MathCategory>('basic');
  const [aiHint, setAiHint] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const categoryItems = useMemo(
    () => MATH_ITEMS.filter((m) => m.category === activeCategory).sort((a, b) => a.sortOrder - b.sortOrder),
    [activeCategory]
  );

  const aiEnabled = !!profile;

  const addToExpression = (val: string) => {
    tapFeedback();
    const needsSpace = val.length > 1 || '+-×÷=≠≈<>≤≥±·'.includes(val);
    setExpression((prev) => {
      if (needsSpace) return prev + (prev && !prev.endsWith(' ') ? ' ' : '') + val + ' ';
      return prev + val;
    });
    setAiHint('');
  };

  const backspace = () => {
    tapFeedback();
    setAiHint('');
    setExpression((prev) => {
      if (prev.endsWith(' ')) {
        const trimmed = prev.trimEnd();
        const lastSpace = trimmed.lastIndexOf(' ');
        return lastSpace >= 0 ? prev.slice(0, lastSpace + 1) : '';
      }
      return prev.slice(0, -1);
    });
  };

  const clearAll = () => { tapFeedback(); setExpression(''); setAiHint(''); };

  const speakExpression = useCallback(() => {
    tapFeedback();
    if (!expression.trim()) return;
    aacSpeak(expressionToSpeech(expression), speechRate, speechVolume);
  }, [expression, speechRate, speechVolume]);

  const sendToMessage = () => {
    tapFeedback();
    if (!expression.trim()) return;
    appendText(expression.trim());
    setExpression('');
    setAiHint('');
  };

  const askMathTutor = async (mode: 'help' | 'solve' | 'check') => {
    if (!expression.trim() || !aiEnabled) return;
    tapFeedback();
    setAiLoading(true);
    setAiHint('');

    const prompts: Record<string, string> = {
      help: `The child wrote this math expression: "${expression}". They need help understanding what to do next. Give a gentle hint — don't solve it, just guide them to the next step. Use simple words. Be encouraging. Max 2 sentences.`,
      solve: `The child wrote: "${expression}". Show the solution step by step. Use simple language a child can understand. Use math symbols. Be encouraging — say "Great job trying!" or similar. Max 4 short steps.`,
      check: `The child wrote: "${expression}". Check if this is correct. If there's an error, explain what went wrong gently and show how to fix it. If it's correct, celebrate! Use simple words. Max 2 sentences.`,
    };

    let buffer = '';
    try {
      await askAI(prompts[mode], MATH_TUTOR_CONTEXT, (delta) => {
        buffer += delta;
        setAiHint(buffer);
      });
      setAiHint(buffer);
      if (buffer) aacSpeak(buffer, speechRate, speechVolume);
    } catch {
      setAiHint('Could not reach the math helper right now.');
    }
    setAiLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  if (sidePanel !== 'math') return null;

  const mathKey = 'aac-btn surface-key text-primary rounded-lg font-bold select-none border border-theme flex items-center justify-center';

  return (
    <section
      aria-label={t('math')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-xl">{t('math')}</span>
        <div className="flex gap-2">
          <button onClick={sendToMessage} className="aac-btn bg-[#4CAF50] text-white rounded-lg px-4 py-2 font-bold text-base">
            ✓ {t('done')}
          </button>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className="aac-btn w-10 h-10 rounded-lg surface-key text-muted text-xl flex items-center justify-center border border-theme">✕</button>
        </div>
      </div>

      {/* Canvas — expression display + AI tutor */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {/* Expression canvas */}
        <div className="flex items-center justify-center bg-white dark:bg-[#1a1a2e] rounded-xl border-2 border-theme min-h-[clamp(80px,15svh,140px)] px-4 relative">
          <span className="text-[clamp(1.75rem,5vw,3.5rem)] font-mono text-primary tracking-wide text-center break-all py-3">
            {expression || <span className="text-dim text-[clamp(0.9rem,2.5vw,1.25rem)]">5 × 6 =</span>}
          </span>
          <div className="absolute bottom-1.5 right-3 flex gap-1.5">
            <button onClick={speakExpression} className="aac-btn w-8 h-8 rounded-full surface-key text-muted flex items-center justify-center border border-theme text-sm" aria-label={t('speak')}>🔊</button>
            <button onClick={clearAll} className="aac-btn w-8 h-8 rounded-full surface-key text-muted flex items-center justify-center border border-theme text-xs" aria-label={t('clear')}>C</button>
          </div>
        </div>

        {/* AI Tutor buttons */}
        {aiEnabled && expression.trim() && (
          <div className="flex gap-2">
            <button
              onClick={() => askMathTutor('help')}
              disabled={aiLoading}
              className="aac-btn flex-1 bg-[#2196F3] text-white rounded-lg py-2.5 font-bold text-base flex items-center justify-center gap-1.5"
            >
              💡 Hint
            </button>
            <button
              onClick={() => askMathTutor('check')}
              disabled={aiLoading}
              className="aac-btn flex-1 bg-[#FF9800] text-white rounded-lg py-2.5 font-bold text-base flex items-center justify-center gap-1.5"
            >
              ✓ Check
            </button>
            <button
              onClick={() => askMathTutor('solve')}
              disabled={aiLoading}
              className="aac-btn flex-1 bg-[#9C27B0] text-white rounded-lg py-2.5 font-bold text-base flex items-center justify-center gap-1.5"
            >
              🎓 Solve
            </button>
          </div>
        )}

        {/* AI response */}
        {(aiHint || aiLoading) && (
          <div className="bg-[#E3F2FD] dark:bg-[#1a2a4a] rounded-xl p-4 border border-[#90CAF9] dark:border-[#2a4a7a]">
            <div className="flex items-start gap-2">
              <span className="text-2xl shrink-0">🤖</span>
              <div className="text-primary text-base leading-relaxed">
                {aiLoading && !aiHint ? (
                  <span className="text-muted animate-pulse">{t('thinking')}</span>
                ) : (
                  aiHint.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                  ))
                )}
              </div>
            </div>
            {aiHint && (
              <button
                onClick={() => { tapFeedback(); aacSpeak(aiHint, speechRate, speechVolume); }}
                className="aac-btn mt-2 text-[#2196F3] text-sm font-bold"
              >
                🔊 Read aloud
              </button>
            )}
          </div>
        )}
      </div>

      {/* Math keyboard */}
      <div className="shrink-0 border-t border-theme p-2 space-y-1.5">
        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => { tapFeedback(); setActiveCategory(cat.key); }}
              className={`${mathKey} px-2.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
                activeCategory === cat.key ? 'bg-[#4CAF50] text-white border-transparent' : ''
              }`}
            >
              <span className="font-mono mr-1">{cat.icon}</span>
              <span className="hidden sm:inline">{t(cat.i18n)}</span>
            </button>
          ))}
        </div>

        {/* Symbol grid for active category */}
        <div className="flex gap-1.5 flex-wrap max-h-[clamp(44px,10svh,88px)] overflow-y-auto">
          {categoryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToExpression(item.symbol)}
              className={`${mathKey} min-w-[clamp(36px,8vw,48px)] py-2 text-lg`}
              title={item.label}
              aria-label={item.ttsText}
            >
              {item.symbol}
            </button>
          ))}
        </div>

        {/* Number pad — always visible */}
        <div className="flex gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
            <button key={d} onClick={() => addToExpression(d)} className={`${mathKey} flex-1 py-2.5 text-xl`}>
              {d}
            </button>
          ))}
        </div>

        {/* Variables + space + speak/send + backspace */}
        <div className="flex gap-1.5">
          {['x', 'y', 'z', 'a', 'b', 'n'].map((v) => (
            <button key={v} onClick={() => addToExpression(v)} className={`${mathKey} flex-1 py-2 text-lg italic`}>
              {v}
            </button>
          ))}
          <button onClick={() => addToExpression(' ')} className={`${mathKey} flex-[2] py-2 text-sm`}>
            ␣
          </button>
          <button onClick={backspace} className={`${mathKey} px-3 py-2 text-lg`} aria-label={t('backspace')}>⌫</button>
          <button onClick={sendToMessage} className="aac-btn bg-[#4CAF50] text-white rounded-lg flex-[2] py-2 font-bold text-base flex items-center justify-center">
            {t('speak')} ▶
          </button>
        </div>
      </div>
    </section>
  );
}
