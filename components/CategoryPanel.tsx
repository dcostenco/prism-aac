'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useCategoryStore } from '@/store/categoryStore';
import { usePhraseUsageStore } from '@/store/phraseUsageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { tapFeedback } from '@/services/feedback';
import { ddAction } from '@/lib/datadog';
import { useSettingsStore, GridSize } from '@/store/settingsStore';
import { aacSpeak } from '@/services/aacSpeak';
import { speakWord } from '@/services/speechService';
import { warmupAzureAudio } from '@/services/azureTTS';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { useT } from '@/engine/useT';
import PhraseTile from './PhraseTile';
import Keyboard from './Keyboard';
import { getPhraseText } from '@/constants/phraseTranslations';
import { registerSearchKeyHandler } from '@/services/searchKeyBridge';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
import { useAuthStore } from '@/store/authStore';
import { useNearViewport } from '@/hooks/useNearViewport';

// ── Categories on the HOME core-vocab grid ────────────────────────────────────
// Pink → yellow → green → orange → blue (matches Image #36 left-to-right)
const HOME_CATS_ORDERED = [
  'quick-talk',        // pink  – yes, no, hi, bye
  'help-needs',        // pink  – help, please, stop, done
  'core-pronouns',     // yellow
  'core-verbs',        // green
  'core-little-words', // orange
  'core-descriptors',  // sky/blue
  'feelings',          // purple
  'questions',         // purple
];
const HOME_MAX_PER_CAT = 14;

// ── Tile background colors by category ───────────────────────────────────────
// Text colour is NOT a style choice here — it is legibility on a device
// someone speaks through.
//
// White text on these mid-tone backgrounds measured 2.2-2.8:1 against WCAG,
// well under the 4.5:1 minimum, and at 13.5px on the tiles. Reported from a
// real device as "I can't clearly see what is written". The entries that
// already used text-gray-900 measured 9.7-11.3:1 on the very same palette, so
// the fix is to follow the half of this map that was already right.
//
// Measured after the change, in-browser with sRGB conversion (oklch must be
// resolved through a canvas — reading the computed value and treating it as
// RGB silently produces nonsense, which inverted these numbers on my first
// pass). Guarded by tests/category-contrast.test.ts.
const CAT_BG: Record<string, string> = {
  'quick-talk':        'bg-pink-400   text-gray-900 border-pink-500',
  'help-needs':        'bg-pink-300   text-gray-900 border-pink-400',
  'core-pronouns':     'bg-yellow-400 text-gray-900 border-yellow-500',
  'core-verbs':        'bg-green-500  text-gray-900 border-green-700',
  'core-little-words': 'bg-orange-400 text-gray-900 border-orange-600',
  'core-descriptors':  'bg-sky-400    text-gray-900 border-sky-600',
  'feelings':          'bg-purple-400 text-gray-900 border-purple-600',
  'questions':         'bg-purple-300 text-gray-900 border-purple-500',
};

// Word-class color for category-detail phrase tiles
function wordBg(text: string): string {
  const c = CATEGORY_COLORS[classifyWord(text.split(/\s+/)[0])] ?? '';
  if (c === '#4CAF50' || c === '#43A047') return 'bg-green-500  text-gray-900 border-green-700';
  if (c === '#FF9800' || c === '#F57C00') return 'bg-orange-400 text-gray-900 border-orange-600';
  if (c === '#FFC107' || c === '#FFB300') return 'bg-yellow-400 text-gray-900 border-yellow-500';
  if (c === '#2196F3' || c === '#1976D2') return 'bg-sky-400    text-gray-900 border-sky-600';
  if (c === '#E91E63' || c === '#C2185B') return 'bg-pink-400   text-gray-900 border-pink-500';
  if (c === '#9C27B0' || c === '#7B1FA2') return 'bg-purple-400 text-gray-900 border-purple-600';
  return 'bg-slate-500 text-white border-slate-700';
}

// Category detail columns — always at least 1 col on very small screens
// Columns are forced at all breakpoints so the user's chosen grid size
// actually takes effect on tablets and wide screens (not overridden by sm:).
const GRID_COLS: Record<GridSize, string> = {
  4:  'grid-cols-2',
  6:  'grid-cols-3',
  9:  'grid-cols-3',
  12: 'grid-cols-4',
  16: 'grid-cols-4',
  20: 'grid-cols-5',
};

// Normal tile heights (keyboard hidden)
const TILE_H: Record<GridSize, string> = {
  4:  'min-h-[clamp(90px,14vw,140px)]',
  6:  'min-h-[clamp(80px,11vw,110px)]',
  9:  'min-h-[clamp(70px,9vw,95px)]',
  12: 'min-h-[clamp(60px,8vw,85px)]',
  16: 'min-h-[clamp(52px,7vw,75px)]',
  20: 'min-h-[clamp(44px,6vw,65px)]',
};

// Compact tile heights when keyboard drawer is open.
// Use BOTH min-h AND max-h (same value = fixed height) so tiles can never
// expand beyond the cap — min-h alone is insufficient because flex/grid
// children can still grow past their min-height when content overflows.
const TILE_H_KB: Record<GridSize, string> = {
  4:  'min-h-[clamp(100px,16svh,160px)]',
  6:  'min-h-[clamp(90px,14svh,140px)]',
  9:  'min-h-[clamp(80px,12svh,120px)]',
  12: 'min-h-[clamp(72px,10svh,100px)]',
  16: 'min-h-[clamp(64px,8svh,90px)]',
  20: 'min-h-[clamp(56px,7svh,80px)]',
};

// Landscape compact tile heights — minimal for phone landscape where
// vertical space is ≤390px after safe-area insets.
const TILE_H_COMPACT: Record<GridSize, string> = {
  4:  'min-h-[clamp(48px,10svh,70px)]',
  6:  'min-h-[clamp(44px,9svh,64px)]',
  9:  'min-h-[clamp(40px,8svh,58px)]',
  12: 'min-h-[clamp(36px,7svh,52px)]',
  16: 'min-h-[clamp(32px,6svh,46px)]',
  20: 'min-h-[clamp(28px,5svh,40px)]',
};

// HOME board columns: 2 on phones (readable tiles), more on tablet/desktop
const HOME_COLS        = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7';
const HOME_TILE_H      = 'min-h-[clamp(90px,15vw,160px)]';
const HOME_TILE_H_KB   = 'min-h-[clamp(80px,14svh,140px)]';
const HOME_TILE_H_COMPACT = 'min-h-[clamp(40px,9svh,60px)]';

// Folder tile style — pure white background, clearly "drill in"
const FOLDER_CLS = 'aac-btn bg-white text-gray-900 rounded-xl border-2 border-gray-300 flex flex-col items-center justify-center gap-1 font-bold select-none text-center hover:border-[#3e2a1a] active:scale-95 transition-transform';

// ── Sidebar button — MODULE LEVEL so React never remounts it ──────────────────
interface SideBtnProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  testId?: string;
  dataAction?: string;
}
function SidebarBtn({ icon, label, onClick, active = false, testId, dataAction }: SideBtnProps) {
  return (
    <button
      onClick={() => { tapFeedback(); onClick(); }}
      data-testid={testId}
      data-action={dataAction}
      className={`aac-btn flex flex-col items-center justify-center gap-[3px] px-1 w-full select-none
        border-b border-white/10 last:border-b-0 hover:bg-white/15 active:bg-white/25 transition-colors
        ${active ? 'bg-white/20' : ''}`}
      style={{ minHeight: 'clamp(56px, 8svh, 80px)' }}
    >
      <span className="text-[clamp(18px,2.8vw,26px)] leading-none">{icon}</span>
      <span className="text-[clamp(10px,1.2vw,12px)] font-bold uppercase tracking-wide text-white/90 text-center leading-none px-0.5">
        {label}
      </span>
    </button>
  );
}

// ── Page label — MODULE LEVEL ──────────────────────────────────────────────────
function PageLabel({ label }: { label: string }) {
  return (
    <div className="text-center py-[3px] shrink-0 border-b border-[#5c3d25] bg-[#3e2a1a]">
      <span className="text-white text-xs font-bold uppercase tracking-widest underline underline-offset-2">
        {label}
      </span>
    </div>
  );
}

// ── Lightweight pictogram for search results ──────────────────────────────────
function SearchResultIcon({ phrase, language }: { phrase: string; language: string }) {
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const [url, setUrl] = useState<string | null>(null);
  const { elementRef, isNearViewport } = useNearViewport<HTMLSpanElement>();
  useEffect(() => {
    if (!isNearViewport) return;
    let cancelled = false;
    getPictogramUrl(phrase, 'en', pictureMode)
      .then(u => { if (!cancelled) setUrl(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [phrase, pictureMode, language, isNearViewport]);
  return (
    <span ref={elementRef} className="w-8 h-8 shrink-0 rounded">
      {url && (
        <img src={url} alt="" aria-hidden className="w-full h-full object-contain rounded" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      )}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CategoryPanel() {
  const { t } = useT();
  const {
    sidePanel, activeCategoryId, categoryPath, activeSequenceId, activeSequenceStep,
    categoryKeyboardOpen, keyboardMaximized,
    closeSidePanel, selectCategory, drillIntoCategory, navigateCategoryUp,
    backToCategories, startOrdering, nextStep, prevStep, finishOrdering, toggleCategoryKeyboard, cycleKeyboardMode,
  } = useUIStore();
  const appendText = useMessageStore((s) => s.appendText);
  const text = useMessageStore((s) => s.text);
  const autoSpeak = useMessageStore((s) => s.autoSpeak);
  const soundEnabled = useMessageStore((s) => s.soundEnabled);
  const allCategories = useCategoryStore((s) => s.allCategories);
  const getSubcategories = useCategoryStore((s) => s.getSubcategories);
  const getRankedPhrasesForCategory = useCategoryStore((s) => s.getRankedPhrasesForCategory);
  const getSequencesForCategory = useCategoryStore((s) => s.getSequencesForCategory);
  const recordPhraseUse = usePhraseUsageStore((s) => s.recordUse);
  const learnWord = usePredictionStore((s) => s.learnWord);
  const gridSize = useSettingsStore((s) => s.gridSize);
  const language = useSettingsStore((s) => s.language);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const speechVolume = useSettingsStore((s) => s.speechVolume);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridPage, setGridPage] = useState(0);
  const activeCatIdForReset = useUIStore((s) => s.activeCategoryId);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- category/grid changes must reset pagination before rendering an out-of-range page
  useEffect(() => { setGridPage(0); }, [activeCatIdForReset, gridSize]);
  const [compactMode, setCompactMode] = useState(false);
  const wasCompactRef = useRef(false);
  useEffect(() => {
    const check = () => {
      const compact = window.matchMedia('(orientation: landscape)').matches && window.innerHeight < 500;
      setCompactMode(compact);
      const s = useUIStore.getState();
      // Phone landscape can't fit grid + keyboard drawer — auto-maximize
      // so the user gets a full-size keyboard (touchability for AAC users).
      //
      // Session-only, deliberately not persisted. This used to write
      // prism-kb-max='true' — which is the user's own saved preference — so a
      // single rotation into landscape silently rewrote it, and the phrase
      // grid stayed hidden back in portrait until they found the toggle.
      if (compact) {
        if (s.categoryKeyboardOpen && !s.keyboardMaximized) {
          useUIStore.setState({ keyboardMaximized: true });
        }
      } else if (wasCompactRef.current) {
        // Back to portrait: hand control to whatever the user actually chose.
        let persisted = false;
        try {
          persisted = localStorage.getItem('prism-kb-max') === 'true';
        } catch {}
        if (s.keyboardMaximized !== persisted) {
          useUIStore.setState({ keyboardMaximized: persisted });
        }
      }
      wasCompactRef.current = compact;
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);

  const isOpen =
    sidePanel === 'none' ||
    sidePanel === 'categories' ||
    sidePanel === 'category-detail' ||
    sidePanel === 'ordering';

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus the search input and register the search key bridge so on-screen
  // keyboard presses are routed here instead of the message bar.
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
      // Route on-screen keyboard keys to the search input
      registerSearchKeyHandler((char) => {
        if (char === '\b' || char === 'Backspace') {
          setSearchQuery((q) => q.slice(0, -1));
        } else {
          setSearchQuery((q) => q + char);
        }
      });
    } else {
      registerSearchKeyHandler(null);
    }
    return () => { registerSearchKeyHandler(null); };
  }, [searchOpen]);

  const scrollGrid = (dir: 1 | -1) =>
    gridRef.current?.scrollBy({ top: dir * 220, behavior: 'smooth' });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !searchOpen) return [];
    const trimmed = searchQuery.trim();
    if ([...trimmed].length < 1 || trimmed.length > 200) return [];
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

  const homeGridPhrases = useMemo(() => {
    const out: { phrase: ReturnType<typeof getRankedPhrasesForCategory>[number]['phrase']; catId: string }[] = [];
    for (const catId of HOME_CATS_ORDERED) {
      for (const { phrase: p } of getRankedPhrasesForCategory(catId).slice(0, HOME_MAX_PER_CAT)) {
        out.push({ phrase: p, catId });
      }
    }
    return out;
  }, [getRankedPhrasesForCategory]);

  if (!isOpen) return null;

  const handlePhrase = (phraseText: string, phraseId?: string) => {
    tapFeedback();
    // Resume AudioContext synchronously inside the user gesture. iOS Safari
    // (and WKWebView) require the resume() call to be in the synchronous call
    // stack of a touchstart/click — if we only resume inside decodeAndPlay
    // (after await fetch), the gesture token is gone and the context stays
    // suspended → silent. interrupt=true lets this press override any
    // still-playing source from the previous tile (PROTECT_PLAY_MS bypass).
    void warmupAzureAudio();
    // Lowercase phrase words when appending mid-sentence — tile labels are stored
    // in Title Case ("Do", "Like") for display, but composing "like to do" should
    // not capitalise mid-sentence words. Keep single "I" uppercase (English pronoun).
    const toAppend = phraseText
      .split(/\s+/)
      .map((w) => (w === 'I' ? 'I' : w.toLowerCase()))
      .join(' ');
    const words = text.trim().split(/\s+/).filter(Boolean);
    let pw = words.at(-1);
    let ppw = words.at(-2);
    appendText(toAppend);
    for (const w of toAppend.trim().split(/\s+/)) {
      learnWord(w.toLowerCase(), pw?.toLowerCase(), ppw?.toLowerCase());
      ppw = pw; pw = w;
    }
    if (phraseId) recordPhraseUse(phraseId);
    ddAction('aac.phrase_tap', { categoryId: activeCategoryId, phraseLength: toAppend.length });
    if (autoSpeak && soundEnabled) {
      const { language, outputLanguage } = useSettingsStore.getState();
      const fullPhrase = text.trim() ? `${text.trim()} ${toAppend}` : toAppend;
      if (language !== outputLanguage) {
        // Every vocabulary tap is a communication action. Translate and speak
        // the complete accumulated message immediately, including one-word
        // tiles, instead of requiring the user to press Play afterward.
        void aacSpeak(fullPhrase, speechRate, speechVolume, undefined, true);
      } else {
        // Use the quality-first speech path while preserving the cumulative
        // AAC phrase contract.
        speakWord(fullPhrase, speechRate, speechVolume);
      }
    }
    if (searchOpen) { setSearchOpen(false); setSearchQuery(''); }
  };

  const isHome = sidePanel === 'categories' || sidePanel === 'none';
  const isDeep = categoryPath.length > 1;

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
    // Always show the keyboard immediately when entering search mode so the
    // user can type right away without tapping the Keyboard button.
    if (!categoryKeyboardOpen) toggleCategoryKeyboard();
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    registerSearchKeyHandler(null);
  };
  const handleBack = () => { isDeep ? navigateCategoryUp() : backToCategories(); };

  // ── SIDEBAR JSX (inlined — not a component, so no remounting) ───────────────
  // ⌨️ is FIRST — always visible even when keyboard is open and shrinks the panel.
  // No flex-1 spacer: all buttons compact from top so nothing gets clipped.
  const sidebarJsx = (showCoreWords = false) => (
    <nav className="w-[clamp(72px,9vw,96px)] shrink-0 bg-[#3e2a1a] flex flex-col border-l-2 border-[#5c3d25] overflow-y-auto overflow-x-hidden">
      {/* Keyboard toggle — ALWAYS FIRST so it's always reachable */}
      <SidebarBtn
        icon="⌨️"
        label={categoryKeyboardOpen && keyboardMaximized ? t('sidebar_hide_kb') : t('sidebar_kb')}
        onClick={cycleKeyboardMode}
        active={categoryKeyboardOpen && keyboardMaximized}
        testId="kb-cycle-btn"
        dataAction={categoryKeyboardOpen && keyboardMaximized ? 'kb-minimize' : undefined}
      />
      {/* Search */}
      <SidebarBtn icon="🔍" label={t('sidebar_search')} onClick={searchOpen ? closeSearch : openSearch} active={searchOpen} />
      {/* Navigation */}
      {!isHome && <SidebarBtn icon="←" label={isDeep ? t('sidebar_up') : t('sidebar_back')} onClick={handleBack} />}
      <SidebarBtn icon="🏠" label={t('home')} onClick={closeSidePanel} />
      {showCoreWords && <SidebarBtn icon="⌂" label={t('sidebar_words')} onClick={backToCategories} />}
      {/* Scroll helpers */}
      <SidebarBtn icon="↑" label={t('sidebar_up')} onClick={() => scrollGrid(-1)} />
      <SidebarBtn icon="↓" label={t('sidebar_down')} onClick={() => scrollGrid(1)} />
      {/* Fills remaining height so the whole nav area is tappable */}
      <div className="flex-1" />
    </nav>
  );

  // ── SEARCH PANEL JSX (inlined) ───────────────────────────────────────────────
  const searchPanelJsx = (
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-theme bg-[#3e2a1a] shrink-0">
        <span className="text-white/60 text-xl">🔍</span>
        <input
          ref={searchInputRef}
          type="text"
          inputMode="none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search all vocabulary…"
          className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-white/40 py-2"
          maxLength={200}
          autoFocus
          aria-label="Search all vocabulary"
          aria-controls="category-search-results"
          aria-autocomplete="list"
        />
        <button onClick={closeSearch} className="text-white/50 hover:text-white text-xl px-2">✕</button>
      </div>
      <div id="category-search-results" className="flex-1 overflow-y-auto p-3 space-y-2">
        {!searchQuery.trim() && <p className="text-muted text-center py-10">Start typing to search all vocabulary…</p>}
        {searchQuery.trim() && searchResults.length === 0 && <p className="text-muted text-center py-10">No results for &quot;{searchQuery.slice(0, 50)}{searchQuery.length > 50 ? '…' : ''}&quot;</p>}
        {searchResults.map((r) => (
          <button key={r.phraseId ?? `${r.category ?? ''}:${r.phrase ?? ''}`} onClick={() => handlePhrase(r.phrase, r.phraseId)}
            className="aac-btn w-full flex items-center justify-between px-4 py-3 rounded-xl surface-key border border-theme text-left">
            <SearchResultIcon phrase={r.phrase} language={language} />
            <span className="text-primary font-bold text-lg flex-1 min-w-0 truncate">{r.phrase}</span>
            <span className="text-muted text-xs ml-2 shrink-0">{r.category}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── ORDERING ─────────────────────────────────────────────────────────────────
  if (sidePanel === 'ordering' && activeSequenceId) {
    const allSeqs = getSequencesForCategory(activeCategoryId ?? '');
    const seq = allSeqs.find((s) => s.id === activeSequenceId);
    if (!seq) return null;
    const step = seq.steps[activeSequenceStep];
    if (!step) return null;
    return (
      <section className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden">
        <PageLabel label={`${seq.name} — ${step.label}`} />
        <div className="flex flex-row flex-1 min-h-0">
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className={`flex-1 flex flex-col min-h-0 ${categoryKeyboardOpen && keyboardMaximized ? 'hidden' : ''}`}>
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
            </div>
            {categoryKeyboardOpen && (
              <div className={keyboardMaximized ? "flex-1 min-h-0 flex flex-col" : `shrink-0 ${compactMode ? 'h-[clamp(80px,24svh,120px)]' : 'h-[clamp(170px,25svh,260px)]'} flex flex-col`} data-testid="keyboard-shell" data-maximized={keyboardMaximized || undefined}>
                <Keyboard />
              </div>
            )}
          </div>
          {!(categoryKeyboardOpen && keyboardMaximized) && sidebarJsx(true)}
        </div>
      </section>
    );
  }

  // ── CATEGORY DETAIL ───────────────────────────────────────────────────────────
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
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className={`flex-1 flex flex-col min-h-0 ${categoryKeyboardOpen && keyboardMaximized ? 'hidden' : ''}`}>
              {searchOpen ? searchPanelJsx : (
                <div className="flex-1 min-w-0 flex flex-col min-h-0">
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
              {(() => {
                const allItems = [
                  ...subcategories.map(sub => ({ type: 'folder' as const, data: sub })),
                  ...phrases.map(p => ({ type: 'phrase' as const, data: p })),
                ];
                const totalPages = Math.max(1, Math.ceil(allItems.length / gridSize));
                const safePage = Math.min(gridPage, totalPages - 1);
                const pageItems = allItems.slice(safePage * gridSize, (safePage + 1) * gridSize);
                const showPager = totalPages > 1;
                return (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div ref={gridRef} className={`grid ${GRID_COLS[gridSize]} gap-2 p-2 flex-1 min-h-0 content-start`}>
                      {pageItems.map(item => {
                        if (item.type === 'folder') {
                          const sub = item.data;
                          return (
                            <button key={sub.id} onClick={() => { tapFeedback(); drillIntoCategory(sub.id); }}
                              aria-label={sub.nameKey ? t(sub.nameKey) : sub.name}
                              className={`${FOLDER_CLS} p-3 ${categoryKeyboardOpen ? TILE_H_KB[gridSize] : TILE_H[gridSize]}`}>
                              <span className="text-3xl leading-none">{sub.icon}</span>
                              <span className="text-xs leading-tight uppercase tracking-wide">{sub.nameKey ? t(sub.nameKey) : sub.name}</span>
                            </button>
                          );
                        }
                        const p = item.data;
                        const local = getPhraseText(p.id, language, p.text);
                        return (
                          <PhraseTile key={p.id} phrase={local} englishPhrase={p.text} customImageUrl={p.customImageUrl} compact={categoryKeyboardOpen}
                            onClick={() => handlePhrase(local, p.id)}
                            className={`aac-btn rounded-xl font-bold select-none text-center ${categoryKeyboardOpen ? TILE_H_KB[gridSize] : TILE_H[gridSize]} ${catBg ?? wordBg(p.text)}`}
                          />
                        );
                      })}
                    </div>
                    {showPager && (
                      <div className="flex items-center justify-center gap-3 py-1 border-t border-theme shrink-0">
                        <button disabled={safePage === 0} onClick={() => setGridPage(p => Math.max(0, p - 1))}
                          aria-label="Previous page"
                          className="aac-btn px-3 py-1 rounded-lg surface-key border border-theme text-primary font-bold disabled:opacity-30">◀</button>
                        <span className="text-xs text-muted">{safePage + 1} / {totalPages}</span>
                        <button disabled={safePage >= totalPages - 1} onClick={() => setGridPage(p => p + 1)}
                          aria-label="Next page"
                          className="aac-btn px-3 py-1 rounded-lg surface-key border border-theme text-primary font-bold disabled:opacity-30">▶</button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
              )}
            </div>
            {categoryKeyboardOpen && (
              <div className={keyboardMaximized ? "flex-1 min-h-0 flex flex-col" : `shrink-0 ${compactMode ? 'h-[clamp(80px,24svh,120px)]' : 'h-[clamp(170px,25svh,260px)]'} flex flex-col`} data-testid="keyboard-shell" data-maximized={keyboardMaximized || undefined}>
                <Keyboard />
              </div>
            )}
          </div>
          {!(categoryKeyboardOpen && keyboardMaximized) && sidebarJsx(true)}
        </div>
      </section>
    );
  }

  // ── HOME VIEW ─────────────────────────────────────────────────────────────────
  const topLevelCats = allCategories().filter((c) => !c.parentId);
  const homeCatSet = new Set(HOME_CATS_ORDERED);
  const fringeCats = topLevelCats.filter((c) => !homeCatSet.has(c.id));

  return (
    <section aria-label="Home vocabulary board" className="flex-1 min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden">
      {!(categoryKeyboardOpen && keyboardMaximized) && <PageLabel label={t('home').toUpperCase()} />}
      <div className="flex flex-row flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className={`flex-1 flex flex-col min-h-0 ${categoryKeyboardOpen && keyboardMaximized ? 'hidden' : ''}`}>
            {searchOpen ? searchPanelJsx : (
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Dense core vocab + fringe folder tiles */}
            <div ref={gridRef} className={`grid ${GRID_COLS[gridSize]} gap-1.5 p-2 overflow-y-auto flex-1 min-h-0`} style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              {homeGridPhrases.map(({ phrase: p, catId }) => {
                const local = getPhraseText(p.id, language, p.text);
                const tH = compactMode && categoryKeyboardOpen ? HOME_TILE_H_COMPACT : categoryKeyboardOpen ? TILE_H_KB[gridSize] : TILE_H[gridSize];
                return (
                  <PhraseTile key={p.id} phrase={local} englishPhrase={p.text} customImageUrl={p.customImageUrl} compact={categoryKeyboardOpen || compactMode}
                    onClick={() => handlePhrase(local, p.id)}
                    className={`aac-btn rounded-xl font-bold select-none text-center ${tH} ${CAT_BG[catId] ?? 'bg-slate-500 text-white border-slate-600'}`}
                  />
                );
              })}
              {/* WHITE folder tiles for fringe categories */}
              {fringeCats.map((cat) => {
                const tH = compactMode && categoryKeyboardOpen ? HOME_TILE_H_COMPACT : categoryKeyboardOpen ? TILE_H_KB[gridSize] : TILE_H[gridSize];
                return (
                <button key={cat.id} onClick={() => { tapFeedback(); selectCategory(cat.id); }}
                  aria-label={cat.nameKey ? t(cat.nameKey) : cat.name}
                  className={`${FOLDER_CLS} gap-1 p-1.5 text-xs ${tH}`}>
                  <span className="text-2xl sm:text-3xl leading-none">{cat.icon}</span>
                  <span className="leading-tight uppercase tracking-wide text-[10px] sm:text-xs">
                    {cat.nameKey ? t(cat.nameKey) : cat.name}
                  </span>
                </button>
                );
              })}
            </div>
            {/* Bottom category tab strip — hidden in landscape when keyboard is open (saves ~50px) */}
            {!(compactMode && categoryKeyboardOpen) && <div className="flex gap-1 px-2 py-1.5 overflow-x-auto shrink-0 border-t-2 border-[#5c3d25] bg-[#3e2a1a]" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}>
              {topLevelCats.map((cat) => {
                const isCore = homeCatSet.has(cat.id);
                const tabBg = isCore ? (CAT_BG[cat.id] ?? 'bg-white/20 text-white') : 'bg-white text-gray-900';
                return (
                  <button key={cat.id} onClick={() => { tapFeedback(); selectCategory(cat.id); }}
                    className={`aac-btn shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg
                      border border-white/20 select-none text-center min-w-[52px] ${tabBg}`}>
                    <span className="text-base leading-none">{cat.icon}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide leading-tight whitespace-nowrap">
                      {cat.nameKey ? t(cat.nameKey) : cat.name}
                    </span>
                  </button>
                );
              })}
              </div>}
            </div>
            )}
          </div>
          {categoryKeyboardOpen && (
            <div className={keyboardMaximized ? "flex-1 min-h-0 flex flex-col" : `shrink-0 ${compactMode ? 'h-[clamp(80px,24svh,120px)]' : 'h-[clamp(170px,25svh,260px)]'} flex flex-col`} data-testid="keyboard-shell" data-maximized={keyboardMaximized || undefined}>
              <Keyboard />
            </div>
          )}
        </div>
        {!(categoryKeyboardOpen && keyboardMaximized) && sidebarJsx()}
      </div>
    </section>
  );
}
