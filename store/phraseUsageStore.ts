/**
 * phraseUsageStore — per-phrase usage history backing the v14.0.0
 * spreading-activation phrase ranking.
 *
 * Stores: { phraseId → { timestamps: number[] } }
 * Bounded: last 50 citations per phrase (decay makes older ones irrelevant).
 *
 * Persisted to localStorage via zustand/persist, same convention as the
 * other AAC stores. No PHI; the timestamps are local-only and never leave
 * the device unless the user opts into cloud sync (separate path).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PhraseUsage, recordPhraseUse } from '@/services/aacPhraseRanking';
import { safeJSONStorage } from '@/lib/safeStorage';

interface PhraseUsageState {
  usage: Record<string, PhraseUsage>;
  recordUse: (phraseId: string) => void;
  clearAll: () => void;
}

const MAX_PHRASE_IDS = 5_000;

export const usePhraseUsageStore = create<PhraseUsageState>()(
  persist(
    (set, get) => ({
      usage: {},
      recordUse: (phraseId: string) => {
        if (!phraseId || typeof phraseId !== 'string') return;
        const prev = get().usage;
        // Prevent unbounded growth: if we're at the cap, drop the entry
        // with the oldest most-recent timestamp.
        if (Object.keys(prev).length >= MAX_PHRASE_IDS && !prev[phraseId]) {
          let oldestId: string | null = null;
          let oldestTs = Infinity;
          for (const [id, u] of Object.entries(prev)) {
            const last = u.timestamps[u.timestamps.length - 1] ?? 0;
            if (last < oldestTs) {
              oldestTs = last;
              oldestId = id;
            }
          }
          if (oldestId) {
            const trimmed = { ...prev };
            delete trimmed[oldestId];
            set({ usage: recordPhraseUse(trimmed, phraseId) });
            return;
          }
        }
        set({ usage: recordPhraseUse(prev, phraseId) });
      },
      clearAll: () => set({ usage: {} }),
    }),
    {
      name: 'aac-phrase-usage',
      storage: createJSONStorage(() => safeJSONStorage({ name: 'aac-phrase-usage' })),
      version: 1,
    },
  ),
);
