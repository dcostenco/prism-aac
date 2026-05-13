'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deleteBlob, deleteAllBlobs } from '@/services/comfortMediaStorage';

export interface ComfortMediaItem {
  id: string;
  type: 'audio' | 'photo' | 'video';
  label: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  createdAt: number;
}

interface ComfortPlayerState {
  items: ComfortMediaItem[];
  isPlaying: boolean;
  currentIndex: number;
  addItem: (item: ComfortMediaItem) => void;
  removeItem: (id: string) => void;
  reorderItem: (id: string, direction: 'up' | 'down') => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  setIndex: (i: number) => void;
  clear: () => void;
}

export const useComfortPlayerStore = create<ComfortPlayerState>()(
  persist(
    (set, get) => ({
      items: [],
      isPlaying: false,
      currentIndex: 0,

      addItem: (item) => set((s) => ({ items: [...s.items, item] })),

      removeItem: (id) => {
        deleteBlob(id).catch(() => {});
        set((s) => {
          const items = s.items.filter((i) => i.id !== id);
          const currentIndex = Math.min(s.currentIndex, Math.max(0, items.length - 1));
          return { items, currentIndex, isPlaying: items.length === 0 ? false : s.isPlaying };
        });
      },

      reorderItem: (id, direction) => set((s) => {
        const idx = s.items.findIndex((i) => i.id === id);
        if (idx < 0) return s;
        const swap = direction === 'up' ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= s.items.length) return s;
        const items = [...s.items];
        [items[idx], items[swap]] = [items[swap], items[idx]];
        return { items };
      }),

      play: () => {
        if (get().items.length === 0) return;
        set({ isPlaying: true });
      },
      pause: () => set({ isPlaying: false }),
      next: () => set((s) => ({
        currentIndex: s.items.length > 0 ? (s.currentIndex + 1) % s.items.length : 0,
      })),
      setIndex: (i) => set({ currentIndex: i, isPlaying: true }),
      clear: () => {
        deleteAllBlobs().catch(() => {});
        set({ items: [], isPlaying: false, currentIndex: 0 });
      },
    }),
    { name: 'prism-aac-comfort-player' },
  ),
);
