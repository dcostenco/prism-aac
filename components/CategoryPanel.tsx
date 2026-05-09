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
 * Layout:
 *   [Big tile grid — full width]   [Right sidebar: ⌨️ Back Home Search]
 *
 * Color coding:
 *   • Category folders = white (neutral, clearly "drill in")
 *   • Phrase tiles = color by word class (classifyWord + CATEGORY_COLORS)
 *     green = action/verb, orange = descriptor, blue = noun, etc.
 *
 * Keyboard drawer: tap ⌨️ in sidebar to show/hide the qwerty.
 * Universal search: tap 🔍 to search across ALL categories + phrases.
 */

function PanelShell({ children }: { children: ReactNode }) {
  const { t: pt } = useT();
  return (
    <section
      aria-label={pt('aac_panel')}
      className="flex-1 min-h-0 flex flex-row surface-bar border-y border-theme overflow-hidden"
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

// Color map per word class — Image #34 style
const CLASS_BG: Record<string, string> = {
  verb:       'bg-green-600  text-white border-green-700',
  adjective:  'bg-orange-400 text-white border-orange-500',
  pronoun:    'bg-yellow-400 text-gray-900 border-yellow-500',
  noun:       'bg-blue-400   text-white border-blue-500',
  social:     'bg-pink-400   text-white border-pink-500',
  preposition:'bg-purple-400 text-white border-purple-500',
  default:    'bg-slate-600  text-white border-slate-700',
};

function wordClassBg(word: string): string {
  const color = CATEGORY_COLORS[classifyWord(word)] ?? '';
  // Map the hex color from CATEGORY_COLORS to a Tailwind bg class
  if (color === '#4CAF50' || color === '#43A047') return CLASS_BG.verb;
  if (color === '#FF9800' || color === '#F57C00') return CLASS_BG.adjective;
  if (color === '#FFC107' || color === '#FFB300') return CLASS_BG.pronoun;
  if (color === '#2196F3' || color === '#1976D2') return CLASS_BG.noun;
  if (color === '#E91E63' || color === '#C2185B') return CLASS_BG.social;
  if (color === '#9C27B0' || color === '#7B1FA2') return CLASS_BG.preposition;
  return CLASS_BG.default;
}

export default function CategoryPanel() {
  const { t } = useT();
  const {
    sidePanel, activeCategoryId, activeSequenceId, activeSequenceStep,
    categoryKeyboardOpen,
    closeSidePanel, selectCategory, backToCategories, startOrdering,
    nextStep, prevStep, finishOrdering, toggleCategoryKeyboard,
  } = useUIStore();
  const { appendText, text, autoSpeak, soundEnabled } = useMessageStore();
  const { allCategories, getRankedPhrasesForCategory, getSequencesForCategory } = useCategoryStore();
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

  // Universal search: index all phrases across all categories
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

  // ── RIGHT SIDEBAR ──────────────────────────────────────────────────────────
  const sideBtn = 'aac-btn flex flex-col items-center justify-center gap-1 py-4 w-full text-center select-none shrink-0 hover:bg-white/10 active:bg-white/20 transition-colors';
  const sideIcon = 'text-2xl';
  const sideLabel = 'text-[10px] font-bold uppercase tracking-wide opacity-80';

  const Sidebar = (
    <nav className="flex flex-col w-[72px] shrink-0 bg-[#3e2a1a] text-white border-l border-[#5c3d25] overflow-y-auto">
      {/* Keyboard toggle */}
      <button
        onClick={() => { tapFeedback(); toggleCategoryKeyboard(); }}
        aria-label="Toggle keyboard"
        aria-pressed={categoryKeyboardOpen}
        className={`${sideBtn} ${categoryKeyboardOpen ? 'bg-white/20' : ''}`}
      >
        <span className={sideIcon}>⌨️</span>
        <span className={sideLabel}>{categoryKeyboardOpen ? 'Hide KB' : 'Keyboard'}</span>
      </button>

      <div className="h-px bg-white/20 shrink-0" />

      {/* Back */}
      {sidePanel !== 'categories' && (
        <button onClick={() => { tapFeedback(); backToCategories(); }} aria-label="Go back" className={sideBtn}>
          <span className={sideIcon}>←</span>
          <span className={sideLabel}>Back</span>
        </button>
      )}

      {/* Home */}
      <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close categories" className={sideBtn}>
        <span className={sideIcon}>🏠</span>
        <span className={sideLabel}>Home</span>
      </button>

      <div className="h-px bg-white/20 shrink-0" />

      {/* Search */}
      <button
        onClick={() => { tapFeedback(); setSearchOpen(true); setSearchQuery(''); }}
        aria-label="Search all vocabulary"
        className={`${sideBtn} ${searchOpen ? 'bg-white/20' : ''}`}
      >
        <span className={sideIcon}>🔍</span>
        <span className={sideLabel}>Search</span>
      </button>
    </nav>
  );

  // ── SEARCH OVERLAY ─────────────────────────────────────────────────────────
  if (searchOpen) {
    return (
      <PanelShell>
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-theme shrink-0">
            <span className="text-muted text-xl">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_vocabulary') || 'Search all vocabulary…'}
              className="flex-1 bg-transparent text-primary text-lg outline-none placeholder:text-muted"
              autoFocus
            />
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              className="aac-btn text-muted text-xl px-2"
              aria-label="Close search"
            >✕</button>
          </div>
          {/* Results */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!searchQuery.trim() && (
              <p className="text-muted text-center py-8">Start typing to search all categories…</p>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-muted text-center py-8">No results for "{searchQuery}"</p>
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
        </div>
        {Sidebar}
      </PanelShell>
    );
  }

  // ── ORDERING FLOW ──────────────────────────────────────────────────────────
  if (sidePanel === 'ordering' && activeSequenceId) {
    const allSeqs = getSequencesForCategory(activeCategoryId ?? '');
    const seq = allSeqs.find((s) => s.id === activeSequenceId);
    if (!seq) return null;
    const step = seq.steps[activeSequenceStep];
    if (!step) return null;
    return (
      <PanelShell>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
            <span className="text-primary font-bold text-xl">{seq.name} — {step.label}</span>
            <span className="text-muted">{activeSequenceStep + 1}/{seq.steps.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
        </div>
        {Sidebar}
      </PanelShell>
    );
  }

  // ── CATEGORY DETAIL — phrase grid ──────────────────────────────────────────
  if (sidePanel === 'category-detail' && activeCategoryId) {
    const categories = allCategories();
    const cat = categories.find((c) => c.id === activeCategoryId);
    const phrases = getRankedPhrasesForCategory(activeCategoryId).map((r) => r.phrase);
    const sequences = getSequencesForCategory(activeCategoryId);
    return (
      <PanelShell>
        <div className="flex-1 flex flex-col min-h-0">
          {/* Category header */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-theme shrink-0">
            <span className="text-3xl">{cat?.icon}</span>
            <span className="text-primary font-bold text-xl">{cat?.nameKey ? t(cat.nameKey) : cat?.name}</span>
          </div>
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
          {/* Color-coded phrase tiles */}
          <div className={`grid ${GRID_COLS[gridSize]} gap-2 p-3 overflow-y-auto flex-1 min-h-0`}>
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
        </div>
        {Sidebar}
      </PanelShell>
    );
  }

  // ── CATEGORY LIST — white folder cards ─────────────────────────────────────
  const categories = allCategories();
  return (
    <PanelShell>
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`grid ${GRID_COLS[gridSize]} gap-2 p-3 overflow-y-auto flex-1 min-h-0`}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { tapFeedback(); selectCategory(cat.id); }}
              // White/light background for folders — clearly "drill in" (user: "white - folders")
              className={`aac-btn bg-white dark:bg-slate-100 text-gray-900 rounded-xl border-2 border-gray-300
                          flex flex-col items-center justify-center gap-2 p-3 font-bold
                          text-base select-none text-center ${TILE_MIN_H[gridSize]}
                          hover:border-[#4CAF50] active:scale-95 transition-transform`}
            >
              <span className="text-4xl leading-none">{cat.icon}</span>
              <span className="leading-tight">{cat.nameKey ? t(cat.nameKey) : cat.name}</span>
            </button>
          ))}
        </div>
      </div>
      {Sidebar}
    </PanelShell>
  );
}
