import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SupportedLanguage } from '@/engine/i18n';

interface SettingsState {
  speechRate: number;
  speechVolume: number;
  language: SupportedLanguage;
  update: (partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language'>>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      speechRate: 0.5,
      speechVolume: 1.0,
      language: 'en',
      update: (partial) => set((s) => ({ ...s, ...partial })),
    }),
    { name: 'prism-aac-settings' },
  ),
);
