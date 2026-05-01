import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Category, Phrase, OrderingSequenceData } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { TEMPLATE_ORDERING_SEQUENCES } from '@/constants/orderingSequences';
import { VOCAB_SETS } from '@/constants/vocabularySets';
import { useSettingsStore } from '@/store/settingsStore';

interface CategoryState {
  customCategories: Category[];
  customPhrases: Phrase[];
  hiddenPhraseIds: string[];
  hiddenCategoryIds: string[];
  orderingSequences: OrderingSequenceData[];
  seeded: boolean;
  allCategories: (includeHidden?: boolean) => Category[];
  getPhrasesForCategory: (categoryId: string) => Phrase[];
  hideDefaultPhrase: (id: string) => void;
  unhideDefaultPhrase: (id: string) => void;
  hideCategoryId: (id: string) => void;
  unhideCategoryId: (id: string) => void;
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
      hiddenPhraseIds: [],
      hiddenCategoryIds: [],
      orderingSequences: [],
      seeded: false,

      allCategories: (includeHidden = false) => {
        const activeVocabSetId = useSettingsStore.getState().activeVocabSet;
        const vocabSet = VOCAB_SETS.find((vs) => vs.id === activeVocabSetId);
        let all = [...DEFAULT_CATEGORIES, ...get().customCategories].sort((a, b) => a.sortOrder - b.sortOrder);
        // Filter by vocab set (unless 'all' — which has empty categoryIds meaning show everything)
        if (vocabSet && vocabSet.id !== 'all' && vocabSet.categoryIds.length > 0) {
          const allowed = new Set(vocabSet.categoryIds);
          all = all.filter((c) => allowed.has(c.id) || c.isCustom);
        }
        if (includeHidden) return all;
        const hidden = new Set(get().hiddenCategoryIds);
        return all.filter((c) => !hidden.has(c.id));
      },

      getPhrasesForCategory: (categoryId) => {
        const hidden = new Set(get().hiddenPhraseIds);
        const defaults = DEFAULT_PHRASES.filter((p) => p.categoryId === categoryId && !hidden.has(p.id));
        const custom = get().customPhrases.filter((p) => p.categoryId === categoryId && !p.deletedAt);
        return [...defaults, ...custom].sort((a, b) => a.sortOrder - b.sortOrder);
      },

      hideDefaultPhrase: (id) =>
        set((s) => ({ hiddenPhraseIds: [...new Set([...s.hiddenPhraseIds, id])] })),

      unhideDefaultPhrase: (id) =>
        set((s) => ({ hiddenPhraseIds: s.hiddenPhraseIds.filter((h) => h !== id) })),

      hideCategoryId: (id) =>
        set((s) => ({ hiddenCategoryIds: [...new Set([...s.hiddenCategoryIds, id])] })),

      unhideCategoryId: (id) =>
        set((s) => ({ hiddenCategoryIds: s.hiddenCategoryIds.filter((h) => h !== id) })),

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
        set((s) => {
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          return {
            customPhrases: s.customPhrases
              .map((p) => p.id === id ? { ...p, deletedAt: Date.now() } : p)
              .filter((p) => !p.deletedAt || p.deletedAt > thirtyDaysAgo),
          };
        }),

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
        hiddenPhraseIds: s.hiddenPhraseIds,
        hiddenCategoryIds: s.hiddenCategoryIds,
        orderingSequences: s.orderingSequences,
        seeded: s.seeded,
      }),
    },
  ),
);
