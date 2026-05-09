'use client';
import { ReactNode, useState, useMemo, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useCategoryStore } from '@/store/categoryStore';
import { usePhraseUsageStore } from '@/store/phraseUsageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { tapFeedback } from '@/services/feedback';
import { useSettingsStore, GridSize } from '@/store/settingsStore';
import { aacSpeak } from '@/services/aacSpeak';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { useT } from '@/engine/useT';
import PhraseTile from './PhraseTile';
import { getPhraseText } from '@/constants/phraseTranslations';

/**
 * Category panel — full-screen AAC board (Image #32/#34 pattern).
 *
 * Layout (critical UX requirement):
 *
 *   ┌─────────────────────────────┬──────┐
 *   │ 🔍 [Search bar — always on] │ ← 🏠 │  ← top bar (search prominent)
 *   ├─────────────────────────────┴──────┤
 *   │                                    │
 *   │       tile grid (full width)       │
 *   │                                    │
 *   ├────────────────────────────────────┤
 *   │   ⌨️  Show / Hide Keyboard  ▲      │  ← full-width keyboard drawer handle
 *   └────────────────────────────────────┘
 *
 * Search and Keyboard toggle are critical in this mode (user requirement).
 * Both get large, obvious touch targets rather than small sidebar icons.
 */

function PanelShell({ children }: { children: ReactNode }) {
  const { t: pt } = useT();
  return (
    <section
      aria-label={pt('aac_panel')}
      className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden"
    >
      {children}
    </section>
  );
}

const GRID_COLS: Record<GridSize, string> = {
  4:  'grid-cols-2',
  6:  'grid-cols-2 sm:grid-cols-3',
  9:  'grid-cols-3',
  12: 'grid-cols-3 sm:grid-cols-4',
  16: 'grid-cols-4',
  20: 'grid-cols-4 sm:grid-cols-5',
};

const TILE_MIN_H: Record<GridSize, string> = {
  4:  'min-h-[clamp(140px,22vw,220px)]',
  6:  'min-h-[clamp(120px,18vw,180px)]',
  9:  'min-h-[clamp(100px,14vw,150px)]',
  12: 'min-h-[clamp(80px,11vw,120px)]',
  16: 'min-h-[clamp(65px,9vw,100px)]',
  20: 'min-h-[clamp(55px,8vw,85px)]',
};

const CLASS_BG: Record<string, string> = {
  verb:        'bg-green-600  text-white border-green-700',
  adjective:   'bg-orange-400 text-white border-orange-500',
  pronoun:     'bg-yellow-400 text-gray-900 border-yellow-500',
  noun:        'bg-blue-400   text-white border-blue-500',
  social:      'bg-pink-400   text-white border-pink-500',
  preposition: 'bg-purple-400 text-white border-purple-500',
  default:     'bg-slate-600  text-white border-slate-700',
};

function wordClassBg(word: string): string {
  const color = CATEGORY_COLORS[classifyWord(word)] ?? '';
  if (color === '#4CAF50' || color === '#43A047') return CLASS_BG.verb;
  if (color === '#FF9800' || color === '#F57C00') return CLASS_BG.adjective;
  if (color === '#FFC107' || color === '#FFB300') return CLASS_BG.pronoun;
  if (color === '#2196F3' || color === '#1976D2') return CLASS_BG.noun;
  if (color === '#E91E63' || color === '#C2185B') return CLASS_BG.social;
  if (color === '#9C27B0' || color === '#7B1FA2') return CLASS_BG.preposition;
  return CLASS_BG.default;
}

const FOLDER_TILE = `aac-btn bg-white dark:bg-slate-100 text-gray-900 rounded-xl border-2 border-gray-300
  flex flex-col items-center justify-center gap-2 p-3 font-bold text-base select-none text-center
  hover:border-[#4CAF50] active:scale-95 transition-transform`;

export default function CategoryPanel() {
  const { t } = useT();
  const {
    sidePanel, activeCategoryId, categoryPath, activeSequenceId, activeSequenceStep,
    categoryKeyboardOpen,
    closeSidePanel, selectCategory, drillIntoCategory, navigateCategoryUp,
    backToCategories, startOrdering, nextStep, prevStep, finishOrdering, toggleCategoryKeyboard,
  } = useUIStore();
  const { appendText, text, autoSpeak, soundEnabled } = useMessageStore();
  const {
    allCategories, getSubcategories, getRankedPhrasesForCategory, getSequencesForCategory,
  } = useCategoryStore();
  const recordPhraseUse = usePhraseUsageStore((s) => s.recordUse);
  const { learnWord } = usePredictionStore();
  const gridSize = useSettingsStore((s) => s.gridSize);
  const language = useSettingsStore((s) => s.language);
  const { speechRate, speechVolume } = useSettingsStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isOpen =
    sidePanel === 'categories' ||
    sidePanel === 'category-detail' ||
    sidePanel === 'ordering';

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Universal search across ALL categories and phrases
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !searchOpen) return [];
    const q = searchQuery.toLowerCase();
    const categories = allCategories();
    const results: Array<{ phrase: string; category: string; phraseId?: string }> = [];
    for (const cat of categories) {
      const phrases = getRankedPhrasesForCategory(cat.id).map((r) => r.phrase);
      for (const p of phrases) {
        const localText = getPhraseText(p.id, language, p.text);
        if (localText.toLowerCase().includes(q) || p.text.toLowerCase().includes(q)) {
          results.push({
            phrase: localText,
            category: cat.nameKey ? t(cat.nameKey) : cat.name,
            phraseId: p.id,
          });
          if (results.length >= 50) return results;
        }
      }
    }
    return results;
  }, [searchQuery, searchOpen, allCategories, getRankedPhrasesForCategory, language, t]);

  if (!isOpen) return null;

  const handlePhrase = (phraseText: string, phraseId?: string) => {
    tapFeedback();
    const existingWords = text.trim().split(/\s+/).filter(Boolean);
    const prevWord = existingWords.at(-1);
    const prevPrevWord = existingWords.at(-2);
    appendText(phraseText);
    const phraseWords = phraseText.trim().split(/\s+/);
    let prev = prevWord;
    let prevPrev = prevPrevWord;
    for (const w of phraseWords) {
      learnWord(w.toLowerCase(), prev?.toLowerCase(), prevPrev?.toLowerCase());
      prevPrev = prev;
      prev = w;
    }
    if (phraseId) recordPhraseUse(phraseId);
    if (autoSpeak && soundEnabled) aacSpeak(phraseText, speechRate, speechVolume);
    if (searchOpen) { setSearchOpen(false); setSearchQuery(''); }
  };

  // ── SHARED: Top bar (search + nav) ──────────────────────────────────────────
  const canGoBack = sidePanel !== 'categories';
  const isDeep = categoryPath.length > 1;

  const handleBack = () => {
    tapFeedback();
    if (isDeep) navigateCategoryUp();
    else backToCategories();
  };

  // The top bar appears in EVERY mode (search is always reachable).
  const TopBar = ({ title }: { title?: string }) => (
    <div className="flex items-stretch shrink-0 border-b border-theme bg-[#3e2a1a]">
      {/* ← Back / nav */}
      {canGoBack ? (
        <button
          onClick={handleBack}
          aria-label="Go back"
          className="aac-btn flex items-center justify-center w-14 shrink-0 text-white text-2xl hover:bg-white/10 active:bg-white/20 border-r border-white/20"
        >
          ←
        </button>
      ) : (
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label="Home"
          className="aac-btn flex items-center justify-center w-14 shrink-0 text-white text-2xl hover:bg-white/10 active:bg-white/20 border-r border-white/20"
        >
          🏠
        </button>
      )}

      {/* 🔍 Search — always visible, large tap target */}
      {searchOpen ? (
        <div className="flex-1 flex items-center gap-2 px-3">
          <span className="text-white/70 text-xl shrink-0">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_vocabulary') || 'Search all vocabulary…'}
            className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-white/50 py-3"
            autoFocus
          />
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            className="aac-btn text-white/70 hover:text-white text-xl px-3 py-3"
            aria-label="Close search"
          >✕</button>
        </div>
      ) : (
        <button
          onClick={() => { tapFeedback(); setSearchOpen(true); setSearchQuery(''); }}
          aria-label="Search all vocabulary"
          className="aac-btn flex-1 flex items-center gap-3 px-4 py-3 text-white/70 hover:text-white hover:bg-white/10 text-left transition-colors"
        >
          <span className="text-2xl">🔍</span>
          <span className="text-base font-medium">
            {title
              ? <span className="text-white font-bold">{title}</span>
              : <span className="opacity-70">{t('search_vocabulary') || 'Search all vocabulary…'}</span>
            }
          </span>
        </button>
      )}

      {/* Home (when back is shown) */}
      {canGoBack && (
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label="Home"
          className="aac-btn flex items-center justify-center w-14 shrink-0 text-white text-2xl hover:bg-white/10 active:bg-white/20 border-l border-white/20"
        >
          🏠
        </button>
      )}
    </div>
  );

  // ── SHARED: Keyboard drawer handle (full-width bottom bar) ───────────────────
  const KeyboardHandle = () => (
    <button
      onClick={() => { tapFeedback(); toggleCategoryKeyboard(); }}
      aria-label={categoryKeyboardOpen ? 'Hide keyboard' : 'Show keyboard'}
      aria-pressed={categoryKeyboardOpen}
      className={`aac-btn w-full shrink-0 flex items-center justify-center gap-3 py-3 px-4
        border-t border-theme font-bold text-base transition-colors select-none
        ${categoryKeyboardOpen
          ? 'bg-[#3e2a1a] text-white'
          : 'surface-key text-primary hover:bg-[#3e2a1a] hover:text-white'
        }`}
    >
      <span className="text-2xl">⌨️</span>
      <span>{categoryKeyboardOpen ? 'Hide Keyboard ▼' : 'Show Keyboard ▲'}</span>
    </button>
  );

  // ── SEARCH RESULTS ───────────────────────────────────────────────────────────
  if (searchOpen && searchQuery.trim()) {
    return (
      <PanelShell>
        <TopBar />
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {searchResults.length === 0 && (
            <p className="text-muted text-center py-8">No results for &quot;{searchQuery}&quot;</p>
          )}
          {searchResults.map((r, i) => (
            <button
              key={i}
              onClick={() => handlePhrase(r.phrase, r.phraseId)}
              className="aac-btn w-full flex items-center justify-between px-4 py-3 rounded-xl surface-key border border-theme text-left"
            >
              <span className="text-primary font-bold text-lg">{r.phrase}</span>
              <span className="text-muted text-xs ml-2 shrink-0">{r.category}</span>
            </button>
          ))}
        </div>
        <KeyboardHandle />
      </PanelShell>
    );
  }

  // ── ORDERING FLOW ────────────────────────────────────────────────────────────
  if (sidePanel === 'ordering' && activeSequenceId) {
    const allSeqs = getSequencesForCategory(activeCategoryId ?? '');
    const seq = allSeqs.find((s) => s.id === activeSequenceId);
    if (!seq) return null;
    const step = seq.steps[activeSequenceStep];
    if (!step) return null;
    return (
      <PanelShell>
        <TopBar title={`${seq.name} — ${step.label}`} />
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-muted text-sm">{activeSequenceStep + 1} / {seq.steps.length}</span>
          </div>
          {step.options.map((opt) => {
            const localOpt = getPhraseText(opt.id, language, opt.text);
            return (
              <button
                key={opt.id}
                onClick={() => handlePhrase(localOpt)}
                className="aac-btn w-full px-4 py-4 rounded-xl surface-key border border-theme text-primary font-bold text-xl text-left"
              >
                {localOpt}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 p-3 border-t border-theme shrink-0">
          <button onClick={prevStep} disabled={activeSequenceStep === 0} className="aac-btn flex-1 py-3 rounded-xl surface-key border border-theme text-primary font-bold disabled:opacity-30">← {t('prev')}</button>
          {activeSequenceStep < seq.steps.length - 1 ? (
            <button onClick={() => nextStep(seq.steps.length)} className="aac-btn flex-1 py-3 rounded-xl surface-key border border-theme text-primary font-bold">{t('next_step')} →</button>
          ) : (
            <button onClick={finishOrdering} className="aac-btn flex-1 py-3 rounded-xl bg-[#4CAF50] text-white font-bold">{t('done')} ✓</button>
          )}
        </div>
        <KeyboardHandle />
      </PanelShell>
    );
  }

  // ── CATEGORY DETAIL — subcategories + phrases ────────────────────────────────
  if (sidePanel === 'category-detail' && activeCategoryId) {
    const categories = allCategories();
    const cat = categories.find((c) => c.id === activeCategoryId);
    const subcategories = getSubcategories(activeCategoryId);
    const phrases = getRankedPhrasesForCategory(activeCategoryId).map((r) => r.phrase);
    const sequences = getSequencesForCategory(activeCategoryId);

    // Breadcrumb
    const breadcrumb = categoryPath
      .map((id) => {
        const found = categories.find((c) => c.id === id);
        return found ? (found.nameKey ? t(found.nameKey) : found.name) : id;
      })
      .join(' › ');

    const title = `${cat?.icon ?? ''} ${cat?.nameKey ? t(cat.nameKey) : cat?.name ?? ''}${categoryPath.length > 1 ? ` · ${breadcrumb}` : ''}`;

    return (
      <PanelShell>
        <TopBar title={title} />
        {sequences.length > 0 && (
          <div className="flex gap-2 px-3 py-2 border-b border-theme shrink-0 overflow-x-auto">
            {sequences.map((seq) => (
              <button key={seq.id} onClick={() => startOrdering(seq.id)}
                className="aac-btn shrink-0 px-4 py-2 rounded-xl surface-key border border-theme text-primary font-bold">
                🛒 {seq.name}
              </button>
            ))}
          </div>
        )}
        <div className={`grid ${GRID_COLS[gridSize]} gap-2 p-3 overflow-y-auto flex-1 min-h-0`}>
          {/* Subcategory folder cards */}
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              onClick={() => { tapFeedback(); drillIntoCategory(sub.id); }}
              className={`${FOLDER_TILE} ${TILE_MIN_H[gridSize]}`}
            >
              <span className="text-4xl leading-none">{sub.icon}</span>
              <span className="leading-tight">{sub.nameKey ? t(sub.nameKey) : sub.name}</span>
            </button>
          ))}
          {/* Phrase tiles */}
          {phrases.map((p) => {
            const localText = getPhraseText(p.id, language, p.text);
            const firstWord = p.text.split(/\s+/)[0];
            const colorBg = wordClassBg(firstWord);
            return (
              <PhraseTile
                key={p.id}
                phrase={localText}
                englishPhrase={p.text}
                onClick={() => handlePhrase(localText, p.id)}
                className={`aac-btn rounded-xl p-2 font-bold text-base select-none text-center border-2 ${TILE_MIN_H[gridSize]} ${colorBg}`}
              />
            );
          })}
        </div>
        <KeyboardHandle />
      </PanelShell>
    );
  }

  // ── CATEGORY LIST — top-level white folder cards ─────────────────────────────
  const topLevelCategories = allCategories().filter((c) => !c.parentId);
  return (
    <PanelShell>
      <TopBar />
      <div className={`grid ${GRID_COLS[gridSize]} gap-2 p-3 overflow-y-auto flex-1 min-h-0`}>
        {topLevelCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { tapFeedback(); selectCategory(cat.id); }}
            className={`${FOLDER_TILE} ${TILE_MIN_H[gridSize]}`}
          >
            <span className="text-4xl leading-none">{cat.icon}</span>
            <span className="leading-tight">{cat.nameKey ? t(cat.nameKey) : cat.name}</span>
          </button>
        ))}
      </div>
      <KeyboardHandle />
    </PanelShell>
  );
}
