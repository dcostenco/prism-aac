import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS, ToneStyle } from '../types';

interface SettingsState extends AppSettings {
  update: (partial: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,

  update: (partial) => set((state) => ({ ...state, ...partial })),

  reset: () => set(DEFAULT_SETTINGS),
}));
