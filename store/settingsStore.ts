import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SupportedLanguage } from '@/engine/i18n';
import { type GestureConfig, type GestureMapping, DEFAULT_GESTURE_CONFIG } from '@/services/gestureService';

export type Theme = 'light' | 'dark';
export type GridSize = 4 | 6 | 9 | 12 | 16 | 20;

export type PictureMode = 'off' | 'symbols' | 'symbols-ai';

// Stable IDs for built-in toolbar buttons. New buttons must add their id
// here AND register a runtime handler in components/Toolbar.tsx → BUTTON_REGISTRY.
// Marketplace-installed apps use the prefix `app:<appId>` and don't need an
// entry here — the toolbar renders them dynamically from `installedApps`.
export type ToolbarButtonId =
  | 'categories' | 'mic' | 'schedule' | 'marketplace' | 'alert'
  | 'sound' | 'settings'
  | 'math' | 'ai_chat' | 'notes' | 'games' | 'history';

export interface ToolbarConfig {
  // Render order — first id is leftmost. Disabled ids stay in the array so
  // their relative position is preserved if user re-enables them.
  order: ToolbarButtonId[];
  // Per-id enable flag. Missing keys default to true (forward-compat: new
  // built-in buttons added in a later release become visible automatically
  // for upgrading users who already had a saved toolbarConfig).
  enabled: Partial<Record<ToolbarButtonId, boolean>>;
}

// Default toolbar contains the previously-toolbar buttons PLUS everything
// that lived in the "..." overflow menu — flat, configurable.
export const DEFAULT_TOOLBAR_ORDER: ToolbarButtonId[] = [
  'categories', 'mic', 'schedule', 'marketplace', 'alert',
  'math', 'ai_chat', 'notes', 'games', 'history',
  'sound', 'settings',
];

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
  gestureConfig: GestureConfig;
  toolbarConfig: ToolbarConfig;
  // AI Autocorrect in MessageBar
  aiAutocorrectEnabled: boolean;
  // Marketplace-installed app ids (e.g. ['game-packs', 'voice-packs']).
  // Toolbar.tsx renders these as buttons after the built-ins.
  installedApps: string[];
  // Per-language voice choice. Keyed by base lang code (e.g. 'en', 'es').
  // The portal resolves the active voiceId from this map for each utterance;
  // unset languages use the platform default for that language. Backend
  // (Inworld vs Azure) is chosen server-side based on language support and
  // is not user-selectable.
  voicePreferences: Record<string, string>;
  update: (
    partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language' | 'outputLanguage' | 'highContrast' | 'theme' | 'gridSize' | 'activeVocabSet' | 'headTrackingEnabled' | 'headTrackingDwellMs' | 'headTrackingSensitivity' | 'showHandCalibration' | 'cameraInputEnabled' | 'cameraTrackingTarget' | 'gestureConfig' | 'toolbarConfig' | 'installedApps' | 'aiAutocorrectEnabled' | 'voicePreferences'>>,
  ) => void;
  /** Set the voice choice for one language. Pass '' or undefined to clear. */
  setVoiceForLang: (lang: string, voiceId: string | undefined) => void;
  setTheme: (theme: Theme) => void;
  // Toolbar mutators — keep them on the store so reorder/enable/install
  // operations have a single audit point.
  toolbarToggle: (id: string) => void;
  toolbarMove: (id: string, direction: -1 | 1) => void;
  toolbarReset: () => void;
  installApp: (appId: string) => void;
  uninstallApp: (appId: string) => void;
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
      gestureConfig: { ...DEFAULT_GESTURE_CONFIG },
      aiAutocorrectEnabled: true,
      toolbarConfig: {
        order: [...DEFAULT_TOOLBAR_ORDER],
        // Empty enabled map = all built-ins ON (Partial+default-true). User
        // toggling a button writes an explicit false here.
        enabled: {},
      },
      installedApps: [],
      voicePreferences: {},
      update: (partial) => set((s) => ({ ...s, ...partial })),
      setTheme: (theme) => set({ theme }),
      setVoiceForLang: (lang, voiceId) => set((s) => {
        const baseLang = lang.toLowerCase().split(/[-_]/)[0];
        const next = { ...s.voicePreferences };
        if (voiceId) next[baseLang] = voiceId;
        else delete next[baseLang];
        return { voicePreferences: next };
      }),
      toolbarToggle: (id) => set((s) => {
        if (id === 'settings') return {};
        const cur = s.toolbarConfig.enabled[id as ToolbarButtonId] ?? true;
        return {
          toolbarConfig: {
            ...s.toolbarConfig,
            enabled: { ...s.toolbarConfig.enabled, [id]: !cur },
          },
        };
      }),
      toolbarMove: (id, direction) => set((s) => {
        // Build the full ordered id list (built-ins from order[] + installed
        // apps appended). Apps live in installedApps[] but are surfaced as
        // toolbar entries with `app:` prefix for the move op.
        const builtIns = s.toolbarConfig.order;
        const apps = s.installedApps.map((a) => `app:${a}` as ToolbarButtonId);
        const combined = [...builtIns, ...apps];
        const idx = combined.indexOf(id as ToolbarButtonId);
        if (idx < 0) return {};
        const target = idx + direction;
        if (target < 0 || target >= combined.length) return {};
        // Swap
        const next = [...combined];
        [next[idx], next[target]] = [next[target], next[idx]];
        // Split back: built-in ids stay in toolbarConfig.order; app ids
        // (prefixed) determine new installedApps order.
        const nextBuiltIns: ToolbarButtonId[] = [];
        const nextApps: string[] = [];
        for (const entry of next) {
          if (entry.startsWith('app:')) nextApps.push(entry.slice(4));
          else nextBuiltIns.push(entry);
        }
        return {
          toolbarConfig: { ...s.toolbarConfig, order: nextBuiltIns },
          installedApps: nextApps,
        };
      }),
      toolbarReset: () => set((s) => ({
        toolbarConfig: { order: [...DEFAULT_TOOLBAR_ORDER], enabled: {} },
        installedApps: s.installedApps,
      })),
      installApp: (appId) => set((s) => {
        if (s.installedApps.includes(appId)) return {};
        return { installedApps: [...s.installedApps, appId] };
      }),
      uninstallApp: (appId) => set((s) => ({
        installedApps: s.installedApps.filter((a) => a !== appId),
      })),
    }),
    {
      name: 'prism-aac-settings',
      version: 14,
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
        // v11: introduce toolbar customization. Existing users get the new
        // default order + everything enabled. installedApps starts empty.
        // We don't try to detect "this user had the ... menu open often" and
        // upgrade differently — the new flat layout just shows everything.
        if (version < 11) {
          s = {
            ...s,
            toolbarConfig: s.toolbarConfig ?? { order: [...DEFAULT_TOOLBAR_ORDER], enabled: {} },
            installedApps: Array.isArray(s.installedApps) ? s.installedApps : [],
          };
        }
        // v12: introduce gesture recognition config
        if (version < 12) {
          s = { ...s, gestureConfig: s.gestureConfig ?? { ...DEFAULT_GESTURE_CONFIG } };
        }
        // v13: force settings button visible — it was possible to hide it
        // before the guard was added, locking users out of settings/sign-out
        if (version < 13) {
          const tc = s.toolbarConfig as ToolbarConfig | undefined;
          if (tc?.enabled && (tc.enabled as Record<string, boolean>)['settings'] === false) {
            s = { ...s, toolbarConfig: { ...tc, enabled: { ...tc.enabled, settings: true } } };
          }
        }
        // v14: per-language voice preferences (Inworld voice picker, paid-only).
        // Default empty — falls back to platform default per language.
        if (version < 14) {
          s = { ...s, voicePreferences: (s.voicePreferences as Record<string, string>) ?? {} };
        }
        return s;
      },
    },
  ),
);
