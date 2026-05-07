import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Category, Phrase, OrderingSequenceData } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { TEMPLATE_ORDERING_SEQUENCES } from '@/constants/orderingSequences';
import { VOCAB_SETS } from '@/constants/vocabularySets';
import { useSettingsStore } from '@/store/settingsStore';
import { randomId } from '@/lib/uuid';
import { sanitizeString } from '@/lib/safeStrings';

/** Per-field bounds. Custom phrases get rendered directly to the AAC
 *  user's UI as tappable buttons; a tampered persist entry could
 *  otherwise inject hostile content the user is led to tap. */
const MAX_NAME_LEN = 80;        // category name
const MAX_PHRASE_LEN = 500;     // custom phrase body — long enough for clinical sentences
const MAX_ICON_LEN = 16;        // emoji + variation selectors
const MAX_CUSTOM_CATEGORIES = 50;
const MAX_CUSTOM_PHRASES = 1000;
const MAX_HIDDEN_LIST = 1000;
const MAX_ORDERING_SEQUENCES = 100;
const MAX_SEQUENCE_STEPS = 20;
const MAX_SEQUENCE_OPTIONS_PER_STEP = 30;

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

      addCustomCategory: (name, icon) => {
        const cleanName = sanitizeString(name, MAX_NAME_LEN);
        const cleanIcon = sanitizeString(icon, MAX_ICON_LEN);
        if (!cleanName) return;
        set((s) => {
          if (s.customCategories.length >= MAX_CUSTOM_CATEGORIES) return s;
          return {
            customCategories: [
              ...s.customCategories,
              { id: randomId(), name: cleanName, icon: cleanIcon, sortOrder: DEFAULT_CATEGORIES.length + s.customCategories.length, isCustom: true },
            ],
          };
        });
      },

      removeCustomCategory: (id) =>
        set((s) => ({
          customCategories: s.customCategories.filter((c) => c.id !== id),
          customPhrases: s.customPhrases.filter((p) => p.categoryId !== id),
          orderingSequences: s.orderingSequences.filter((seq) => seq.categoryId !== id),
        })),

      addCustomPhrase: (categoryId, text) => {
        const cleanText = sanitizeString(text, MAX_PHRASE_LEN);
        const cleanCategoryId = typeof categoryId === 'string' ? categoryId.slice(0, 64) : '';
        if (!cleanText || !cleanCategoryId) return;
        set((s) => {
          // Cap the live (non-deleted) custom phrases. The deletedAt
          // soft-delete window can grow on top, but live count is what
          // renders.
          const liveCount = s.customPhrases.filter((p) => !p.deletedAt).length;
          if (liveCount >= MAX_CUSTOM_PHRASES) return s;
          return {
            customPhrases: [
              ...s.customPhrases,
              {
                id: randomId(),
                categoryId: cleanCategoryId,
                text: cleanText,
                sortOrder: s.customPhrases.filter(p => p.categoryId === cleanCategoryId && !p.deletedAt).length + 100,
                isCustom: true,
                usageCount: 0,
              },
            ],
          };
        });
      },

      removeCustomPhrase: (id) =>
        set((s) => {
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          return {
            customPhrases: s.customPhrases
              .map((p) => p.id === id ? { ...p, deletedAt: Date.now() } : p)
              .filter((p) => !p.deletedAt || p.deletedAt > thirtyDaysAgo),
          };
        }),

      addOrderingSequence: (seq) => {
        // Shape-validate the incoming sequence. Caller could be a
        // future caregiver-note action that builds a sequence from
        // an LLM response — we don't trust the shape blindly.
        if (!seq || typeof seq !== 'object') return;
        if (typeof seq.id !== 'string' || !seq.id) return;
        if (typeof seq.name !== 'string' || !seq.name) return;
        if (typeof seq.categoryId !== 'string' || !seq.categoryId) return;
        if (!Array.isArray(seq.steps)) return;
        const cleanSeq: OrderingSequenceData = {
          ...seq,
          name: sanitizeString(seq.name, MAX_NAME_LEN),
          steps: seq.steps.slice(0, MAX_SEQUENCE_STEPS).map((step) => ({
            ...step,
            label: typeof step.label === 'string' ? sanitizeString(step.label, MAX_NAME_LEN) : '',
            options: Array.isArray(step.options)
              ? step.options
                  .slice(0, MAX_SEQUENCE_OPTIONS_PER_STEP)
                  .filter((o) => o && typeof o === 'object' && typeof o.text === 'string')
                  .map((o) => ({ ...o, text: sanitizeString(o.text, MAX_PHRASE_LEN) }))
              : [],
          })),
        };
        set((s) => {
          if (s.orderingSequences.length >= MAX_ORDERING_SEQUENCES) return s;
          return { orderingSequences: [...s.orderingSequences, cleanSeq] };
        });
      },

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
      // Hydration validator. Custom categories + phrases get rendered
      // directly to the AAC user as tappable buttons — a tampered
      // localStorage entry could otherwise inject hostile text the
      // user is led to tap. Reject malformed entries, cap counts, and
      // sanitize all strings at the boundary.
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Partial<CategoryState>;

        const cleanCategories = (Array.isArray(incoming.customCategories) ? incoming.customCategories : [])
          .filter((c): c is Category => {
            if (!c || typeof c !== 'object') return false;
            const x = c as unknown as Record<string, unknown>;
            return typeof x.id === 'string' && !!x.id && x.id.length <= 64
              && typeof x.name === 'string' && !!x.name && x.name.length <= MAX_NAME_LEN
              && (x.icon === undefined || typeof x.icon === 'string')
              && typeof x.sortOrder === 'number' && Number.isFinite(x.sortOrder);
          })
          .slice(0, MAX_CUSTOM_CATEGORIES);

        const cleanPhrases = (Array.isArray(incoming.customPhrases) ? incoming.customPhrases : [])
          .filter((p): p is Phrase => {
            if (!p || typeof p !== 'object') return false;
            const x = p as unknown as Record<string, unknown>;
            return typeof x.id === 'string' && !!x.id && x.id.length <= 64
              && typeof x.categoryId === 'string' && !!x.categoryId && x.categoryId.length <= 64
              && typeof x.text === 'string' && !!x.text && x.text.length <= MAX_PHRASE_LEN
              && typeof x.sortOrder === 'number' && Number.isFinite(x.sortOrder);
          })
          .slice(0, MAX_CUSTOM_PHRASES);

        const cleanIdList = (raw: unknown): string[] => {
          if (!Array.isArray(raw)) return [];
          return raw
            .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64)
            .slice(0, MAX_HIDDEN_LIST);
        };

        const cleanSequences = (Array.isArray(incoming.orderingSequences) ? incoming.orderingSequences : [])
          .filter((seq): seq is OrderingSequenceData => {
            if (!seq || typeof seq !== 'object') return false;
            const x = seq as unknown as Record<string, unknown>;
            return typeof x.id === 'string' && !!x.id
              && typeof x.name === 'string' && !!x.name && x.name.length <= MAX_NAME_LEN
              && typeof x.categoryId === 'string' && !!x.categoryId
              && Array.isArray(x.steps);
          })
          .slice(0, MAX_ORDERING_SEQUENCES);

        return {
          ...currentState,
          customCategories: cleanCategories,
          customPhrases: cleanPhrases,
          hiddenPhraseIds: cleanIdList(incoming.hiddenPhraseIds),
          hiddenCategoryIds: cleanIdList(incoming.hiddenCategoryIds),
          orderingSequences: cleanSequences,
          seeded: typeof incoming.seeded === 'boolean' ? incoming.seeded : false,
        };
      },
    },
  ),
);
