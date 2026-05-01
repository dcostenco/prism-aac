'use client';
import { ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useCategoryStore } from '@/store/categoryStore';
import { usePredictionStore } from '@/store/predictionStore';
import { tapFeedback } from '@/services/feedback';
import { useSettingsStore, GridSize } from '@/store/settingsStore';
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

const MATH_GROUPS: { key: MathCategory; labelKey: string }[] = [
  { key: 'basic',       labelKey: 'Basic' },
  { key: 'digits',      labelKey: 'Numbers' },
  { key: 'algebra',     labelKey: 'Algebra' },
  { key: 'constants',   labelKey: 'Constants' },
  { key: 'trig',        labelKey: 'Trigonometry' },
  { key: 'calculus',    labelKey: 'Calculus' },
  { key: 'greek',       labelKey: 'Greek letters' },
  { key: 'logic-sets',  labelKey: 'Logic & sets' },
];

const GRID_COLS: Record<GridSize, string> = {
  4:  'grid-cols-2',
  6:  'grid-cols-2 md:grid-cols-3',
  9:  'grid-cols-3',
  12: 'grid-cols-3 md:grid-cols-4',
  16: 'grid-cols-4',
  20: 'grid-cols-4 md:grid-cols-5',
};

const TILE_MIN_H: Record<GridSize, string> = {
  4:  'min-h-[clamp(120px,22vw,180px)]',
  6:  'min-h-[clamp(100px,18vw,150px)]',
  9:  'min-h-[clamp(80px,15vw,120px)]',
  12: 'min-h-[clamp(70px,12vw,100px)]',
  16: 'min-h-[clamp(60px,10vw,90px)]',
  20: 'min-h-[clamp(50px,8vw,80px)]',
};

export default function CategoryPanel() {
  const { t } = useT();
  const {
    sidePanel, activeCategoryId, activeSequenceId, activeSequenceStep,
    closeSidePanel, selectCategory, backToCategories, startOrdering, nextStep, prevStep, finishOrdering,
  } = useUIStore();
  const { appendText, appendWord, text, autoSpeak, soundEnabled } = useMessageStore();
  const { allCategories, getPhrasesForCategory, getSequencesForCategory } = useCategoryStore();
  const { learnWord } = usePredictionStore();
  const gridSize = useSettingsStore((s) => s.gridSize);
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
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(48px, 8vw, 72px), 1fr))' }}>
                  {items.map((m) => (
                    <button key={m.id} onClick={() => handleMathItem(m.symbol)} className="aac-btn surface-key text-primary rounded-xl font-bold text-[clamp(1rem,2.5vw,1.5rem)] select-none text-center border border-theme p-2 aspect-square flex items-center justify-center" aria-label={m.label} title={m.label}>
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
          <span className={headerTitle}>{cat?.icon} {cat?.nameKey ? t(cat.nameKey) : cat?.name}</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className={closeBtn}>✕</button>
        </div>
        {sequences.length > 0 && (
          <div className="flex gap-2 p-3 border-b border-theme shrink-0">
            {sequences.map((seq) => (
              <button key={seq.id} onClick={() => startOrdering(seq.id)} className={`${btn} flex-1`}>🛒 {seq.name}</button>
            ))}
          </div>
        )}
        <div className={`grid ${GRID_COLS[gridSize]} gap-2 p-3 overflow-y-auto flex-1 min-h-0`}>
          {phrases.map((p) => {
            const firstWord = p.text.split(/\s+/)[0];
            const color = CATEGORY_COLORS[classifyWord(firstWord)];
            return (
              <PhraseTile
                key={p.id}
                phrase={p.text}
                onClick={() => handlePhrase(p.text)}
                className={`${btn} ${TILE_MIN_H[gridSize]}`}
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
      <div className={`grid ${GRID_COLS[gridSize]} gap-2 p-3 overflow-y-auto flex-1 min-h-0`}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat.id)}
            className={`${btn} flex items-center gap-3 text-left ${TILE_MIN_H[gridSize]}`}
          >
            <span className="text-3xl md:text-4xl">{cat.icon}</span>
            <span>{cat.nameKey ? t(cat.nameKey) : cat.name}</span>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}
