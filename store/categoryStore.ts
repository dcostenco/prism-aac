import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Category, Phrase } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_PHRASES } from '@/constants/phrases';

interface CategoryState {
  customCategories: Category[];
  customPhrases: Phrase[];
  allCategories: () => Category[];
  getPhrasesForCategory: (categoryId: string) => Phrase[];
  addCustomCategory: (name: string, icon: string) => void;
  removeCustomCategory: (id: string) => void;
  addCustomPhrase: (categoryId: string, text: string) => void;
  removeCustomPhrase: (id: string) => void;
}

export const useCategoryStore = create<CategoryState>()(
  persist(
    (set, get) => ({
      customCategories: [],
      customPhrases: [],

      allCategories: () => [...DEFAULT_CATEGORIES, ...get().customCategories].sort((a, b) => a.sortOrder - b.sortOrder),

      getPhrasesForCategory: (categoryId) => {
        const defaults = DEFAULT_PHRASES.filter((p) => p.categoryId === categoryId);
        const custom = get().customPhrases.filter((p) => p.categoryId === categoryId);
        return [...defaults, ...custom].sort((a, b) => a.sortOrder - b.sortOrder);
      },

      addCustomCategory: (name, icon) =>
        set((s) => ({
          customCategories: [
            ...s.customCategories,
            { id: crypto.randomUUID(), name, icon, sortOrder: DEFAULT_CATEGORIES.length + s.customCategories.length, isCustom: true },
          ],
        })),

      removeCustomCategory: (id) =>
        set((s) => ({
          customCategories: s.customCategories.filter((c) => c.id !== id),
          customPhrases: s.customPhrases.filter((p) => p.categoryId !== id),
        })),

      addCustomPhrase: (categoryId, text) =>
        set((s) => ({
          customPhrases: [
            ...s.customPhrases,
            { id: crypto.randomUUID(), categoryId, text, sortOrder: 999, isCustom: true, usageCount: 0 },
          ],
        })),

      removeCustomPhrase: (id) =>
        set((s) => ({ customPhrases: s.customPhrases.filter((p) => p.id !== id) })),
    }),
    { name: 'prism-aac-categories', partialize: (s) => ({ customCategories: s.customCategories, customPhrases: s.customPhrases }) },
  ),
);
