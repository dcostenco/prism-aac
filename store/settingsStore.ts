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
  showHandCalibration: boolean;
  cameraInputEnabled: boolean;
  cameraTrackingTarget: string;
  update: (
    partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language' | 'outputLanguage' | 'highContrast' | 'theme' | 'gridSize' | 'activeVocabSet' | 'headTrackingEnabled' | 'headTrackingDwellMs' | 'headTrackingSensitivity' | 'showHandCalibration' | 'cameraInputEnabled' | 'cameraTrackingTarget'>>,
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
      showHandCalibration: true,
      // Disabled by default — camera tracking accuracy is regressed and the
      // overlay was interfering with mouse use. Users can opt in via
      // Settings → Input modes once the regression is resolved. Existing
      // users who opted in keep their setting via persist; v9 migration
      // forces it OFF for everyone to recover from the broken-cursor state.
      cameraInputEnabled: false,
      // 'any_wrist' picks whichever wrist (left or right) has higher
      // visibility each frame. Lets left-handed users, hand-switchers,
      // and motor-asymmetric users use the same default config.
      cameraTrackingTarget: 'any_wrist',
      update: (partial) => set((s) => ({ ...s, ...partial })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'prism-aac-settings',
      version: 10,
      migrate: (persisted: unknown, version: number) => {
        let s = persisted as Record<string, unknown>;
        if (version < 2) s = { ...s, gridSize: s.gridSize ?? 6 };
        if (version < 3) s = { ...s, activeVocabSet: s.activeVocabSet ?? 'all', outputLanguage: s.outputLanguage ?? s.language ?? 'en' };
        if (version < 4) s = { ...s, outputLanguage: s.outputLanguage ?? s.language ?? 'en' };
        if (version < 5) s = { ...s, headTrackingEnabled: s.headTrackingEnabled ?? false, headTrackingDwellMs: s.headTrackingDwellMs ?? 1200, headTrackingSensitivity: s.headTrackingSensitivity ?? 5 };
        if (version < 6) s = { ...s, showHandCalibration: s.showHandCalibration ?? true };
        if (version < 7) s = { ...s, cameraInputEnabled: s.cameraInputEnabled ?? true, cameraTrackingTarget: s.cameraTrackingTarget ?? 'right_wrist' };
        if (version < 8) s = { ...s, cameraTrackingTarget: s.cameraTrackingTarget === 'right_index' ? 'right_wrist' : (s.cameraTrackingTarget ?? 'right_wrist') };
        // v9: force-disable camera input on upgrade — the overlay was
        // interfering with mouse use in v0.2.x. Users re-enable in Settings
        // when ready. This is a one-shot disable (not "ignore user choice
        // forever") because we override only on the migration boundary.
        if (version < 9) s = { ...s, cameraInputEnabled: false };
        // v10: upgrade hardcoded right_wrist / left_wrist to 'any_wrist' so
        // returning users get the auto-pick behavior. Anyone who chose a
        // specific side intentionally (e.g. left_index) keeps it.
        if (version < 10) {
          if (s.cameraTrackingTarget === 'right_wrist' || s.cameraTrackingTarget === 'left_wrist') {
            s = { ...s, cameraTrackingTarget: 'any_wrist' };
          }
        }
        return s;
      },
    },
  ),
);
