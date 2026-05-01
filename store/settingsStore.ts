import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SupportedLanguage } from '@/engine/i18n';

export type Theme = 'light' | 'dark';
export type GridSize = 4 | 6 | 9 | 12 | 16 | 20;

export type PictureMode = 'off' | 'symbols' | 'symbols-ai';

interface SettingsState {
  speechRate: number;
  speechVolume: number;
  language: SupportedLanguage;
  highContrast: boolean;
  theme: Theme;
  gridSize: GridSize;
  update: (
    partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language' | 'highContrast' | 'theme' | 'gridSize'>>,
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
      gridSize: 6,
      update: (partial) => set((s) => ({ ...s, ...partial })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'prism-aac-settings',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as Record<string, unknown>;
        if (version < 2) return { ...s, gridSize: 6 };
        return s;
      },
    },
  ),
);
