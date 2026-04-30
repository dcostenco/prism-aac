import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  speechRate: number;
  speechVolume: number;
  update: (partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume'>>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      speechRate: 0.5,
      speechVolume: 1.0,
      update: (partial) => set((s) => ({ ...s, ...partial })),
    }),
    { name: 'prism-aac-settings' },
  ),
);
