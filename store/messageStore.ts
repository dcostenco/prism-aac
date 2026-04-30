import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HistoryEntry } from '@/types';

interface MessageState {
  text: string;
  prevText: string;
  autoSpeak: boolean;
  soundEnabled: boolean;
  history: HistoryEntry[];
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

export const useMessageStore = create<MessageState>()(
  persist(
    (set) => ({
      text: '',
      prevText: '',
      autoSpeak: false,
      soundEnabled: true,
      history: [],

      appendWord: (word) =>
        set((s) => ({ prevText: s.text, text: s.text.trim() ? `${s.text.trim()} ${word}` : word })),

      appendText: (text) =>
        set((s) => ({ prevText: s.text, text: s.text.trim() ? `${s.text.trim()} ${text}` : text })),

      appendChar: (char) =>
        set((s) => ({ prevText: s.text, text: s.text + char })),

      deleteLastWord: () =>
        set((s) => {
          const words = s.text.trim().split(/\s+/).filter(Boolean);
          words.pop();
          return { prevText: s.text, text: words.join(' ') };
        }),

      deleteLastChar: () =>
        set((s) => ({ prevText: s.text, text: s.text.slice(0, -1) })),

      clearAll: () => set((s) => ({ prevText: s.text, text: '' })),

      undo: () => set((s) => ({ text: s.prevText, prevText: s.text })),

      setText: (text) => set((s) => ({ prevText: s.text, text })),

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
