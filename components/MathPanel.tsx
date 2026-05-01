'use client';
import { useState, useCallback, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { tapFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { askAI } from '@/services/aiService';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/engine/useT';

const OPERATORS = [
  { label: '+', value: ' + ' },
  { label: '−', value: ' − ' },
  { label: '×', value: ' × ' },
  { label: '÷', value: ' ÷ ' },
  { label: '=', value: ' = ' },
  { label: '≠', value: ' ≠ ' },
  { label: '<', value: ' < ' },
  { label: '>', value: ' > ' },
  { label: '≤', value: ' ≤ ' },
  { label: '≥', value: ' ≥ ' },
];

const SPECIAL = [
  { label: 'x²', value: '²', title: 'Superscript 2' },
  { label: 'xⁿ', value: 'ⁿ', title: 'Superscript n' },
  { label: '½', value: '½', title: 'Fraction 1/2' },
  { label: '⅓', value: '⅓', title: 'Fraction 1/3' },
  { label: '¼', value: '¼', title: 'Fraction 1/4' },
  { label: '√', value: '√', title: 'Square root' },
  { label: 'π', value: 'π', title: 'Pi' },
  { label: '∞', value: '∞', title: 'Infinity' },
  { label: '(', value: '(', title: 'Open paren' },
  { label: ')', value: ')', title: 'Close paren' },
  { label: '%', value: '%', title: 'Percent' },
  { label: '.', value: '.', title: 'Decimal point' },
];

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const VARIABLES = ['x', 'y', 'z', 'a', 'b', 'n'];

const TTS_MAP: Record<string, string> = {
  '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by',
  '=': 'equals', '≠': 'not equal to', '<': 'less than', '>': 'greater than',
  '≤': 'less than or equal to', '≥': 'greater than or equal to',
  '²': 'squared', 'ⁿ': 'to the power of n', '√': 'square root of',
  'π': 'pi', '∞': 'infinity', '½': 'one half', '⅓': 'one third', '¼': 'one quarter',
  '%': 'percent',
};

const MATH_TUTOR_CONTEXT = 'math-tutor';

function expressionToSpeech(expr: string): string {
  let speech = expr;
  for (const [sym, word] of Object.entries(TTS_MAP)) {
    speech = speech.replaceAll(sym, ` ${word} `);
  }
  return speech.replace(/\s+/g, ' ').trim();
}

export default function MathPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { appendText } = useMessageStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const profile = useAuthStore((s) => s.profile);
  const { t, ttsCode, outputTtsCode } = useT();
  const [expression, setExpression] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (sidePanel !== 'math') return null;

  const aiEnabled = !!profile;

  const addToExpression = (val: string) => {
    tapFeedback();
    setExpression((prev) => prev + val);
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
  }, [expression, speechRate, speechVolume, outputTtsCode]);

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
        <div className="flex gap-1.5">
          <button onClick={() => { tapFeedback(); setShowMore(!showMore); }} className={`${mathKey} px-3 py-2.5 text-sm ${showMore ? 'bg-[#4CAF50] text-white border-transparent' : ''}`}>
            {showMore ? 'ABC' : 'More'}
          </button>
          {(showMore ? SPECIAL : OPERATORS).map((item) => (
            <button
              key={item.label}
              onClick={() => addToExpression(item.value)}
              className={`${mathKey} flex-1 py-2.5 text-lg`}
              title={'title' in item ? (item as { title: string }).title : item.label}
            >
              {item.label}
            </button>
          ))}
          <button onClick={backspace} className={`${mathKey} px-3 py-2.5 text-lg`} aria-label={t('backspace')}>⌫</button>
        </div>

        <div className="flex gap-1.5">
          {DIGITS.map((d) => (
            <button key={d} onClick={() => addToExpression(d)} className={`${mathKey} flex-1 py-2.5 text-xl`}>
              {d}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {VARIABLES.map((v) => (
            <button key={v} onClick={() => addToExpression(v)} className={`${mathKey} flex-1 py-2 text-lg italic`}>
              {v}
            </button>
          ))}
          <button onClick={() => addToExpression(' ')} className={`${mathKey} flex-[3] py-2 text-sm`}>
            ␣
          </button>
          <button onClick={sendToMessage} className="aac-btn bg-[#4CAF50] text-white rounded-lg flex-[2] py-2 font-bold text-base flex items-center justify-center">
            {t('speak')} ▶
          </button>
        </div>
      </div>
    </section>
  );
}
