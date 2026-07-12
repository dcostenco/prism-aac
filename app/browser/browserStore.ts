import { create } from 'zustand';

// ── Frecency: site visit tracking ──────────────────────────────────

interface SiteEntry {
  url: string;
  title: string;
  icon: string;
  visitCount: number;
  lastVisit: number;
}

const FRECENCY_KEY = 'prism-browser-frecency';
const BOOKMARKS_KEY = 'prism-browser-bookmarks';
const MAX_FRECENCY = 200;

function loadFrecency(): SiteEntry[] {
  try {
    const raw = localStorage.getItem(FRECENCY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFrecency(entries: SiteEntry[]) {
  try { localStorage.setItem(FRECENCY_KEY, JSON.stringify(entries.slice(0, MAX_FRECENCY))); } catch {}
}

function frecencyScore(entry: SiteEntry): number {
  const ageHours = (Date.now() - entry.lastVisit) / 3_600_000;
  const recencyBoost = ageHours < 1 ? 4 : ageHours < 24 ? 2 : ageHours < 168 ? 1.5 : 1;
  return entry.visitCount * recencyBoost;
}

// ── Popular sites for autocomplete ──────────────────────────────────

const POPULAR_SITES: SiteEntry[] = [
  { url: 'https://m.youtube.com', title: 'YouTube', icon: '▶️', visitCount: 0, lastVisit: 0 },
  { url: 'https://www.google.com', title: 'Google', icon: '🔍', visitCount: 0, lastVisit: 0 },
  { url: 'https://m.wikipedia.org', title: 'Wikipedia', icon: '📚', visitCount: 0, lastVisit: 0 },
  { url: 'https://mail.google.com', title: 'Gmail', icon: '📧', visitCount: 0, lastVisit: 0 },
  { url: 'https://www.reddit.com', title: 'Reddit', icon: '💬', visitCount: 0, lastVisit: 0 },
  { url: 'https://www.amazon.com', title: 'Amazon', icon: '📦', visitCount: 0, lastVisit: 0 },
  { url: 'https://m.facebook.com', title: 'Facebook', icon: '👤', visitCount: 0, lastVisit: 0 },
  { url: 'https://twitter.com', title: 'X', icon: '🐦', visitCount: 0, lastVisit: 0 },
  { url: 'https://www.instagram.com', title: 'Instagram', icon: '📷', visitCount: 0, lastVisit: 0 },
  { url: 'https://www.netflix.com', title: 'Netflix', icon: '🎬', visitCount: 0, lastVisit: 0 },
  { url: 'https://maps.google.com', title: 'Maps', icon: '🗺️', visitCount: 0, lastVisit: 0 },
  { url: 'https://news.google.com', title: 'News', icon: '📰', visitCount: 0, lastVisit: 0 },
  { url: 'https://weather.com', title: 'Weather', icon: '🌤️', visitCount: 0, lastVisit: 0 },
  { url: 'https://open.spotify.com', title: 'Spotify', icon: '🎵', visitCount: 0, lastVisit: 0 },
];

// ── Pinned bookmarks ────────────────────────────────────────────────

export interface PinnedBookmark {
  url: string;
  title: string;
  icon: string;
}

const DEFAULT_BOOKMARKS: PinnedBookmark[] = [
  { url: 'https://html.duckduckgo.com/html/', title: 'Search', icon: '🔍' },
  { url: 'https://m.wikipedia.org', title: 'Wikipedia', icon: '📚' },
  { url: 'https://lite.cnn.com', title: 'News', icon: '📰' },
  { url: 'https://text.npr.org', title: 'NPR', icon: '📻' },
  { url: 'https://en.m.wiktionary.org', title: 'Dictionary', icon: '📖' },
  { url: 'https://weather.gov', title: 'Weather', icon: '🌤️' },
];

function loadBookmarks(): PinnedBookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_BOOKMARKS;
  } catch { return DEFAULT_BOOKMARKS; }
}

function saveBookmarks(bookmarks: PinnedBookmark[]) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks)); } catch {}
}

// ── Store ───────────────────────────────────────────────────────────

interface BrowserState {
  url: string;
  displayUrl: string;
  isHome: boolean;
  isLoading: boolean;
  error: string | null;
  canBack: boolean;
  canFwd: boolean;
  showBookmarks: boolean;
  keyboardCollapsed: boolean;
  history: string[];
  historyIdx: number;
  frecency: SiteEntry[];
  pinnedBookmarks: PinnedBookmark[];
  editingBookmarks: boolean;
  speakMode: boolean;

  navigate: (rawUrl: string) => void;
  goBack: () => void;
  goFwd: () => void;
  goHome: () => void;
  refresh: () => void;
  toggleBookmarks: () => void;
  setLoaded: () => void;
  setError: (msg: string) => void;
  collapseKeyboard: () => void;
  expandKeyboard: () => void;
  recordVisit: (url: string) => void;
  getSiteSuggestions: (query: string) => SiteEntry[];
  pinCurrentSite: () => void;
  unpinBookmark: (url: string) => void;
  toggleEditingBookmarks: () => void;
  toggleSpeakMode: () => void;
}

function resolveUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.includes('.') && !trimmed.includes(' ')) return 'https://' + trimmed;
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
}

function shortDisplay(url: string): string {
  return url.replace(/^https?:\/\/(www\.|m\.)?/, '').split('/')[0].split('?')[0];
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  url: '',
  displayUrl: '',
  isHome: true,
  isLoading: false,
  error: null,
  canBack: false,
  canFwd: false,
  showBookmarks: false,
  keyboardCollapsed: false,
  history: [],
  historyIdx: -1,
  frecency: typeof window !== 'undefined' ? loadFrecency() : [],
  pinnedBookmarks: typeof window !== 'undefined' ? loadBookmarks() : DEFAULT_BOOKMARKS,
  editingBookmarks: false,
  speakMode: false,

  navigate: (rawUrl) => {
    const resolved = resolveUrl(rawUrl);
    if (!resolved) return;

    const bridge = typeof window !== 'undefined' && (window as any).prismNativeBridge;
    if (bridge?.navigateTo) {
      bridge.navigateTo(resolved);
      return;
    }

    // Web-only: open non-bookmark URLs in new tab (most sites block iframe embedding)
    if (typeof window !== 'undefined') {
      const domain = shortDisplay(resolved);
      const isBookmarked = get().pinnedBookmarks.some(b => shortDisplay(b.url) === domain);
      if (!isBookmarked) {
        const w = window.open(resolved, '_blank', 'noopener,noreferrer');
        if (w) return;
      }
    }

    set((s) => {
      const newHistory = [...s.history.slice(0, s.historyIdx + 1), resolved];
      const newIdx = newHistory.length - 1;
      return {
        url: resolved, displayUrl: shortDisplay(resolved),
        isHome: false, isLoading: true, error: null, showBookmarks: false,
        history: newHistory, historyIdx: newIdx,
        canBack: newIdx > 0, canFwd: false,
      };
    });
  },

  goBack: () => {
    const { history, historyIdx } = get();
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const prev = history[newIdx];
    set({ url: prev, displayUrl: shortDisplay(prev), historyIdx: newIdx, canBack: newIdx > 0, canFwd: true, isLoading: true, error: null });
  },

  goFwd: () => {
    const { history, historyIdx } = get();
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const next = history[newIdx];
    set({ url: next, displayUrl: shortDisplay(next), historyIdx: newIdx, canBack: true, canFwd: newIdx < history.length - 1, isLoading: true, error: null });
  },

  goHome: () => set({ isHome: true, url: '', displayUrl: '', isLoading: false, error: null, showBookmarks: false }),

  refresh: () => {
    const { url } = get();
    if (!url) return;
    set({ isLoading: true, error: null });
  },

  toggleBookmarks: () => set((s) => ({ showBookmarks: !s.showBookmarks })),
  setLoaded: () => {
    const { url, error } = get();
    set({ isLoading: false, keyboardCollapsed: !!url });
    if (url && !error) {
      setTimeout(() => {
        const s = get();
        if (!s.error && s.url === url) s.recordVisit(url);
      }, 500);
    }
  },
  setError: (msg) => set({ isLoading: false, error: msg }),
  collapseKeyboard: () => set({ keyboardCollapsed: true }),
  expandKeyboard: () => set({ keyboardCollapsed: false }),

  recordVisit: (url) => {
    const domain = shortDisplay(url);
    set((s) => {
      const existing = s.frecency.findIndex((e) => shortDisplay(e.url) === domain);
      let updated: SiteEntry[];
      if (existing >= 0) {
        updated = [...s.frecency];
        updated[existing] = { ...updated[existing], visitCount: updated[existing].visitCount + 1, lastVisit: Date.now() };
      } else {
        const icon = POPULAR_SITES.find((p) => shortDisplay(p.url) === domain)?.icon ?? '🌐';
        updated = [{ url, title: domain, icon, visitCount: 1, lastVisit: Date.now() }, ...s.frecency];
      }
      updated.sort((a, b) => frecencyScore(b) - frecencyScore(a));
      updated = updated.slice(0, MAX_FRECENCY);
      saveFrecency(updated);
      return { frecency: updated };
    });
  },

  getSiteSuggestions: (query) => {
    const q = query.trim().toLowerCase();
    const { frecency, pinnedBookmarks } = get();
    if (!q) {
      const top = frecency.slice(0, 5);
      if (top.length >= 5) return top;
      const domains = new Set(top.map((e) => shortDisplay(e.url)));
      const filler = pinnedBookmarks
        .filter((b) => !domains.has(shortDisplay(b.url)))
        .map((b) => ({ ...b, url: b.url, visitCount: 0, lastVisit: 0 }));
      return [...top, ...filler].slice(0, 5);
    }
    const seen = new Set<string>();
    const results: SiteEntry[] = [];
    const addIfMatch = (entry: SiteEntry) => {
      const domain = shortDisplay(entry.url);
      if (seen.has(domain)) return;
      if (domain.includes(q) || entry.title.toLowerCase().includes(q)) {
        seen.add(domain);
        results.push(entry);
      }
    };
    for (const b of pinnedBookmarks) addIfMatch({ ...b, visitCount: 100, lastVisit: Date.now() });
    for (const e of frecency) addIfMatch(e);
    for (const p of POPULAR_SITES) addIfMatch(p);
    results.sort((a, b) => frecencyScore(b) - frecencyScore(a));
    return results.slice(0, 5);
  },

  pinCurrentSite: () => {
    const { url, pinnedBookmarks } = get();
    if (!url) return;
    const domain = shortDisplay(url);
    if (pinnedBookmarks.some((b) => shortDisplay(b.url) === domain)) return;
    const icon = POPULAR_SITES.find((p) => shortDisplay(p.url) === domain)?.icon ?? '🌐';
    const updated = [...pinnedBookmarks, { url, title: domain, icon }];
    saveBookmarks(updated);
    set({ pinnedBookmarks: updated });
  },

  unpinBookmark: (url) => {
    const { pinnedBookmarks } = get();
    const domain = shortDisplay(url);
    const updated = pinnedBookmarks.filter((b) => shortDisplay(b.url) !== domain);
    saveBookmarks(updated);
    set({ pinnedBookmarks: updated });
  },

  toggleEditingBookmarks: () => set((s) => ({ editingBookmarks: !s.editingBookmarks })),
  toggleSpeakMode: () => set((s) => ({ speakMode: !s.speakMode })),
}));

export { resolveUrl, shortDisplay, POPULAR_SITES };
