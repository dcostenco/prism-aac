import { create } from 'zustand';
import { fetchSynaluxProfile, SynaluxProfile } from '@/services/aiService';

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

  clear: () => set({ profile: null, loaded: true, loading: false }),
}));
