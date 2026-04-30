import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HistoryEntry } from '@/types';
import { ToneStyle } from '@/services/azureTTS';

const MAX_UNDO = 20;

interface MessageState {
  text: string;
  undoStack: string[];
  activeTone: ToneStyle;
  autoSpeak: boolean;
  soundEnabled: boolean;
  history: HistoryEntry[];
  setTone: (tone: ToneStyle) => void;
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
      autoSpeak: false,
      soundEnabled: true,
      history: [],

      setTone: (tone) => set({ activeTone: tone }),

      appendWord: (word) =>
        set((s) => ({ ...pushUndo(s), text: s.text.trim() ? `${s.text.trim()} ${word}` : word })),

      appendText: (text) =>
        set((s) => ({ ...pushUndo(s), text: s.text.trim() ? `${s.text.trim()} ${text}` : text })),

      appendChar: (char) =>
        set((s) => ({ ...pushUndo(s), text: s.text + char })),

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

      setText: (text) => set((s) => ({ ...pushUndo(s), text })),

      toggleAutoSpeak: () => set((s) => ({ autoSpeak: !s.autoSpeak })),

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      addToHistory: (text) =>
        set((s) => ({
          history: [{ text, timestamp: Date.now() }, ...s.history].slice(0, 100),
        })),

      clearHistory: () => set({ history: [] }),
    }),
    { name: 'prism-aac-message', partialize: (s) => ({ autoSpeak: s.autoSpeak, soundEnabled: s.soundEnabled, history: s.history }) },
  ),
);
