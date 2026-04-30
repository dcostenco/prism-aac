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
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { useT } from '@/engine/useT';

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      // Backdrop is semi-transparent by default; high-contrast mode swaps in
      // a fully opaque background (CSS in globals.css) so users with low
      // vision aren't asked to read the modal through bleed-through chrome.
      className="modal-backdrop fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-6"
      onClick={onClose}
    >
      <div
        className="surface-bar w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl flex flex-col max-h-[90svh] md:max-h-[80svh] border border-theme overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

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

  // Tile/list buttons share the same scale as the toolbar + keyboard word
  // row — text-xl/md:text-2xl, bold — so the whole app reads as one
  // typographic system. Larger glyphs also help users with reduced acuity.
  const btn = 'aac-btn surface-key text-primary rounded-xl p-3 font-bold text-xl md:text-2xl select-none text-center border border-theme';

  // MATH PANEL
  if (sidePanel === 'math') {
    const basic = MATH_ITEMS.filter((m) => m.category === 'basic');
    const advanced = MATH_ITEMS.filter((m) => m.category === 'advanced');
    return (
      <ModalShell onClose={closeSidePanel}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <span className="text-primary font-bold text-2xl md:text-3xl">{t('math')}</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-11 h-11 rounded-xl surface-key text-muted text-lg flex items-center justify-center border border-theme">✕</button>
        </div>
        <div className="p-3 overflow-y-auto">
          <p className="text-muted text-xs font-semibold mb-2 px-1 uppercase tracking-wider">{t('basic')}</p>
          <div className="grid grid-cols-5 md:grid-cols-6 gap-2 mb-4">
            {basic.map((m) => (
              <button key={m.id} onClick={() => handleMathItem(m.symbol)} className={`${btn} text-xl py-3`} title={m.ttsText}>
                {m.symbol}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs font-semibold mb-2 px-1 uppercase tracking-wider">{t('advanced_math')}</p>
          <div className="grid grid-cols-5 md:grid-cols-6 gap-2">
            {advanced.map((m) => (
              <button key={m.id} onClick={() => handleMathItem(m.symbol)} className={`${btn} text-xl py-3`} title={m.ttsText}>
                {m.symbol}
              </button>
            ))}
          </div>
        </div>
      </ModalShell>
    );
  }

  // ORDERING FLOW
  if (sidePanel === 'ordering' && activeSequenceId) {
    const allSeqs = getSequencesForCategory(activeCategoryId ?? '');
    const seq = allSeqs.find((s) => s.id === activeSequenceId);
    if (!seq) return null;
    const step = seq.steps[activeSequenceStep];
    if (!step) return null;
    return (
      <ModalShell onClose={closeSidePanel}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <button onClick={() => { tapFeedback(); backToCategories(); }} aria-label="Back to categories" className="aac-btn h-11 px-4 rounded-xl surface-key text-muted text-base flex items-center justify-center border border-theme">← {t('previous_step')}</button>
          <span className="text-primary font-bold text-2xl md:text-3xl">{seq.name}</span>
          <span className="text-muted text-base">{activeSequenceStep + 1}/{seq.steps.length}</span>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-primary font-bold text-center mb-3 text-2xl md:text-3xl">{step.label}</p>
          <div className="flex flex-col gap-2">
            {step.options.map((opt) => (
              <button key={opt.id} onClick={() => handlePhrase(opt.text)} aria-label={opt.text} className={`${btn} text-left`}>
                {opt.text}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 p-3 border-t border-theme">
          <button onClick={prevStep} disabled={activeSequenceStep === 0} aria-label="Previous step" className={`${btn} flex-1 ${activeSequenceStep === 0 ? 'opacity-30' : ''}`}>← Prev</button>
          {activeSequenceStep < seq.steps.length - 1 ? (
            <button onClick={() => nextStep(seq.steps.length)} aria-label="Next step" className={`${btn} flex-1`}>Next →</button>
          ) : (
            <button onClick={finishOrdering} aria-label="Finish ordering" className={`${btn} flex-1 bg-[#4CAF50] text-white border-transparent`}>Done ✓</button>
          )}
        </div>
      </ModalShell>
    );
  }

  // CATEGORY DETAIL
  if (sidePanel === 'category-detail' && activeCategoryId) {
    const categories = allCategories();
    const cat = categories.find((c) => c.id === activeCategoryId);
    const phrases = getPhrasesForCategory(activeCategoryId);
    const sequences = getSequencesForCategory(activeCategoryId);
    return (
      <ModalShell onClose={closeSidePanel}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <button onClick={backToCategories} className="text-muted hover:text-primary text-base">← {t('previous_step')}</button>
          <span className="text-primary font-bold text-2xl md:text-3xl">{cat?.icon} {cat?.name}</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme">✕</button>
        </div>
        {sequences.length > 0 && (
          <div className="flex gap-2 p-3 border-b border-theme">
            {sequences.map((seq) => (
              <button key={seq.id} onClick={() => startOrdering(seq.id)} className={`${btn} flex-1`}>🛒 {seq.name}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 overflow-y-auto flex-1">
          {phrases.map((p) => {
            const firstWord = p.text.split(/\s+/)[0];
            const color = CATEGORY_COLORS[classifyWord(firstWord)];
            return (
              <button
                key={p.id}
                onClick={() => handlePhrase(p.text)}
                className={`${btn} min-h-[72px]`}
                style={{ borderLeftColor: color, borderLeftWidth: '5px' }}
              >
                {p.text}
              </button>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  // CATEGORY LIST
  const categories = allCategories();
  return (
    <ModalShell onClose={closeSidePanel}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
        <span className="text-primary font-bold text-2xl md:text-3xl">{t('categories')}</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme">✕</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 overflow-y-auto flex-1">
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
    </ModalShell>
  );
}
