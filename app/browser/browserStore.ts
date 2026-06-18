import { create } from 'zustand';

export type BrowserMode = 'speak' | 'url';

interface BrowserState {
  url: string;
  displayUrl: string;
  isHome: boolean;
  isLoading: boolean;
  canBack: boolean;
  canFwd: boolean;
  mode: BrowserMode;
  showBookmarks: boolean;
  history: string[];
  historyIdx: number;

  navigate: (rawUrl: string) => void;
  goBack: () => void;
  goFwd: () => void;
  goHome: () => void;
  toggleBookmarks: () => void;
  toggleMode: () => void;
  setLoaded: () => void;
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
  canBack: false,
  canFwd: false,
  mode: 'speak',
  showBookmarks: false,
  history: [],
  historyIdx: -1,

  navigate: (rawUrl) => {
    const resolved = resolveUrl(rawUrl);
    if (!resolved) return;

    const bridge = (typeof window !== 'undefined') ? (window as any).prismNativeBridge : null;
    if (bridge?.navigateTo) bridge.navigateTo(resolved);

    set((s) => {
      const newHistory = [...s.history.slice(0, s.historyIdx + 1), resolved];
      const newIdx = newHistory.length - 1;
      return {
        url: resolved, displayUrl: shortDisplay(resolved),
        isHome: false, isLoading: true, showBookmarks: false,
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
    const bridge = (typeof window !== 'undefined') ? (window as any).prismNativeBridge : null;
    if (bridge?.goBack) bridge.goBack();
    set({ url: prev, displayUrl: shortDisplay(prev), historyIdx: newIdx, canBack: newIdx > 0, canFwd: true });
  },

  goFwd: () => {
    const { history, historyIdx } = get();
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const next = history[newIdx];
    const bridge = (typeof window !== 'undefined') ? (window as any).prismNativeBridge : null;
    if (bridge?.goForward) bridge.goForward();
    set({ url: next, displayUrl: shortDisplay(next), historyIdx: newIdx, canBack: true, canFwd: newIdx < history.length - 1 });
  },

  goHome: () => set({ isHome: true, url: '', displayUrl: '', showBookmarks: false }),
  toggleBookmarks: () => set((s) => ({ showBookmarks: !s.showBookmarks })),
  toggleMode: () => set((s) => ({ mode: s.mode === 'speak' ? 'url' : 'speak' })),
  setLoaded: () => set({ isLoading: false }),
}));
