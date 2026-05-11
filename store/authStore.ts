import { create } from 'zustand';
import { fetchSynaluxProfile, SynaluxProfile } from '@/services/aiService';
import { clearTranslationCache } from '@/services/translateService';
import { clearTextCorrectCache } from '@/services/textCorrectService';

interface AuthState {
  profile: SynaluxProfile | null;
  loaded: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  profile: null,
  loaded: false,
  loading: false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const profile = await fetchSynaluxProfile();
      set({ profile, loaded: true, loading: false });
    } catch {
      set({ profile: null, loaded: true, loading: false });
    }
  },

  clear: () => {
    clearTranslationCache();
    clearTextCorrectCache();
    set({ profile: null, loaded: true, loading: false });
  },
}));

// Re-validate auth every 30 minutes to catch expired tokens
let _authRefreshTimer: ReturnType<typeof setInterval> | null = null;
if (typeof window !== 'undefined' && !_authRefreshTimer) {
  _authRefreshTimer = setInterval(() => {
    if (useAuthStore.getState().profile) useAuthStore.getState().refresh();
  }, 30 * 60 * 1000);
}

/** Stop the periodic auth refresh. Call in test teardown or PWA shell cleanup. */
export function cleanupAuthStore(): void {
  if (_authRefreshTimer) { clearInterval(_authRefreshTimer); _authRefreshTimer = null; }
}
