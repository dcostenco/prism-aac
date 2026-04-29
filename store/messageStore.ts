import { create } from 'zustand';
import { ToneStyle } from '../types';

interface MessageState {
  text: string;
  activeTone: ToneStyle;
  appendWord: (word: string) => void;
  appendText: (text: string) => void;
  deleteLastWord: () => void;
  clearAll: () => void;
  setTone: (tone: ToneStyle) => void;
  setText: (text: string) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  text: '',
  activeTone: 'friendly',

  appendWord: (word: string) =>
    set((state) => ({
      text: state.text ? `${state.text} ${word}` : word,
    })),

  appendText: (text: string) =>
    set((state) => ({
      text: state.text ? `${state.text} ${text}` : text,
    })),

  deleteLastWord: () =>
    set((state) => {
      const words = state.text.trim().split(/\s+/);
      words.pop();
      return { text: words.join(' ') };
    }),

  clearAll: () => set({ text: '' }),

  setTone: (tone: ToneStyle) => set({ activeTone: tone }),

  setText: (text: string) => set({ text }),
}));
