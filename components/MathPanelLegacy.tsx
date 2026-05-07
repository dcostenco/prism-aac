'use client';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { tapFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { askAI } from '@/services/aiService';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/engine/useT';
import { MATH_ITEMS } from '@/constants/mathSymbols';
import MathExpression from './MathExpression';
import MathDrawCanvas, { type DrawStroke } from './MathDrawCanvas';
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
  const { speechRate, speechVolume, language } = useSettingsStore();
  const profile = useAuthStore((s) => s.profile);
  const { t, outputTtsCode } = useT();
  const [expression, setExpression] = useState('');
  const [activeCategory, setActiveCategory] = useState<MathCategory>('basic');
  const [aiHint, setAiHint] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  // Step 3: "More" gates the symbol library (categories + per-category
  // grid) the way Panther Math Paper does. When closed, only the
  // Panther-style operator row + number pad + tiny variables row show,
  // keeping the keyboard footprint small so the math canvas dominates.
  const [showMore, setShowMore] = useState(false);
  // Step 4: drawing canvas. drawMode toggles the SVG overlay; strokes
  // accumulate in state so they survive panel re-renders. Undo pops the
  // last stroke; clear wipes all of them.
  const [drawMode, setDrawMode] = useState(false);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 480 });

  // Track the canvas dimensions so the SVG overlay scales 1:1 with the
  // grid background. ResizeObserver fires on container resize without us
  // having to listen for window resize ourselves.
  useEffect(() => {
    const node = canvasRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = node.getBoundingClientRect();
      setCanvasSize({ width: Math.max(100, r.width), height: Math.max(100, r.height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const undoStroke = useCallback(() => {
    tapFeedback();
    setStrokes((prev) => prev.slice(0, -1));
  }, []);
  const clearStrokes = useCallback(() => {
    tapFeedback();
    setStrokes([]);
  }, []);

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

  // Step 5: structured templates that emit raw LaTeX so KaTeX renders
  // them as proper mathematical typography (real fraction bars, true
  // superscripts, square roots that resize over their argument). Each
  // template inserts a placeholder the user can replace by tapping
  // backspace then typing the actual values — no editable cells layer
  // needed; the canvas re-renders as soon as the LaTeX string changes.
  const TEMPLATES: { label: string; latex: string; aria: string }[] = [
    { label: '½',    latex: '\\frac{1}{2}',   aria: 'Insert fraction one-half' },
    { label: 'a/b',  latex: '\\frac{a}{b}',   aria: 'Insert blank fraction' },
    { label: 'x²',   latex: 'x^{2}',          aria: 'Insert squared variable' },
    { label: 'xⁿ',   latex: 'x^{n}',          aria: 'Insert exponent' },
    { label: 'xₙ',   latex: 'x_{n}',          aria: 'Insert subscript' },
    { label: '√',    latex: '\\sqrt{x}',      aria: 'Insert square root' },
    { label: '∛',    latex: '\\sqrt[3]{x}',   aria: 'Insert cube root' },
    { label: '∑',    latex: '\\sum_{i=1}^{n} ', aria: 'Insert summation' },
    { label: '∫',    latex: '\\int_{a}^{b} ',  aria: 'Insert integral' },
    { label: '12+34', latex: '\\begin{matrix} \\phantom{+}12 \\\\ +34 \\\\ \\hline ?? \\end{matrix} ', aria: 'Insert column addition' },
  ];

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
      }, language);
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
      data-testid="math-panel"
      data-show-more={showMore ? '1' : '0'}
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
      <div ref={scrollRef} data-testid="math-canvas-scroll" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {/* Expression canvas — graph-paper background. The min-h is
            ADAPTIVE: when showMore is open the user is browsing
            symbols (5-row keyboard), so the canvas shrinks to a sane
            floor so the keyboard fits without scrolling. When showMore
            is closed (3-row keyboard) the canvas takes the dominant
            space, matching Panther Math Paper proportions.
            User feedback 2026-05-07: "no way to type without that" —
            the prior unconditional 60svh squeezed the keyboard off
            the bottom of the viewport when showMore was open. */}
        <div
          ref={canvasRef}
          data-testid="math-canvas"
          className={`math-grid-canvas relative flex items-center justify-center rounded-xl border-2 border-theme px-4 bg-white dark:bg-[#1a1a2e] overflow-hidden ${
            showMore
              ? 'min-h-[clamp(120px,20svh,200px)]'
              : 'min-h-[clamp(220px,40svh,420px)]'
          }`}
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(120,120,140,0.18) 1px, transparent 1px),' +
              'linear-gradient(to bottom, rgba(120,120,140,0.18) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {expression ? (
            <MathExpression
              expression={expression}
              className="text-[clamp(2rem,6vw,4.5rem)] text-primary text-center break-all py-3 katex-host relative z-10"
            />
          ) : (
            <span className="text-dim text-[clamp(0.9rem,2.5vw,1.25rem)] relative z-10">5 × 6 =</span>
          )}
          {/* SVG drawing overlay — receives pointer events only when
              drawMode is on, so reading the expression isn't blocked
              by an invisible click-eater layer. */}
          <MathDrawCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            enabled={drawMode}
            strokes={strokes}
            onStrokesChange={setStrokes}
          />
          <div className="absolute bottom-2 right-3 flex gap-1.5 z-20">
            {drawMode && strokes.length > 0 && (
              <>
                <button onClick={undoStroke} className="aac-btn w-9 h-9 rounded-full surface-key text-muted flex items-center justify-center border border-theme text-base shadow-sm" aria-label="Undo stroke">↶</button>
                <button onClick={clearStrokes} className="aac-btn px-2 h-9 rounded-full surface-key text-muted flex items-center justify-center border border-theme text-xs font-bold shadow-sm" aria-label="Clear drawing">Clear ✏️</button>
              </>
            )}
            <button onClick={speakExpression} className="aac-btn w-9 h-9 rounded-full surface-key text-muted flex items-center justify-center border border-theme text-base shadow-sm" aria-label={t('speak')}>🔊</button>
            <button onClick={clearAll} className="aac-btn w-9 h-9 rounded-full surface-key text-muted flex items-center justify-center border border-theme text-sm shadow-sm" aria-label={t('clear')}>C</button>
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

      {/* Math keyboard — Panther Math Paper layout: compact operator row
          + numeric pad + variables. Symbol library (8 categories × ~30
          symbols each) is gated behind the More button to keep the
          canvas dominating the screen. */}
      <div data-testid="math-keyboard" className="shrink-0 border-t border-theme p-2 space-y-1.5">
        {/* Symbol library (only when More is open) */}
        {showMore && (
          <>
            {/* Templates row — KaTeX-rendered structures (fractions,
                exponents, roots, summation/integral, column addition).
                Tap-target floor matches the operator/number rows below
                (≈44px) so motor-impaired AAC users aren't stuck poking
                at 28-32px buttons (May 2026 keyboard-fix sweep). */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  onClick={() => addToExpression(tpl.latex)}
                  className={`${mathKey} px-3 py-2 text-base whitespace-nowrap shrink-0 min-w-[44px]`}
                  title={tpl.aria}
                  aria-label={tpl.aria}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => { tapFeedback(); setActiveCategory(cat.key); }}
                  className={`${mathKey} px-3 py-2 text-sm whitespace-nowrap shrink-0 min-h-[44px] ${
                    activeCategory === cat.key ? 'bg-[#4CAF50] text-white border-transparent' : ''
                  }`}
                >
                  <span className="font-mono mr-1">{cat.icon}</span>
                  <span className="hidden sm:inline">{t(cat.i18n)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap max-h-[clamp(64px,14svh,120px)] overflow-y-auto">
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
          </>
        )}

        {/* Operator row — Panther layout: More, template, ops, =, draw, frac, backspace */}
        <div className="flex gap-1.5">
          <button
            onClick={() => { tapFeedback(); setShowMore((v) => !v); }}
            data-testid="math-more-button"
            className={`${mathKey} px-3 py-2.5 text-sm font-semibold ${showMore ? 'bg-[#4CAF50] text-white border-transparent' : ''}`}
            aria-label="More symbols"
            aria-expanded={showMore}
          >
            {showMore ? '×' : '⊕'} {t('more') || 'More'}
          </button>
          <button onClick={() => addToExpression('(2xy)^{2}')} className={`${mathKey} px-3 py-2.5 text-sm font-mono`} title="Squared template">(2xy)²</button>
          <button onClick={() => addToExpression('+')} className={`${mathKey} flex-1 py-2.5 text-xl`}>+</button>
          <button onClick={() => addToExpression('−')} className={`${mathKey} flex-1 py-2.5 text-xl`}>−</button>
          <button onClick={() => addToExpression('×')} className={`${mathKey} flex-1 py-2.5 text-xl`}>×</button>
          <button onClick={() => addToExpression('÷')} className={`${mathKey} flex-1 py-2.5 text-xl`}>÷</button>
          <button onClick={() => addToExpression('=')} className={`${mathKey} flex-1 py-2.5 text-xl`}>=</button>
          <button
            onClick={() => { tapFeedback(); setDrawMode((v) => !v); }}
            className={`${mathKey} px-3 py-2.5 text-base ${drawMode ? 'bg-[#FF9800] text-white border-transparent' : ''}`}
            aria-label="Draw geometric figures"
            aria-pressed={drawMode}
            title="Draw on the grid"
          >✏️</button>
          <button onClick={() => addToExpression('\\frac{1}{2}')} className={`${mathKey} px-3 py-2.5 text-sm font-mono`} title="Fraction template">½</button>
          <button onClick={backspace} className={`${mathKey} px-3 py-2.5 text-lg`} aria-label={t('backspace')}>⌫</button>
        </div>

        {/* Number pad */}
        <div className="flex gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
            <button key={d} onClick={() => addToExpression(d)} className={`${mathKey} flex-1 py-2.5 text-xl`}>
              {d}
            </button>
          ))}
        </div>

        {/* Variables + speak — single compact row */}
        <div className="flex gap-1.5">
          {['x', 'y', 'z', 'a', 'b', 'n'].map((v) => (
            <button key={v} onClick={() => addToExpression(v)} className={`${mathKey} flex-1 py-2 text-lg italic`}>
              {v}
            </button>
          ))}
          <button onClick={() => addToExpression(' ')} className={`${mathKey} flex-1 py-2 text-sm`} aria-label="Space">␣</button>
          <button onClick={sendToMessage} className="aac-btn bg-[#4CAF50] text-white rounded-lg flex-[3] py-2 font-bold text-base flex items-center justify-center">
            {t('speak')} ▶
          </button>
        </div>
      </div>
    </section>
  );
}
