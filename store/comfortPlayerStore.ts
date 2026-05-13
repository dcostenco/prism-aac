'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deleteBlob, deleteAllBlobs } from '@/services/comfortMediaStorage';

export const MAX_ITEMS = 50;
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_TOTAL_STORAGE = 500 * 1024 * 1024; // 500 MB

export const ALLOWED_MIME_TYPES = new Set([
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

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
  totalBytes: () => number;
}

export const useComfortPlayerStore = create<ComfortPlayerState>()(
  persist(
    (set, get) => ({
      items: [],
      isPlaying: false,
      currentIndex: 0,

      addItem: (item) => set((s) => {
        if (s.items.length >= MAX_ITEMS) return s;
        return { items: [...s.items, item] };
      }),

      removeItem: (id) => {
        deleteBlob(id).catch((err) => {
          console.error('[ComfortPlayer] Failed to delete blob:', id, err);
        });
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
        let currentIndex = s.currentIndex;
        if (s.currentIndex === idx) currentIndex = swap;
        else if (s.currentIndex === swap) currentIndex = idx;
        return { items, currentIndex };
      }),

      play: () => {
        if (get().items.length === 0) return;
        set({ isPlaying: true });
      },
      pause: () => set({ isPlaying: false }),
      next: () => set((s) => ({
        currentIndex: s.items.length > 0 ? (s.currentIndex + 1) % s.items.length : 0,
      })),
      setIndex: (i) => set((s) => {
        if (i < 0 || i >= s.items.length) return s;
        return { currentIndex: i, isPlaying: true };
      }),
      clear: () => {
        deleteAllBlobs().catch((err) => {
          console.error('[ComfortPlayer] Failed to delete all blobs:', err);
        });
        set({ items: [], isPlaying: false, currentIndex: 0 });
      },
      totalBytes: () => get().items.reduce((sum, i) => sum + i.sizeBytes, 0),
    }),
    { name: 'prism-aac-comfort-player' },
  ),
);
