'use client';
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

export default function CategoryPanel() {
  const { t } = useT();
  const { sidePanel, activeCategoryId, activeSequenceId, activeSequenceStep,
    closeSidePanel, selectCategory, backToCategories, startOrdering, nextStep, prevStep, finishOrdering } = useUIStore();
  const { appendText, appendWord, text, autoSpeak, soundEnabled } = useMessageStore();
  const { allCategories, getPhrasesForCategory, getSequencesForCategory } = useCategoryStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume } = useSettingsStore();

  if (sidePanel === 'none') return null;

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

  const btn = 'aac-btn bg-[#2a2a3e] rounded-xl p-3 text-[#e0e0e0] font-medium select-none text-center';

  // MATH PANEL
  if (sidePanel === 'math') {
    const basic = MATH_ITEMS.filter(m => m.category === 'basic');
    const advanced = MATH_ITEMS.filter(m => m.category === 'advanced');
    return (
      <div className="w-[300px] bg-[#16162a] border-r border-[#2a2a3e] flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3e]">
          <span className="text-[#888] font-semibold text-sm">{t('math')}</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-11 h-11 rounded-xl bg-[#2a2a3e] text-[#aaa] text-lg flex items-center justify-center">✕</button>
        </div>
        <div className="p-2">
          <p className="text-[#666] text-xs font-semibold mb-1 px-1">{t('basic')}</p>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {basic.map(m => (
              <button key={m.id} onClick={() => handleMathItem(m.symbol)} className={`${btn} text-xl py-2`} title={m.ttsText}>
                {m.symbol}
              </button>
            ))}
          </div>
          <p className="text-[#666] text-xs font-semibold mb-1 px-1">{t('advanced_math')}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {advanced.map(m => (
              <button key={m.id} onClick={() => handleMathItem(m.symbol)} className={`${btn} text-xl py-2`} title={m.ttsText}>
                {m.symbol}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ORDERING FLOW
  if (sidePanel === 'ordering' && activeSequenceId) {
    const allSeqs = getSequencesForCategory(activeCategoryId ?? '');
    const seq = allSeqs.find(s => s.id === activeSequenceId);
    if (!seq) return null;
    const step = seq.steps[activeSequenceStep];
    if (!step) return null;
    return (
      <div className="w-[300px] bg-[#16162a] border-r border-[#2a2a3e] flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3e]">
          <button onClick={() => { tapFeedback(); backToCategories(); }} aria-label="Back to categories" className="aac-btn h-11 px-4 rounded-xl bg-[#2a2a3e] text-[#aaa] text-sm flex items-center justify-center">← {t('previous_step')}</button>
          <span className="text-[#e0e0e0] font-semibold text-sm">{seq.name}</span>
          <span className="text-[#666] text-xs">{activeSequenceStep + 1}/{seq.steps.length}</span>
        </div>
        <div className="p-3 flex-1">
          <p className="text-[#b0b0c0] font-semibold text-center mb-3">{step.label}</p>
          <div className="flex flex-col gap-2">
            {step.options.map(opt => (
              <button key={opt.id} onClick={() => handlePhrase(opt.text)} aria-label={opt.text} className={`${btn} text-left`}>{opt.text}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 p-3 border-t border-[#2a2a3e]">
          <button onClick={prevStep} disabled={activeSequenceStep === 0} aria-label="Previous step" className={`${btn} flex-1 ${activeSequenceStep === 0 ? 'opacity-30' : ''}`}>← Prev</button>
          {activeSequenceStep < seq.steps.length - 1
            ? <button onClick={() => nextStep(seq.steps.length)} aria-label="Next step" className={`${btn} flex-1`}>Next →</button>
            : <button onClick={finishOrdering} aria-label="Finish ordering" className={`${btn} flex-1 bg-[#4CAF50] text-white`}>Done ✓</button>
          }
        </div>
      </div>
    );
  }

  // CATEGORY DETAIL
  if (sidePanel === 'category-detail' && activeCategoryId) {
    const categories = allCategories();
    const cat = categories.find(c => c.id === activeCategoryId);
    const phrases = getPhrasesForCategory(activeCategoryId);
    const sequences = getSequencesForCategory(activeCategoryId);
    return (
      <div className="w-[300px] bg-[#16162a] border-r border-[#2a2a3e] flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3e]">
          <button onClick={backToCategories} className="text-[#888] hover:text-white text-sm">← {t('previous_step')}</button>
          <span className="text-[#e0e0e0] font-semibold text-sm">{cat?.icon} {cat?.name}</span>
          <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-11 h-11 rounded-xl bg-[#2a2a3e] text-[#aaa] text-lg flex items-center justify-center">✕</button>
        </div>
        {sequences.length > 0 && (
          <div className="flex gap-2 p-2 border-b border-[#2a2a3e]">
            {sequences.map(seq => (
              <button key={seq.id} onClick={() => startOrdering(seq.id)} className={`${btn} flex-1 text-sm`}>🛒 {seq.name}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5 p-2 overflow-y-auto flex-1">
          {phrases.map(p => {
            const firstWord = p.text.split(/\s+/)[0];
            const color = CATEGORY_COLORS[classifyWord(firstWord)];
            return (
              <button key={p.id} onClick={() => handlePhrase(p.text)} className={`${btn} min-h-[56px]`} style={{ borderLeft: `4px solid ${color}` }}>{p.text}</button>
            );
          })}
        </div>
      </div>
    );
  }

  // CATEGORY LIST
  const categories = allCategories();
  return (
    <div className="w-[300px] bg-[#16162a] border-r border-[#2a2a3e] flex flex-col shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3e]">
        <span className="text-[#888] font-semibold text-sm">{t('categories')}</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-11 h-11 rounded-xl bg-[#2a2a3e] text-[#aaa] text-lg flex items-center justify-center">✕</button>
      </div>
      <div className="flex flex-col gap-2 p-2 flex-1">
        {categories.map(cat => (
          <button key={cat.id} onClick={() => selectCategory(cat.id)} className={`${btn} flex items-center gap-3 text-left min-h-[56px]`}>
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-base">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
