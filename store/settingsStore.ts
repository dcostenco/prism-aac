import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SupportedLanguage } from '@/engine/i18n';

export type Theme = 'light' | 'dark';

interface SettingsState {
  speechRate: number;
  speechVolume: number;
  language: SupportedLanguage;
  highContrast: boolean;
  theme: Theme;
  update: (
    partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language' | 'highContrast' | 'theme'>>,
  ) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      speechRate: 0.5,
      speechVolume: 1.0,
      language: 'en',
      highContrast: false,
      theme: 'light',
      update: (partial) => set((s) => ({ ...s, ...partial })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'prism-aac-settings' },
  ),
);
