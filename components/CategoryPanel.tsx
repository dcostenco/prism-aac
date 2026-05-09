'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
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
 * Category panel — matches TouchChat-style AAC board (Images #36/#37).
 *
 * HOME view:
 *   [page label "HOME"]
 *   [dense color-coded core vocab grid | right sidebar nav]
 *   [scrollable category tab row at bottom]
 *
 * Category detail view:
 *   [page label "CATEGORY NAME"]
 *   [phrase/subfolder grid          | right sidebar nav]
 *
 * Color scheme (Image #36):
 *   pink   = social/quick (yes, no, hi, help)
 *   yellow = pronouns (I, you, he, she)
 *   green  = verbs (go, want, do, make)
 *   orange = connecting words (a, the, and, or)
 *   blue   = descriptors (more, not, all)
 *   white  = category folders
 *
 * Right sidebar: dark brown #3e2a1a, ~90px, icon + label buttons.
 */

// ── Categories displayed on the HOME core-vocab grid ──────────────────────────
// Order matters: pink first → yellow → green → orange → blue (matches Image #36)
const HOME_CATS_ORDERED = [
  'quick-talk',        // pink  – yes, no, hi, bye
  'help-needs',        // pink  – help, please, stop, done
  'core-pronouns',     // yellow
  'core-verbs',        // green
  'core-little-words', // orange
  'core-descriptors',  // blue
  'feelings',          // purple
  'questions',         // purple
];
const HOME_MAX_PER_CAT = 14;

// ── Tile color by category (for HOME grid) ────────────────────────────────────
const CAT_BG: Record<string, string> = {
  'quick-talk':        'bg-pink-400   text-white   border-pink-500',
  'help-needs':        'bg-pink-300   text-gray-900 border-pink-400',
  'core-pronouns':     'bg-yellow-400 text-gray-900 border-yellow-500',
  'core-verbs':        'bg-green-500  text-white   border-green-700',
  'core-little-words': 'bg-orange-400 text-white   border-orange-600',
  'core-descriptors':  'bg-sky-400    text-white   border-sky-600',
  'feelings':          'bg-purple-400 text-white   border-purple-600',
  'questions':         'bg-purple-300 text-gray-900 border-purple-500',
};

// ── Word-class fallback color (for category-detail tiles) ─────────────────────
function wordBg(text: string): string {
  const c = CATEGORY_COLORS[classifyWord(text.split(/\s+/)[0])] ?? '';
  if (c === '#4CAF50' || c === '#43A047') return 'bg-green-500  text-white   border-green-700';
  if (c === '#FF9800' || c === '#F57C00') return 'bg-orange-400 text-white   border-orange-600';
  if (c === '#FFC107' || c === '#FFB300') return 'bg-yellow-400 text-gray-900 border-yellow-500';
  if (c === '#2196F3' || c === '#1976D2') return 'bg-sky-400    text-white   border-sky-600';
  if (c === '#E91E63' || c === '#C2185B') return 'bg-pink-400   text-white   border-pink-500';
  if (c === '#9C27B0' || c === '#7B1FA2') return 'bg-purple-400 text-white   border-purple-600';
  return 'bg-slate-500 text-white border-slate-700';
}

// ── Grid column classes ───────────────────────────────────────────────────────
const GRID_COLS: Record<GridSize, string> = {
  4:  'grid-cols-2',
  6:  'grid-cols-3',
  9:  'grid-cols-3',
  12: 'grid-cols-4',
  16: 'grid-cols-4',
  20: 'grid-cols-5',
};

const TILE_H: Record<GridSize, string> = {
  4:  'min-h-[clamp(130px,20vw,200px)]',
  6:  'min-h-[clamp(110px,16vw,170px)]',
  9:  'min-h-[clamp(90px,13vw,140px)]',
  12: 'min-h-[clamp(75px,10vw,115px)]',
  16: 'min-h-[clamp(62px,9vw,95px)]',
  20: 'min-h-[clamp(52px,7vw,80px)]',
};

// HOME grid is always dense regardless of gridSize preference
const HOME_COLS  = 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7';
const HOME_TILE_H = 'min-h-[clamp(60px,9vw,100px)]';

// ── Sidebar button ─────────────────────────────────────────────────────────────
const SIDE_BTN = 'aac-btn flex flex-col items-center justify-center gap-1 py-3 px-1 w-full select-none transition-colors hover:bg-white/15 active:bg-white/25 border-b border-white/10 last:border-b-0';

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
  const gridRef = useRef<HTMLDivElement>(null);

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

  // Scroll grid up/down (sidebar ↑↓ buttons)
  const scrollGrid = (dir: 1 | -1) => {
    gridRef.current?.scrollBy({ top: dir * 220, behavior: 'smooth' });
  };

  // Universal search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !searchOpen) return [];
    const q = searchQuery.toLowerCase();
    const cats = allCategories();
    const out: { phrase: string; category: string; phraseId?: string }[] = [];
    for (const cat of cats) {
      for (const { phrase: p } of getRankedPhrasesForCategory(cat.id)) {
        const local = getPhraseText(p.id, language, p.text);
        if (local.toLowerCase().includes(q) || p.text.toLowerCase().includes(q)) {
          out.push({ phrase: local, category: cat.nameKey ? t(cat.nameKey) : cat.name, phraseId: p.id });
          if (out.length >= 50) return out;
        }
      }
    }
    return out;
  }, [searchQuery, searchOpen, allCategories, getRankedPhrasesForCategory, language, t]);

  // HOME grid: core vocab phrases in color-group order (pink → yellow → green → …)
  const homeGridPhrases = useMemo(() => {
    const out: { phrase: ReturnType<typeof getRankedPhrasesForCategory>[number]['phrase']; catId: string }[] = [];
    for (const catId of HOME_CATS_ORDERED) {
      const phrases = getRankedPhrasesForCategory(catId).slice(0, HOME_MAX_PER_CAT).map((r) => r.phrase);
      for (const p of phrases) out.push({ phrase: p, catId });
    }
    return out;
  }, [getRankedPhrasesForCategory]);

  if (!isOpen) return null;

  const handlePhrase = (phraseText: string, phraseId?: string) => {
    tapFeedback();
    const words = text.trim().split(/\s+/).filter(Boolean);
    const prev = words.at(-1);
    const prevPrev = words.at(-2);
    appendText(phraseText);
    let pw = prev;
    let ppw = prevPrev;
    for (const w of phraseText.trim().split(/\s+/)) {
      learnWord(w.toLowerCase(), pw?.toLowerCase(), ppw?.toLowerCase());
      ppw = pw; pw = w;
    }
    if (phraseId) recordPhraseUse(phraseId);
    if (autoSpeak && soundEnabled) aacSpeak(phraseText, speechRate, speechVolume);
    if (searchOpen) { setSearchOpen(false); setSearchQuery(''); }
  };

  const isHome = sidePanel === 'categories';
  const isDeep = categoryPath.length > 1;

  // ── RIGHT SIDEBAR (matches Image #36/#37) ────────────────────────────────────
  // Icon + label, dark brown, 90px wide
  function SidebarBtn({
    icon, label, onClick, active = false, disabled = false,
  }: { icon: string; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
    return (
      <button
        onClick={() => { if (!disabled) { tapFeedback(); onClick(); } }}
        disabled={disabled}
        className={`${SIDE_BTN} ${active ? 'bg-white/20' : ''} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      >
        <span className="text-[22px] leading-none">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-white/85 text-center leading-tight px-0.5">
          {label}
        </span>
      </button>
    );
  }

  function Sidebar({ showCoreWords = false }: { showCoreWords?: boolean }) {
    return (
      <nav className="w-[88px] shrink-0 bg-[#3e2a1a] flex flex-col border-l-2 border-[#5c3d25] overflow-hidden">
        {/* Go back — shown only when NOT on HOME */}
        {!isHome && (
          <SidebarBtn
            icon="←"
            label={isDeep ? 'Up' : 'Go back'}
            onClick={() => { isDeep ? navigateCategoryUp() : backToCategories(); }}
          />
        )}
        <SidebarBtn icon="🏠" label="Home" onClick={closeSidePanel} />
        {showCoreWords && (
          <SidebarBtn icon="⌂" label="Core words" onClick={backToCategories} />
        )}
        {/* Spacer to push search/keyboard to bottom */}
        <div className="flex-1" />
        {/* Scroll up/down (useful in detail view) */}
        {!isHome && (
          <>
            <SidebarBtn icon="↑" label="Up" onClick={() => scrollGrid(-1)} />
            <SidebarBtn icon="↓" label="Down" onClick={() => scrollGrid(1)} />
          </>
        )}
        {/* Keyboard toggle */}
        <SidebarBtn
          icon="⌨️"
          label={categoryKeyboardOpen ? 'Hide KB' : 'Keyboard'}
          onClick={toggleCategoryKeyboard}
          active={categoryKeyboardOpen}
        />
        {/* Search */}
        <SidebarBtn
          icon="🔍"
          label="Search"
          onClick={() => { setSearchOpen((v) => !v); if (!searchOpen) setSearchQuery(''); }}
          active={searchOpen}
        />
      </nav>
    );
  }

  // ── SEARCH PANEL (replaces grid when open) ────────────────────────────────────
  function SearchPanel() {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-theme bg-[#3e2a1a] shrink-0">
          <span className="text-white/60 text-xl">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all vocabulary…"
            className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-white/40 py-2"
            autoFocus
          />
          <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="text-white/50 hover:text-white text-xl px-2">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!searchQuery.trim() && (
            <p className="text-muted text-center py-10">Start typing to search all vocabulary…</p>
          )}
          {searchQuery.trim() && searchResults.length === 0 && (
            <p className="text-muted text-center py-10">No results for &quot;{searchQuery}&quot;</p>
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
    );
  }

  // ── PAGE LABEL (matches reference: centered underlined text between toolbar and grid) ──
  function PageLabel({ label }: { label: string }) {
    return (
      <div className="text-center py-[3px] shrink-0 border-b border-[#5c3d25] bg-[#3e2a1a]">
        <span className="text-white text-xs font-bold uppercase tracking-widest underline underline-offset-2">
          {label}
        </span>
      </div>
    );
  }

  // ── ORDERING FLOW ────────────────────────────────────────────────────────────
  if (sidePanel === 'ordering' && activeSequenceId) {
    const allSeqs = getSequencesForCategory(activeCategoryId ?? '');
    const seq = allSeqs.find((s) => s.id === activeSequenceId);
    if (!seq) return null;
    const step = seq.steps[activeSequenceStep];
    if (!step) return null;
    const label = `${seq.name} — ${step.label}`;
    return (
      <section className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden">
        <PageLabel label={label} />
        <div className="flex flex-row flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-muted text-xs text-right px-1">{activeSequenceStep + 1}/{seq.steps.length}</div>
            {step.options.map((opt) => {
              const local = getPhraseText(opt.id, language, opt.text);
              return (
                <button key={opt.id} onClick={() => handlePhrase(local)}
                  className="aac-btn w-full px-4 py-4 rounded-xl surface-key border border-theme text-primary font-bold text-xl text-left">
                  {local}
                </button>
              );
            })}
            <div className="flex gap-2 pt-2">
              <button onClick={prevStep} disabled={activeSequenceStep === 0}
                className="aac-btn flex-1 py-3 rounded-xl surface-key border border-theme text-primary font-bold disabled:opacity-30">
                ← {t('prev')}
              </button>
              {activeSequenceStep < seq.steps.length - 1 ? (
                <button onClick={() => nextStep(seq.steps.length)}
                  className="aac-btn flex-1 py-3 rounded-xl surface-key border border-theme text-primary font-bold">
                  {t('next_step')} →
                </button>
              ) : (
                <button onClick={finishOrdering} className="aac-btn flex-1 py-3 rounded-xl bg-[#4CAF50] text-white font-bold">
                  {t('done')} ✓
                </button>
              )}
            </div>
          </div>
          <Sidebar showCoreWords />
        </div>
      </section>
    );
  }

  // ── CATEGORY DETAIL VIEW ─────────────────────────────────────────────────────
  if (sidePanel === 'category-detail' && activeCategoryId) {
    const categories = allCategories();
    const cat = categories.find((c) => c.id === activeCategoryId);
    const subcategories = getSubcategories(activeCategoryId);
    const phrases = getRankedPhrasesForCategory(activeCategoryId).map((r) => r.phrase);
    const sequences = getSequencesForCategory(activeCategoryId);
    const catName = cat ? (cat.nameKey ? t(cat.nameKey) : cat.name) : '';
    const catBg = CAT_BG[activeCategoryId];

    return (
      <section aria-label={catName} className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden">
        <PageLabel label={catName} />
        <div className="flex flex-row flex-1 min-h-0">
          {searchOpen ? (
            <SearchPanel />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {sequences.length > 0 && (
                <div className="flex gap-2 px-2 py-1.5 border-b border-theme shrink-0 overflow-x-auto">
                  {sequences.map((seq) => (
                    <button key={seq.id} onClick={() => startOrdering(seq.id)}
                      className="aac-btn shrink-0 px-3 py-1.5 rounded-lg surface-key border border-theme text-primary font-bold text-sm">
                      🛒 {seq.name}
                    </button>
                  ))}
                </div>
              )}
              <div
                ref={gridRef}
                className={`grid ${GRID_COLS[gridSize]} gap-2 p-2 overflow-y-auto flex-1 min-h-0`}
              >
                {/* Subcategory folders — white, same as Image #37 folder tiles */}
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => { tapFeedback(); drillIntoCategory(sub.id); }}
                    className={`aac-btn bg-[#f5ede4] dark:bg-slate-200 text-gray-900 rounded-2xl border-2 border-[#d4b8a0]
                      flex flex-col items-center justify-center gap-2 p-3 font-bold select-none text-center
                      ${TILE_H[gridSize]} hover:border-[#3e2a1a] active:scale-95 transition-transform`}
                  >
                    <span className="text-4xl leading-none">{sub.icon}</span>
                    <span className="text-sm leading-tight uppercase tracking-wide">{sub.nameKey ? t(sub.nameKey) : sub.name}</span>
                  </button>
                ))}
                {/* Phrase tiles — color by category BG or word class */}
                {phrases.map((p) => {
                  const local = getPhraseText(p.id, language, p.text);
                  const bg = catBg ?? wordBg(p.text);
                  return (
                    <PhraseTile
                      key={p.id}
                      phrase={local}
                      englishPhrase={p.text}
                      onClick={() => handlePhrase(local, p.id)}
                      className={`aac-btn rounded-2xl p-2 font-bold text-sm select-none text-center border-2 ${TILE_H[gridSize]} ${bg}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
          <Sidebar showCoreWords />
        </div>
      </section>
    );
  }

  // ── HOME VIEW — core vocab board + category tabs ──────────────────────────────
  const topLevelCats = allCategories().filter((c) => !c.parentId);
  const homeCatSet = new Set(HOME_CATS_ORDERED);
  // Fringe categories shown as folder tiles at the end of the HOME grid
  const fringeCats = topLevelCats.filter((c) => !homeCatSet.has(c.id));

  return (
    <section aria-label="Home vocabulary board" className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden">
      <PageLabel label="HOME" />
      <div className="flex flex-row flex-1 min-h-0">
        {searchOpen ? (
          <SearchPanel />
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Dense core vocab grid */}
            <div className={`grid ${HOME_COLS} gap-1.5 p-2 overflow-y-auto flex-1 min-h-0`}>
              {/* Core word tiles — color coded by category */}
              {homeGridPhrases.map(({ phrase: p, catId }) => {
                const local = getPhraseText(p.id, language, p.text);
                const bg = CAT_BG[catId] ?? 'bg-slate-500 text-white border-slate-600';
                return (
                  <PhraseTile
                    key={p.id}
                    phrase={local}
                    englishPhrase={p.text}
                    onClick={() => handlePhrase(local, p.id)}
                    className={`aac-btn rounded-xl p-1.5 font-bold text-xs sm:text-sm select-none text-center border-2 ${HOME_TILE_H} ${bg}`}
                  />
                );
              })}
              {/* Fringe category folder tiles at end of grid */}
              {fringeCats.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { tapFeedback(); selectCategory(cat.id); }}
                  className={`aac-btn bg-[#f5ede4] dark:bg-slate-200 text-gray-900 rounded-xl border-2 border-[#d4b8a0]
                    flex flex-col items-center justify-center gap-1 p-1.5 font-bold text-xs select-none text-center
                    ${HOME_TILE_H} hover:border-[#3e2a1a] active:scale-95 transition-transform`}
                >
                  <span className="text-2xl sm:text-3xl leading-none">{cat.icon}</span>
                  <span className="leading-tight uppercase tracking-wide text-[10px] sm:text-xs">
                    {cat.nameKey ? t(cat.nameKey) : cat.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Category tabs row — matches bottom nav strip in Image #36 */}
            <div className="flex gap-1 px-2 py-1.5 overflow-x-auto shrink-0 border-t-2 border-[#5c3d25] bg-[#3e2a1a]">
              {topLevelCats.map((cat) => {
                const isCore = homeCatSet.has(cat.id);
                const tabBg = isCore
                  ? (CAT_BG[cat.id] ?? 'bg-white/20 text-white')
                  : 'bg-[#f5ede4] text-gray-900';
                return (
                  <button
                    key={cat.id}
                    onClick={() => { tapFeedback(); selectCategory(cat.id); }}
                    className={`aac-btn shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg
                      border border-white/20 select-none text-center min-w-[52px] ${tabBg}`}
                  >
                    <span className="text-base leading-none">{cat.icon}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide leading-tight max-w-[60px]">
                      {cat.nameKey ? t(cat.nameKey) : cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Right sidebar — matches Image #36/#37 */}
        <Sidebar />
      </div>
    </section>
  );
}
