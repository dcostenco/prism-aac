import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SupportedLanguage } from '@/engine/i18n';

export type Theme = 'light' | 'dark';

// Picture mode: how phrase tiles render their icon.
//  - 'off'      — text only (default, fastest, no network)
//  - 'symbols'  — try ARASAAC pictogram for the head noun/verb, fall back to text
//  - 'symbols-ai' — symbols first, then AI-generated pictogram for any phrase
//                  with no symbol match (paid tiers only — gen routes through
//                  the Synalux portal). TouchChat-HD-style picture mode.
export type PictureMode = 'off' | 'symbols' | 'symbols-ai';

interface SettingsState {
  speechRate: number;
  speechVolume: number;
  language: SupportedLanguage;
  highContrast: boolean;
  theme: Theme;
  pictureMode: PictureMode;
  update: (
    partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language' | 'highContrast' | 'theme' | 'pictureMode'>>,
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
      pictureMode: 'off',
      update: (partial) => set((s) => ({ ...s, ...partial })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'prism-aac-settings', version: 1 },
  ),
);
