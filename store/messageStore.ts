import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HistoryEntry } from '@/types';
import { ToneStyle } from '@/services/azureTTS';
import { detectEmergency } from '@/services/emergencyService';

const MAX_UNDO = 20;
/** Cap on the in-progress message buffer. AAC users compose a few
 *  sentences at a time; 4000 chars is paranoid headroom for a long
 *  chat-panel message (provider caps run from 1024 for WhatsApp to
 *  10k for mail, all checked again at send time). The cap protects
 *  against a paste accident or AI-correction loop ballooning the
 *  buffer into MB range and stalling the keyboard render. */
const MAX_TEXT_LEN = 4000;
/** Per-history-entry text cap. History is rendered in HistoryModal
 *  and read by emergencyService.getRecentHistory; a single 1MB entry
 *  would bloat the modal + the emergency context payload. */
const MAX_HISTORY_TEXT_LEN = 4000;
const MAX_HISTORY_ENTRIES = 100;
/** Allowed tones — used by hydration validator. Keep in sync with
 *  ToneStyle in services/azureTTS. */
const VALID_TONES: ToneStyle[] = [
  'friendly', 'cheerful', 'calm', 'serious', 'excited',
  'hopeful', 'empathetic', 'sad', 'angry',
];
const VALID_TONE_MODES = new Set<ToneMode>(['auto', 'manual']);

function clampText(s: string): string {
  return s.length > MAX_TEXT_LEN ? s.slice(0, MAX_TEXT_LEN) : s;
}

// 'auto' = adaptiveEngine.autoSwitchTone picks tone from text content (default,
// matches the README's behavior promise). Any specific ToneStyle = manual
// override; user-picked tone is forced for every utterance until reset.
export type ToneMode = 'auto' | 'manual';

interface MessageState {
  text: string;
  undoStack: string[];
  activeTone: ToneStyle;
  toneMode: ToneMode;
  autoSpeak: boolean;
  soundEnabled: boolean;
  history: HistoryEntry[];
  setTone: (tone: ToneStyle) => void;
  setToneMode: (mode: ToneMode) => void;
  appendWord: (word: string) => void;
  appendText: (text: string) => void;
  appendChar: (char: string) => void;
  deleteLastWord: () => void;
  deleteLastChar: () => void;
  clearAll: () => void;
  undo: () => void;
  setText: (text: string) => void;
  toggleAutoSpeak: () => void;
  toggleSound: () => void;
  addToHistory: (text: string) => void;
  clearHistory: () => void;
}

function pushUndo(s: { text: string; undoStack: string[] }): { undoStack: string[] } {
  return { undoStack: [s.text, ...s.undoStack].slice(0, MAX_UNDO) };
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set) => ({
      text: '',
      undoStack: [],
      activeTone: 'friendly' as ToneStyle,
      // Tone mode defaults to 'auto' so adaptiveEngine.autoSwitchTone picks
      // the right register from the text — matches README's "auto tone
      // switch" promise. setTone() flips this to 'manual' so a deliberate
      // user pick takes effect for subsequent utterances.
      toneMode: 'auto' as ToneMode,
      // Auto-speak ON by default — speech is the primary purpose of an
      // AAC app, and asking new users to discover a hidden toggle before
      // anything reads aloud is bad UX (and was reported in the wild).
      autoSpeak: true,
      soundEnabled: true,
      history: [],

      // Picking a specific tone implies manual mode. To go back to auto,
      // call setToneMode('auto') explicitly.
      setTone: (tone) => set({ activeTone: tone, toneMode: 'manual' }),
      setToneMode: (mode) => set({ toneMode: mode }),

      appendWord: (word) =>
        set((s) => ({ ...pushUndo(s), text: clampText(s.text.trim() ? `${s.text.trim()} ${word}` : word) })),

      appendText: (text) =>
        set((s) => ({ ...pushUndo(s), text: clampText(s.text.trim() ? `${s.text.trim()} ${text}` : text) })),

      appendChar: (char) =>
        set((s) => ({ ...pushUndo(s), text: clampText(s.text + char) })),

      deleteLastWord: () =>
        set((s) => {
          const words = s.text.trim().split(/\s+/).filter(Boolean);
          words.pop();
          return { ...pushUndo(s), text: words.join(' ') };
        }),

      deleteLastChar: () =>
        set((s) => ({ ...pushUndo(s), text: s.text.slice(0, -1) })),

      clearAll: () => set((s) => ({ ...pushUndo(s), text: '' })),

      undo: () =>
        set((s) => {
          if (s.undoStack.length === 0) return {};
          const [prev, ...rest] = s.undoStack;
          return { text: prev, undoStack: rest };
        }),

      setText: (text) => set((s) => ({ ...pushUndo(s), text: clampText(text) })),

      toggleAutoSpeak: () => set((s) => ({ autoSpeak: !s.autoSpeak })),

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      addToHistory: (text) => {
        // Feed the adaptive engine: every history entry is a real authored
        // message worth learning from (length, time-of-day, content). The
        // category is unknown at this layer; callers that DO know it should
        // call recordMessage(text, categoryId) directly.
        try {
          import('@/services/adaptiveEngine').then((m) => m.recordMessage(text));
        } catch {}

        // Emergency detection: check every spoken message for crisis phrases.
        // If detected, trigger the emergency response system.
        const emergency = detectEmergency(text);
        if (emergency.detected && emergency.severity) {
          import('@/services/emergencyService').then((mod) => {
            mod.triggerEmergency(
              emergency.phrase || text,
              emergency.severity!,
              (_seconds) => { /* countdown handled by EmergencyOverlay if mounted */ },
              (_sent, _queued) => { /* completion logged by service */ },
            );
          }).catch(() => { /* emergency service import failed — non-blocking */ });
        }

        set((s) => ({
          history: [
            { text: text.slice(0, MAX_HISTORY_TEXT_LEN), timestamp: Date.now() },
            ...s.history,
          ].slice(0, MAX_HISTORY_ENTRIES),
        }));
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'prism-aac-message',
      version: 3,
      // v2: respect the user's existing autoSpeak preference. If they
      // deliberately turned it off (e.g., quiet classroom), don't override.
      // Only set true when the field was never persisted (undefined).
      // v3: default toneMode='auto' for users upgrading from v2. Existing
      // activeTone (e.g. 'friendly') is preserved but doesn't take effect
      // until they switch back to manual mode.
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState ?? {}) as {
          autoSpeak?: boolean;
          soundEnabled?: boolean;
          history?: Array<{ text: string; timestamp: number }>;
          toneMode?: ToneMode;
        };
        if (version < 2) {
          return { ...s, autoSpeak: s.autoSpeak ?? true, toneMode: 'auto' as ToneMode };
        }
        if (version < 3) {
          return { ...s, toneMode: s.toneMode ?? ('auto' as ToneMode) };
        }
        return s;
      },
      partialize: (s) => ({ autoSpeak: s.autoSpeak, soundEnabled: s.soundEnabled, history: s.history, activeTone: s.activeTone, toneMode: s.toneMode }),
      // Hydration validator. emergencyService.getRecentHistory reads
      // `parsed?.state?.history` directly from this store's localStorage
      // entry and feeds the entries into the AI emergency context — a
      // tampered history could trick the system or balloon the payload.
      // Drop malformed entries, cap totals, force booleans for
      // autoSpeak/soundEnabled so render code can rely on the type.
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Partial<MessageState>;
        const cleanHistory = (Array.isArray(incoming.history) ? incoming.history : [])
          .filter((h): h is HistoryEntry => {
            if (!h || typeof h !== 'object') return false;
            const x = h as unknown as Record<string, unknown>;
            return typeof x.text === 'string' && x.text.length > 0 && x.text.length <= MAX_HISTORY_TEXT_LEN
              && typeof x.timestamp === 'number' && Number.isFinite(x.timestamp);
          })
          .slice(0, MAX_HISTORY_ENTRIES);
        const tone = typeof incoming.activeTone === 'string' && (VALID_TONES as string[]).includes(incoming.activeTone)
          ? incoming.activeTone as ToneStyle
          : currentState.activeTone;
        const toneMode = typeof incoming.toneMode === 'string' && VALID_TONE_MODES.has(incoming.toneMode as ToneMode)
          ? incoming.toneMode as ToneMode
          : 'auto';
        return {
          ...currentState,
          autoSpeak: typeof incoming.autoSpeak === 'boolean' ? incoming.autoSpeak : true,
          soundEnabled: typeof incoming.soundEnabled === 'boolean' ? incoming.soundEnabled : true,
          history: cleanHistory,
          activeTone: tone,
          toneMode,
        };
      },
    },
  ),
);
