import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Category, Phrase, OrderingSequenceData } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { TEMPLATE_ORDERING_SEQUENCES } from '@/constants/orderingSequences';

interface CategoryState {
  customCategories: Category[];
  customPhrases: Phrase[];
  orderingSequences: OrderingSequenceData[];
  seeded: boolean;
  allCategories: () => Category[];
  getPhrasesForCategory: (categoryId: string) => Phrase[];
  getSequencesForCategory: (categoryId: string) => OrderingSequenceData[];
  addCustomCategory: (name: string, icon: string) => void;
  removeCustomCategory: (id: string) => void;
  addCustomPhrase: (categoryId: string, text: string) => void;
  removeCustomPhrase: (id: string) => void;
  addOrderingSequence: (seq: OrderingSequenceData) => void;
  removeOrderingSequence: (id: string) => void;
  updateOrderingSequence: (seq: OrderingSequenceData) => void;
  seedTemplates: () => void;
}

export const useCategoryStore = create<CategoryState>()(
  persist(
    (set, get) => ({
      customCategories: [],
      customPhrases: [],
      orderingSequences: [],
      seeded: false,

      allCategories: () => [...DEFAULT_CATEGORIES, ...get().customCategories].sort((a, b) => a.sortOrder - b.sortOrder),

      getPhrasesForCategory: (categoryId) => {
        const defaults = DEFAULT_PHRASES.filter((p) => p.categoryId === categoryId);
        const custom = get().customPhrases.filter((p) => p.categoryId === categoryId);
        return [...defaults, ...custom].sort((a, b) => a.sortOrder - b.sortOrder);
      },

      getSequencesForCategory: (categoryId) =>
        get().orderingSequences.filter((s) => s.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder),

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
          orderingSequences: s.orderingSequences.filter((seq) => seq.categoryId !== id),
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

      addOrderingSequence: (seq) =>
        set((s) => ({ orderingSequences: [...s.orderingSequences, seq] })),

      removeOrderingSequence: (id) =>
        set((s) => ({ orderingSequences: s.orderingSequences.filter((seq) => seq.id !== id) })),

      updateOrderingSequence: (updated) =>
        set((s) => ({
          orderingSequences: s.orderingSequences.map((seq) => seq.id === updated.id ? updated : seq),
        })),

      seedTemplates: () => {
        if (get().seeded) return;
        set({ orderingSequences: [...TEMPLATE_ORDERING_SEQUENCES], seeded: true });
      },
    }),
    {
      name: 'prism-aac-categories',
      partialize: (s) => ({
        customCategories: s.customCategories,
        customPhrases: s.customPhrases,
        orderingSequences: s.orderingSequences,
        seeded: s.seeded,
      }),
    },
  ),
);
