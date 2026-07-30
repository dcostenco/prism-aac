import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SupportedLanguage } from '@/engine/i18n';
import { type GestureConfig, type GestureMapping, DEFAULT_GESTURE_CONFIG } from '@/services/gestureService';
import { safeJSONStorage } from '@/lib/safeStorage';

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
  | 'math' | 'ai_chat' | 'aac_chat' | 'notes' | 'games' | 'history'
  | 'pdf_reader' | 'ocr_capture' | 'comfort_player';

export interface ToolbarConfig {
  // Render order — first id is leftmost. Disabled ids stay in the array so
  // their relative position is preserved if user re-enables them.
  order: ToolbarButtonId[];
  // Per-id enable flag. Missing keys default to true (forward-compat: new
  // built-in buttons added in a later release become visible automatically
  // for upgrading users who already had a saved toolbarConfig).
  enabled: Partial<Record<ToolbarButtonId, boolean>>;
}

// Default toolbar — Phase 6: trimmed to a minimal set per user request
// ("leave notifications + microphone etc"). Every other built-in button
// stays in the type union AND in Settings → Toolbar so the user can
// re-enable them, but the default is now five icons only:
//   • mic         — voice input (microphone)
//   • aac_chat    — incoming messages (the "notifications" surface)
//   • alert       — life-safety emergency button (non-negotiable)
//   • categories  — AAC core navigation (without this the app can't
//                   compose sentences, so it stays even under "minimal")
//   • settings    — escape hatch back to a fuller toolbar
// `order` retains the FULL button list so Settings can still toggle them
// individually; `enabled` is what governs default visibility (see the
// initial enabled map on the store init below).
export const DEFAULT_TOOLBAR_ORDER: ToolbarButtonId[] = [
  'categories', 'mic', 'aac_chat', 'alert',
  'schedule', 'marketplace', 'math', 'ai_chat', 'notes', 'games',
  'pdf_reader', 'ocr_capture', 'comfort_player',
  'history', 'sound', 'settings',
];

/** Built-in buttons that ship enabled by default. Anything not in this
 *  set is hidden until the user re-enables it via Settings → Toolbar. */
export const DEFAULT_TOOLBAR_ENABLED: Partial<Record<ToolbarButtonId, boolean>> = {
  mic: true,
  aac_chat: true,
  alert: true,
  categories: true,
  settings: true,
  // Everything else: explicitly disabled out of the box.
  schedule: false,
  marketplace: false,
  math: false,
  ai_chat: false,
  notes: false,
  games: false,
  pdf_reader: false,
  ocr_capture: false,
  comfort_player: false,
  history: false,
  sound: false,
};

const VALID_TOOLBAR_IDS = new Set<ToolbarButtonId>(DEFAULT_TOOLBAR_ORDER);
const VALID_THEMES = new Set<Theme>(['light', 'dark']);
/** Plausible numeric bounds — defends against tampered localStorage
 *  injecting NaN / negative / absurd values that would break the UI. */
const NUM_BOUNDS = {
  speechRate: { min: 0.25, max: 4, def: 0.5 },
  speechVolume: { min: 0, max: 1, def: 1 },
  gridSize: { values: [4, 6, 9, 12, 16, 20] as GridSize[], def: 6 as GridSize },
  headTrackingDwellMs: { min: 200, max: 5000, def: 1200 },
  headTrackingSensitivity: { min: 1, max: 10, def: 5 },
  headTrackingDriftThresholdPx: { min: 100, max: 4000, def: 800 },
  headTrackingDriftWindowMs: { min: 1000, max: 30_000, def: 5000 },
} as const;
/** Hard cap on installedApps array length — defends against tampered
 *  storage injecting thousands of bogus app ids that would explode the
 *  toolbar render. */
const MAX_INSTALLED_APPS = 100;
const MAX_VOICE_PREF_ENTRIES = 50;

function clampNumber(v: unknown, b: { min: number; max: number; def: number }): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return b.def;
  return v < b.min ? b.min : v > b.max ? b.max : v;
}

interface SettingsState {
  speechRate: number;
  /** True once the rate has been changed through `update`, i.e. by a real
   *  choice rather than a default or a migration. Corrective migrations that
   *  rewrite speechRate must skip anyone carrying this flag — the v19 fix had
   *  no way to tell a deliberate 1.0 from one an earlier migration wrote, and
   *  silently slowed down every user who had genuinely chosen it. */
  speechRateUserSet: boolean;
  speechVolume: number;
  language: SupportedLanguage;
  outputLanguage: SupportedLanguage;
  highContrast: boolean;
  theme: Theme;
  gridSize: GridSize;
  activeVocabSet: string;
  /**
   * Show vocabulary that no native speaker has reviewed.
   *
   * Only affects languages in UNREVIEWED_LANGUAGES (am/sw/bn), where the
   * machine translations have measurably produced nonsense. Default false:
   * a smaller trustworthy vocabulary beats a larger unreliable one. But
   * hiding words from an AAC user is itself a harm, so a caregiver who
   * accepts the risk can turn it back on.
   */
  showUnreviewedVocabulary: boolean;
  headTrackingEnabled: boolean;
  headTrackingDwellMs: number;
  headTrackingSensitivity: number;
  /** Incremented each time the wizard saves a pose calibration. CameraInputOverlay
   *  watches this and restarts its tracker so the new cal takes effect immediately
   *  without needing to toggle cameraInputEnabled off/on. */
  poseCalibrationGeneration: number;
  /** Use iris/gaze tracking instead of face-box head tracking. Eyes reach
   *  screen corners without head rotation — critical for limited-mobility
   *  AAC users. Default off so existing calibrations aren't disrupted. */
  headTrackingEyeGaze: boolean;
  /** 0–1 blend weight between face-box (0) and pure iris (1). Default 0.8. */
  headTrackingEyeGazeWeight: number;
  /**
   * Critical safety: auto-disable tracking when drift is detected. When
   * the user's cursor travels excessively within a short window WITHOUT
   * landing a dwell-click, the calibration is almost certainly broken
   * (head moved out of frame, lighting changed, person swapped seats).
   * Auto-disable lets the user recover the mouse without fighting a
   * runaway tracker that would otherwise lock them out of the UI.
   *
   * Defaults: enabled, 800px travel within 5s window. Tunable in
   * Settings → Input modes → Head tracking → Safety.
   */
  headTrackingDriftAutoDisable: boolean;
  headTrackingDriftThresholdPx: number;
  headTrackingDriftWindowMs: number;
  showHandCalibration: boolean;
  cameraInputEnabled: boolean;
  cameraTrackingTarget: string;
  gestureConfig: GestureConfig;
  toolbarConfig: ToolbarConfig;
  // AI Autocorrect in MessageBar
  aiAutocorrectEnabled: boolean;
  // Optional signed-in portal memory predictions. Default OFF because this
  // sends the committed AAC phrase to Synalux; deterministic/local prediction
  // remains available without it.
  cloudPredictionEnabled: boolean;
  // "Read & Write"-style speak-on-sentence-end. When ON, finishing a
  // sentence with .?! triggers TTS of the just-completed sentence.
  // The existing per-word echo on space stays unchanged. Targets users
  // with reading/memory disabilities who lose track of what they typed
  // by the time they reach a period — they specifically asked for this
  // when shopping for free Read&Write replacements (Reddit r/AAC, May
  // 2026). Default ON because the existing autoSpeak is already ON and
  // these users are the dominant AAC text-input persona.
  speakOnSentenceEnd: boolean;
  // Audible chime on each new incoming message batch from connected
  // providers (Telegram / WhatsApp / Mail / etc.). Default true so a
  // newly-onboarded caregiver hears the alarm without diving into
  // Settings; mutable in Settings → Sound.
  notificationsEnabled: boolean;
  // Math module hold-time dwell (ms). Every math key tap requires the
  // user to hold their finger for this many ms before the glyph
  // commits. 0 = instant (default). 200-1500 ms ranges work well for
  // motor-imprecision profiles. Visual progress ring fills during
  // dwell so the user (and caregiver) sees the count-down.
  mathHoldTimeMs: number;
  // Two-hit magnify on math keys: first tap previews (key + 8
  // neighbors enlarged); second tap on the (now-larger) key commits.
  // For users with significant motor imprecision who need an extra
  // confirmation step. Default false (most users prefer single-tap).
  mathTwoHitMagnify: boolean;
  /** Sub-national region for the math History keyboard. Format is
   *  ISO 3166-2 (`US-TX`, `CA-QC`, `UK-SCT`, `DE-BY`, `IN-TN`...).
   *  The History keyboard layers WORLD ∪ NATIONAL ∪ REGIONAL events;
   *  this field drives the regional slice. Optional — when unset
   *  only the universal + national-by-language layers render. */
  historyRegion: string | null;
  // Marketplace-installed app ids (e.g. ['game-packs', 'voice-packs']).
  // Toolbar.tsx renders these as buttons after the built-ins.
  installedApps: string[];
  // Per-language voice choice. Keyed by base lang code (e.g. 'en', 'es').
  // The portal resolves the active voiceId from this map for each utterance;
  // unset languages use the platform default for that language. Backend
  // (Inworld vs Azure) is chosen server-side based on language support and
  // is not user-selectable.
  voicePreferences: Record<string, string>;
  /** Caregiver PIN hash (SHA-256 hex, 64 chars). Set via PinPad → hashPin(). */
  caregiverPinHash?: string;
  /** Announce sender name aloud via TTS when message arrives. Default false for privacy. */
  announceSenderName: boolean;
  /** Enable camera-based object detection for context-aware phrase suggestions.
   *  Default OFF — caregiver must explicitly opt in. Uses ~5 MB extra RAM. */
  visionContextEnabled: boolean;
  update: (
    partial: Partial<Pick<SettingsState, 'speechRate' | 'speechVolume' | 'language' | 'outputLanguage' | 'highContrast' | 'theme' | 'gridSize' | 'activeVocabSet' | 'showUnreviewedVocabulary' | 'headTrackingEnabled' | 'headTrackingDwellMs' | 'headTrackingSensitivity' | 'headTrackingEyeGaze' | 'headTrackingEyeGazeWeight' | 'headTrackingDriftAutoDisable' | 'headTrackingDriftThresholdPx' | 'headTrackingDriftWindowMs' | 'showHandCalibration' | 'cameraInputEnabled' | 'cameraTrackingTarget' | 'poseCalibrationGeneration' | 'gestureConfig' | 'toolbarConfig' | 'installedApps' | 'aiAutocorrectEnabled' | 'cloudPredictionEnabled' | 'notificationsEnabled' | 'mathHoldTimeMs' | 'mathTwoHitMagnify' | 'historyRegion' | 'voicePreferences' | 'speakOnSentenceEnd' | 'caregiverPinHash' | 'announceSenderName' | 'visionContextEnabled'>>,
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
      speechRateUserSet: false,
      speechVolume: 1.0,
      language: 'en',
      outputLanguage: 'en', // syncs with language on first use; only diverges when user explicitly sets translation pair
      highContrast: false,
      theme: 'dark',
      gridSize: 6,
      activeVocabSet: 'all',
      showUnreviewedVocabulary: false,
      headTrackingEnabled: false,
      headTrackingDwellMs: 1200,
      headTrackingSensitivity: 5,
      headTrackingEyeGaze: true,
      headTrackingEyeGazeWeight: 0.3,
      poseCalibrationGeneration: 0,
      // Drift-detection safety net (see interface comment). Critical for
      // AAC users — if calibration breaks the cursor will runaway and
      // they may be unable to find the disable button. Default ON.
      headTrackingDriftAutoDisable: true,
      headTrackingDriftThresholdPx: 800,
      headTrackingDriftWindowMs: 5000,
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
      cloudPredictionEnabled: false,
      speakOnSentenceEnd: true,
      notificationsEnabled: true,
      mathHoldTimeMs: 0,
      mathTwoHitMagnify: false,
      historyRegion: null,
      toolbarConfig: {
        order: [...DEFAULT_TOOLBAR_ORDER],
        // Phase 6: ship a minimal default — only the 5 essentials are
        // enabled out of the box (mic, aac_chat, alert, categories,
        // settings). Users who want the bigger toolbar can re-enable
        // additional buttons in Settings → Toolbar.
        enabled: { ...DEFAULT_TOOLBAR_ENABLED },
      },
      installedApps: [],
      voicePreferences: {},
      caregiverPinHash: undefined,
      announceSenderName: false,
      visionContextEnabled: false,
      update: (partial) => set((s) => {
        // Persist language changes to a cookie so the SSR layout.tsx can
        // read the correct lang attribute on the first server render, before
        // client-side hydration. SameSite=Lax prevents cross-site leakage.
        if (partial.language !== undefined && typeof document !== 'undefined') {
          document.cookie = `prism-aac-settings-lang=${encodeURIComponent(partial.language)}; path=/; max-age=31536000; SameSite=Lax; Secure`;
        }
        return {
          ...s,
          ...partial,
          // Clamp numeric fields so callers cannot persist out-of-range values
          ...(partial.speechRate !== undefined
            ? {
              speechRate: clampNumber(partial.speechRate, NUM_BOUNDS.speechRate),
              speechRateUserSet: true,
            } : {}),
          ...(partial.speechVolume !== undefined
            ? { speechVolume: clampNumber(partial.speechVolume, NUM_BOUNDS.speechVolume) } : {}),
        };
      }),
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
        toolbarConfig: { order: [...DEFAULT_TOOLBAR_ORDER], enabled: { ...DEFAULT_TOOLBAR_ENABLED } },
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
      version: 20,
      migrate: (persisted: unknown, version: number) => {
        let s = persisted as Record<string, unknown>;
        if (version < 2) s = { ...s, gridSize: s.gridSize ?? 6 };
        if (version < 3) s = { ...s, activeVocabSet: s.activeVocabSet ?? 'all', outputLanguage: s.outputLanguage ?? s.language ?? 'en' };
        if (version < 4) s = { ...s, outputLanguage: s.outputLanguage ?? s.language ?? 'en' };
        if (version < 5) s = { ...s, headTrackingEnabled: s.headTrackingEnabled ?? false, headTrackingDwellMs: s.headTrackingDwellMs ?? 1200, headTrackingSensitivity: s.headTrackingSensitivity ?? 5 };
        if (version < 6) s = { ...s, showHandCalibration: s.showHandCalibration ?? true };
        // NOTE: ?? true here was a regression — camera was incorrectly defaulted to ON. This was corrected in the v9 migration which forces cameraInputEnabled: false.
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
        // v15: head-tracking drift auto-disable safety net. Default ON
        // for everyone — if calibration breaks they can recover the
        // mouse without having to chase the runaway cursor to a button.
        if (version < 15) {
          s = {
            ...s,
            headTrackingDriftAutoDisable: s.headTrackingDriftAutoDisable ?? true,
            headTrackingDriftThresholdPx: s.headTrackingDriftThresholdPx ?? 800,
            headTrackingDriftWindowMs: s.headTrackingDriftWindowMs ?? 5000,
          };
        }
        // v16: eye/iris gaze tracking on by default for all users including
        // existing ones. Users who prefer pure head tracking can disable
        // in Settings → Head tracking → Eye / Gaze tracking.
        if (version < 16) {
          s = { ...s, headTrackingEyeGaze: true, headTrackingEyeGazeWeight: s.headTrackingEyeGazeWeight ?? 0.3 };
        }
        // v17: dark theme default (fixes white-background report Image #63).
        // Existing users who explicitly set light theme are unaffected since
        // their persisted value is present. New users and users without a
        // saved theme get dark.
        if (version < 17) {
          s = { ...s, theme: s.theme ?? 'dark' };
        }
        // v18: caregiver PIN hash + announce-sender-name privacy toggle.
        if (version < 18) {
          s = { ...s, announceSenderName: s.announceSenderName ?? false };
          // Invalidate any btoa-encoded PINs from before SHA-256 migration.
          // SHA-256 hashes are exactly 64 hex chars; btoa hashes are base64.
          if (typeof s.caregiverPinHash === 'string' && !/^[0-9a-f]{64}$/.test(s.caregiverPinHash)) {
            s = { ...s, caregiverPinHash: undefined }; // force re-setup with new SHA-256 hash
          }
        }
        // v19: undo the legacy 0.5→1.0 rate migration from the period when
        // the stored value was passed directly to Azure SSML. The current
        // client normalizes stored 0.5 to portal rate 1.0, so persisted 1.0
        // now becomes portal rate 1.4 (audibly too fast). This is one-shot:
        // a user who deliberately selects 1.0 after v19 keeps that choice.
        //
        // `speechRateUserSet` did not exist before v20, so pre-v20 profiles
        // cannot be spared here — the flag protects deliberate choices made
        // from v20 onward, which is why this guard exists at all.
        if (version < 19 && s.speechRate === 1 && s.speechRateUserSet !== true) {
          s = { ...s, speechRate: 0.5 };
        }
        return s;
      },
      // Hydration validator — runs AFTER migrate. The migrate fns above
      // only fill in defaults when fields are missing; they don't reject
      // bogus shapes. A tampered localStorage (browser extension, shared-
      // device sibling tab, devtools edit) could otherwise inject:
      //   - language: 'kk' (unsupported lang) — would fall through to
      //     the t() English fallback for every UI string
      //   - installedApps: 'string-not-array' — would break Toolbar
      //   - toolbarConfig.order: [{evil:true}] — would break Toolbar
      //   - gestureConfig: {} — would break gesture engine
      //   - speechRate: NaN — would break TTS
      // Any field the validator can't make sense of is silently reset
      // to its default. Strictly local defense; portal-source data
      // should already be sanitized before write.
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Record<string, unknown>;
        const cur = currentState as unknown as Record<string, unknown>;
        const out: Record<string, unknown> = { ...cur };

        // Strings: keep only if the value is a string + non-empty.
        const strKeys = ['language', 'outputLanguage', 'activeVocabSet', 'cameraTrackingTarget'] as const;
        for (const k of strKeys) {
          const v = incoming[k];
          if (typeof v === 'string' && v.length > 0 && v.length < 64) out[k] = v;
        }
        // theme — must be a known enum value.
        if (typeof incoming.theme === 'string' && VALID_THEMES.has(incoming.theme as Theme)) {
          out.theme = incoming.theme;
        }
        // Booleans: respect the persisted value only if it actually IS one.
        const boolKeys = [
          'highContrast', 'headTrackingEnabled', 'headTrackingDriftAutoDisable',
          'showHandCalibration', 'cameraInputEnabled', 'aiAutocorrectEnabled',
          'cloudPredictionEnabled',
          'speakOnSentenceEnd', 'notificationsEnabled', 'mathTwoHitMagnify',
          'showUnreviewedVocabulary',
          'headTrackingEyeGaze',
        ] as const;
        for (const k of boolKeys) {
          if (typeof incoming[k] === 'boolean') out[k] = incoming[k];
        }
        // mathHoldTimeMs — number clamped to plausible range (0 = instant, max 1500ms)
        if (typeof incoming.mathHoldTimeMs === 'number' && Number.isFinite(incoming.mathHoldTimeMs)) {
          out.mathHoldTimeMs = Math.min(Math.max(0, incoming.mathHoldTimeMs), 1500);
        }
        // headTrackingEyeGazeWeight — 0–1 blend weight
        if (typeof incoming.headTrackingEyeGazeWeight === 'number' && Number.isFinite(incoming.headTrackingEyeGazeWeight)) {
          out.headTrackingEyeGazeWeight = Math.min(Math.max(0, incoming.headTrackingEyeGazeWeight), 1);
        }
        // poseCalibrationGeneration — non-negative integer
        if (typeof incoming.poseCalibrationGeneration === 'number' && Number.isFinite(incoming.poseCalibrationGeneration) && incoming.poseCalibrationGeneration >= 0) {
          out.poseCalibrationGeneration = Math.floor(incoming.poseCalibrationGeneration);
        }
        // historyRegion — null or short ISO 3166-2 string
        if (incoming.historyRegion === null) {
          out.historyRegion = null;
        } else if (typeof incoming.historyRegion === 'string' && /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/i.test(incoming.historyRegion)) {
          out.historyRegion = incoming.historyRegion;
        }
        // Numbers: clamp to plausible bounds.
        out.speechRate = clampNumber(incoming.speechRate, NUM_BOUNDS.speechRate);
        // Preserved verbatim: losing it here would re-expose the rate to the
        // next corrective migration, which is exactly what the flag prevents.
        out.speechRateUserSet = incoming.speechRateUserSet === true;
        out.speechVolume = clampNumber(incoming.speechVolume, NUM_BOUNDS.speechVolume);
        out.headTrackingDwellMs = clampNumber(incoming.headTrackingDwellMs, NUM_BOUNDS.headTrackingDwellMs);
        out.headTrackingSensitivity = clampNumber(incoming.headTrackingSensitivity, NUM_BOUNDS.headTrackingSensitivity);
        out.headTrackingDriftThresholdPx = clampNumber(incoming.headTrackingDriftThresholdPx, NUM_BOUNDS.headTrackingDriftThresholdPx);
        out.headTrackingDriftWindowMs = clampNumber(incoming.headTrackingDriftWindowMs, NUM_BOUNDS.headTrackingDriftWindowMs);
        // gridSize must be one of the known enum values.
        out.gridSize = (NUM_BOUNDS.gridSize.values as GridSize[]).includes(incoming.gridSize as GridSize)
          ? incoming.gridSize
          : NUM_BOUNDS.gridSize.def;

        // installedApps — must be a string array, capped, non-empty entries only.
        if (Array.isArray(incoming.installedApps)) {
          out.installedApps = (incoming.installedApps as unknown[])
            .filter((a): a is string => typeof a === 'string' && a.length > 0 && a.length <= 80)
            .slice(0, MAX_INSTALLED_APPS);
        } else {
          out.installedApps = [];
        }

        // voicePreferences — Record<langCode, voiceId> with bounded entry counts.
        if (incoming.voicePreferences && typeof incoming.voicePreferences === 'object') {
          const cleaned: Record<string, string> = {};
          let count = 0;
          for (const [lang, voice] of Object.entries(incoming.voicePreferences as Record<string, unknown>)) {
            if (count >= MAX_VOICE_PREF_ENTRIES) break;
            if (typeof lang === 'string' && lang.length <= 16
              && typeof voice === 'string' && voice.length > 0 && voice.length <= 128) {
              cleaned[lang] = voice;
              count++;
            }
          }
          out.voicePreferences = cleaned;
        } else {
          out.voicePreferences = {};
        }

        // toolbarConfig — must have an `order` array of valid ToolbarButtonId
        // values + an `enabled` record of booleans. Settings stays forced-on
        // here per the v13 invariant — a tampered enabled.settings:false
        // would lock the user out of getting BACK to settings.
        const tc = incoming.toolbarConfig as { order?: unknown; enabled?: unknown } | undefined;
        if (tc && typeof tc === 'object') {
          const order = Array.isArray(tc.order)
            ? (tc.order as unknown[])
                .filter((id): id is ToolbarButtonId => typeof id === 'string' && VALID_TOOLBAR_IDS.has(id as ToolbarButtonId))
                .slice(0, VALID_TOOLBAR_IDS.size)
            : [...DEFAULT_TOOLBAR_ORDER];
          const enabledRaw = (tc.enabled && typeof tc.enabled === 'object') ? tc.enabled as Record<string, unknown> : {};
          const enabled: Partial<Record<ToolbarButtonId, boolean>> = {};
          for (const [id, val] of Object.entries(enabledRaw)) {
            if (VALID_TOOLBAR_IDS.has(id as ToolbarButtonId) && typeof val === 'boolean') {
              enabled[id as ToolbarButtonId] = val;
            }
          }
          enabled.settings = true; // invariant — see v13 comment
          out.toolbarConfig = { order, enabled };
        } else {
          out.toolbarConfig = { order: [...DEFAULT_TOOLBAR_ORDER], enabled: { settings: true } };
        }

        // gestureConfig — must be an object; structural validation is
        // delegated to the gesture engine (which already accepts partial
        // configs and merges with DEFAULT_GESTURE_CONFIG). Just guard
        // against a non-object value here.
        if (incoming.gestureConfig && typeof incoming.gestureConfig === 'object' && !Array.isArray(incoming.gestureConfig)) {
          out.gestureConfig = incoming.gestureConfig;
        } else {
          out.gestureConfig = { ...DEFAULT_GESTURE_CONFIG };
        }

        // caregiverPinHash — must be 64-char hex (SHA-256)
        if (typeof incoming.caregiverPinHash === 'string'
            && /^[0-9a-f]{64}$/.test(incoming.caregiverPinHash)) {
          out.caregiverPinHash = incoming.caregiverPinHash;
        } else {
          out.caregiverPinHash = undefined;
        }
        // announceSenderName
        if (typeof incoming.announceSenderName === 'boolean') {
          out.announceSenderName = incoming.announceSenderName;
        }

        return out as unknown as SettingsState;
      },
    },
  ),
);
