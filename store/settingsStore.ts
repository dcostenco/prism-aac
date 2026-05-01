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
  outputLanguage: SupportedLanguage;
  highContrast: boolean;
  theme: Theme;
  gridSize: GridSize;
  activeVocabSet: string;
  headTrackingEnabled: boolean;
  headTrackingDwellMs: number;
  headTrackingSensitivity: number;
  precisionTouchEnabled: boolean;
  cameraInputEnabled: boolean;
  cameraTrackingTarget: string;
  update: (
    partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language' | 'outputLanguage' | 'highContrast' | 'theme' | 'gridSize' | 'activeVocabSet' | 'headTrackingEnabled' | 'headTrackingDwellMs' | 'headTrackingSensitivity' | 'precisionTouchEnabled' | 'cameraInputEnabled' | 'cameraTrackingTarget'>>,
  ) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      speechRate: 0.5,
      speechVolume: 1.0,
      language: 'en',
      outputLanguage: 'en', // syncs with language on first use; only diverges when user explicitly sets translation pair
      highContrast: false,
      theme: 'light',
      gridSize: 6,
      activeVocabSet: 'all',
      headTrackingEnabled: false,
      headTrackingDwellMs: 1200,
      headTrackingSensitivity: 5,
      precisionTouchEnabled: true,
      cameraInputEnabled: true,
      cameraTrackingTarget: 'right_index',
      update: (partial) => set((s) => ({ ...s, ...partial })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'prism-aac-settings',
      version: 7,
      migrate: (persisted: unknown, version: number) => {
        let s = persisted as Record<string, unknown>;
        if (version < 2) s = { ...s, gridSize: s.gridSize ?? 6 };
        if (version < 3) s = { ...s, activeVocabSet: s.activeVocabSet ?? 'all', outputLanguage: s.outputLanguage ?? s.language ?? 'en' };
        if (version < 4) s = { ...s, outputLanguage: s.outputLanguage ?? s.language ?? 'en' };
        if (version < 5) s = { ...s, headTrackingEnabled: s.headTrackingEnabled ?? false, headTrackingDwellMs: s.headTrackingDwellMs ?? 1200, headTrackingSensitivity: s.headTrackingSensitivity ?? 5 };
        if (version < 6) s = { ...s, precisionTouchEnabled: s.precisionTouchEnabled ?? true };
        if (version < 7) s = { ...s, cameraInputEnabled: s.cameraInputEnabled ?? true, cameraTrackingTarget: s.cameraTrackingTarget ?? 'right_index' };
        return s;
      },
    },
  ),
);
