'use client';
import { ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useCategoryStore } from '@/store/categoryStore';
import { usePredictionStore } from '@/store/predictionStore';
import { tapFeedback } from '@/services/feedback';
import { useSettingsStore } from '@/store/settingsStore';
import { speakWord } from '@/services/speechService';
import { MATH_ITEMS } from '@/constants/mathSymbols';
import { MathCategory } from '@/types';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { useT } from '@/engine/useT';
import PhraseTile from './PhraseTile';

/**
 * Category / Math / Ordering panel — renders inline, docked above the
 * keyboard. The panel claims roughly the upper half of the viewport (it is
 * `flex-1` next to a `flex-1` keyboard wrapper) so the user keeps typing on
 * the same soft keyboard, can hear the same predictions, and never has the
 * panel cover the keys. This mirrors the AI Chat layout.
 */
function PanelShell({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="AAC panel"
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      {children}
    </section>
  );
}

const MATH_GROUPS: { key: MathCategory; labelKey: string; cols: string }[] = [
  { key: 'basic',       labelKey: 'Basic',           cols: 'grid-cols-6 md:grid-cols-9' },
  { key: 'digits',      labelKey: 'Numbers',         cols: 'grid-cols-5 md:grid-cols-10' },
  { key: 'algebra',     labelKey: 'Algebra',         cols: 'grid-cols-6 md:grid-cols-9' },
  { key: 'constants',   labelKey: 'Constants',       cols: 'grid-cols-5 md:grid-cols-8' },
  { key: 'trig',        labelKey: 'Trigonometry',    cols: 'grid-cols-3 md:grid-cols-5' },
  { key: 'calculus',    labelKey: 'Calculus',        cols: 'grid-cols-4 md:grid-cols-7' },
  { key: 'greek',       labelKey: 'Greek letters',   cols: 'grid-cols-6 md:grid-cols-12' },
  { key: 'logic-sets',  labelKey: 'Logic & sets',    cols: 'grid-cols-5 md:grid-cols-8' },
];

export default function CategoryPanel() {
  const { t } = useT();
  const {
    sidePanel, activeCategoryId, activeSequenceId, activeSequenceStep,
    closeSidePanel, selectCategory, backToCategories, startOrdering, nextStep, prevStep, finishOrdering,
  } = useUIStore();
  const { appendText, appendWord, text, autoSpeak, soundEnabled } = useMessageStore();
  const { allCategories, getPhrasesForCategory, getSequencesForCategory } = useCategoryStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume } = useSettingsStore();

  const isOpen =
    sidePanel === 'categories' ||
    sidePanel === 'category-detail' ||
    sidePanel === 'ordering' ||
    sidePanel === 'math';

  if (!isOpen) return null;

  const handlePhrase = (phraseText: string) => {
    tapFeedback();
    const existingWords = text.trim().split(/\s+/).filter(Boolean);
    const prevWord = existingWords.length > 0 ? existingWords[existingWords.length - 1] : undefined;
    appendText(phraseText);
    const phraseWords = phraseText.trim().split(/\s+/);
    let prev = prevWord;
    for (const w of phraseWords) {
      learnWord(w.toLowerCase(), prev?.toLowerCase());
      prev = w;
    }
    if (autoSpeak && soundEnabled) speakWord(phraseText, speechRate, speechVolume);
  };

  const handleMathItem = (symbol: string) => {
    tapFeedback();
    appendWord(symbol);
  };

  const btn = 'aac-btn surface-key text-primary rounded-xl p-3 font-bold text-xl md:text-2xl select-none text-center border border-theme';
  const closeBtn = 'aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme';
  const headerRow = 'flex items-center justify-between px-4 py-3 border-b border-theme shrink-0';
  const headerTitle = 'text-primary font-bold text-2xl md:text-3xl';

  // ── MATH PANEL — every available symbol, grouped ────────────────────────
  if (sidePanel === 'math') {
    return (
      <PanelShell>
        <div className={headerRow}>
          <span className={headerTitle}>{t('math')}</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className={closeBtn}>✕</button>
        </div>
        <div className="p-3 overflow-y-auto flex-1 min-h-0 space-y-4">
          {MATH_GROUPS.map((group) => {
            const items = MATH_ITEMS.filter((m) => m.category === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <p className="text-muted text-sm md:text-base font-bold mb-2 px-1 uppercase tracking-wider">{group.labelKey}</p>
                <div className={`grid ${group.cols} gap-2`}>
                  {items.map((m) => (
                    <button key={m.id} onClick={() => handleMathItem(m.symbol)} className={`${btn} py-3`} aria-label={m.label} title={m.label}>
                      {m.symbol}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PanelShell>
    );
  }

  // ── ORDERING FLOW ───────────────────────────────────────────────────────
  if (sidePanel === 'ordering' && activeSequenceId) {
    const allSeqs = getSequencesForCategory(activeCategoryId ?? '');
    const seq = allSeqs.find((s) => s.id === activeSequenceId);
    if (!seq) return null;
    const step = seq.steps[activeSequenceStep];
    if (!step) return null;
    return (
      <PanelShell>
        <div className={headerRow}>
          <button onClick={() => { tapFeedback(); backToCategories(); }} aria-label="Back to categories" className="aac-btn h-12 px-4 rounded-xl surface-key text-muted text-lg flex items-center justify-center border border-theme">← {t('previous_step')}</button>
          <span className={headerTitle}>{seq.name}</span>
          <span className="text-muted text-lg">{activeSequenceStep + 1}/{seq.steps.length}</span>
        </div>
        <div className="p-4 flex-1 overflow-y-auto min-h-0">
          <p className="text-primary font-bold text-center mb-3 text-2xl md:text-3xl">{step.label}</p>
          <div className="flex flex-col gap-2">
            {step.options.map((opt) => (
              <button key={opt.id} onClick={() => handlePhrase(opt.text)} aria-label={opt.text} className={`${btn} text-left`}>
                {opt.text}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 p-3 border-t border-theme shrink-0">
          <button onClick={prevStep} disabled={activeSequenceStep === 0} aria-label="Previous step" className={`${btn} flex-1 ${activeSequenceStep === 0 ? 'opacity-30' : ''}`}>← Prev</button>
          {activeSequenceStep < seq.steps.length - 1 ? (
            <button onClick={() => nextStep(seq.steps.length)} aria-label="Next step" className={`${btn} flex-1`}>Next →</button>
          ) : (
            <button onClick={finishOrdering} aria-label="Finish ordering" className={`${btn} flex-1 bg-[#4CAF50] text-white border-transparent`}>Done ✓</button>
          )}
        </div>
      </PanelShell>
    );
  }

  // ── CATEGORY DETAIL ─────────────────────────────────────────────────────
  if (sidePanel === 'category-detail' && activeCategoryId) {
    const categories = allCategories();
    const cat = categories.find((c) => c.id === activeCategoryId);
    const phrases = getPhrasesForCategory(activeCategoryId);
    const sequences = getSequencesForCategory(activeCategoryId);
    return (
      <PanelShell>
        <div className={headerRow}>
          <button onClick={backToCategories} className="aac-btn h-12 px-4 rounded-xl surface-key text-muted text-lg flex items-center justify-center border border-theme">← {t('previous_step')}</button>
          <span className={headerTitle}>{cat?.icon} {cat?.name}</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className={closeBtn}>✕</button>
        </div>
        {sequences.length > 0 && (
          <div className="flex gap-2 p-3 border-b border-theme shrink-0">
            {sequences.map((seq) => (
              <button key={seq.id} onClick={() => startOrdering(seq.id)} className={`${btn} flex-1`}>🛒 {seq.name}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 overflow-y-auto flex-1 min-h-0">
          {phrases.map((p) => {
            const firstWord = p.text.split(/\s+/)[0];
            const color = CATEGORY_COLORS[classifyWord(firstWord)];
            return (
              <PhraseTile
                key={p.id}
                phrase={p.text}
                onClick={() => handlePhrase(p.text)}
                className={`${btn} min-h-[96px]`}
                style={{ borderLeftColor: color, borderLeftWidth: '5px' }}
              />
            );
          })}
        </div>
      </PanelShell>
    );
  }

  // ── CATEGORY LIST ───────────────────────────────────────────────────────
  const categories = allCategories();
  return (
    <PanelShell>
      <div className={headerRow}>
        <span className={headerTitle}>{t('categories')}</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className={closeBtn}>✕</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 overflow-y-auto flex-1 min-h-0">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat.id)}
            className={`${btn} flex items-center gap-3 text-left min-h-[72px]`}
          >
            <span className="text-3xl md:text-4xl">{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}
