'use client';
import { useState, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { speakWord } from '@/services/speechService';
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
  const { t, ttsCode } = useT();
  const [expression, setExpression] = useState('');
  const [showMore, setShowMore] = useState(false);

  if (sidePanel !== 'math') return null;

  const addToExpression = (val: string) => {
    tapFeedback();
    setExpression((prev) => prev + val);
  };

  const backspace = () => {
    tapFeedback();
    setExpression((prev) => {
      if (prev.endsWith(' ')) {
        const trimmed = prev.trimEnd();
        const lastSpace = trimmed.lastIndexOf(' ');
        return lastSpace >= 0 ? prev.slice(0, lastSpace + 1) : '';
      }
      return prev.slice(0, -1);
    });
  };

  const clearAll = () => { tapFeedback(); setExpression(''); };

  const speakExpression = useCallback(() => {
    tapFeedback();
    if (!expression.trim()) return;
    speakWord(expressionToSpeech(expression), speechRate, speechVolume, ttsCode);
  }, [expression, speechRate, speechVolume, ttsCode]);

  const sendToMessage = () => {
    tapFeedback();
    if (!expression.trim()) return;
    appendText(expression.trim());
    setExpression('');
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

      {/* Canvas — expression display */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-4 relative">
        <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#1a1a2e] rounded-xl border-2 border-theme overflow-auto px-4">
          <span className="text-[clamp(2rem,6vw,4rem)] font-mono text-primary tracking-wide text-center break-all">
            {expression || <span className="text-dim text-[clamp(1rem,3vw,1.5rem)]">5 × 6 =</span>}
          </span>
        </div>
        <div className="absolute bottom-2 right-8 flex gap-2">
          <button onClick={speakExpression} className="aac-btn w-10 h-10 rounded-full surface-key text-muted flex items-center justify-center border border-theme" aria-label={t('speak')}>🔊</button>
          <button onClick={clearAll} className="aac-btn w-10 h-10 rounded-full surface-key text-muted flex items-center justify-center border border-theme text-sm" aria-label={t('clear')}>C</button>
        </div>
      </div>

      {/* Math keyboard */}
      <div className="shrink-0 border-t border-theme p-2 space-y-1.5">
        {/* Row 1: operators + special toggle */}
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

        {/* Row 2: digits + variables */}
        <div className="flex gap-1.5">
          {DIGITS.map((d) => (
            <button key={d} onClick={() => addToExpression(d)} className={`${mathKey} flex-1 py-2.5 text-xl`}>
              {d}
            </button>
          ))}
        </div>

        {/* Row 3: variables */}
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
