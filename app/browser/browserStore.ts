import { create } from 'zustand';

interface BrowserState {
  url: string;
  displayUrl: string;
  isHome: boolean;
  isLoading: boolean;
  error: string | null;
  canBack: boolean;
  canFwd: boolean;
  showBookmarks: boolean;
  history: string[];
  historyIdx: number;

  navigate: (rawUrl: string) => void;
  goBack: () => void;
  goFwd: () => void;
  goHome: () => void;
  refresh: () => void;
  toggleBookmarks: () => void;
  setLoaded: () => void;
  setError: (msg: string) => void;
}

function resolveUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.includes('.') && !trimmed.includes(' ')) return 'https://' + trimmed;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}&igu=1`;
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
  history: [],
  historyIdx: -1,

  navigate: (rawUrl) => {
    const resolved = resolveUrl(rawUrl);
    if (!resolved) return;

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
  setLoaded: () => set({ isLoading: false }),
  setError: (msg) => set({ isLoading: false, error: msg }),
}));

export { resolveUrl, shortDisplay };
