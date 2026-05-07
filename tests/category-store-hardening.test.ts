/**
 * categoryStore — input caps + hydration validator. Custom phrases get
 * rendered directly to the AAC user's UI as tappable buttons; a
 * tampered persist entry could otherwise inject hostile text the
 * user is led to tap.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '@/store/categoryStore';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
  useCategoryStore.setState({
    customCategories: [],
    customPhrases: [],
    hiddenPhraseIds: [],
    hiddenCategoryIds: [],
    orderingSequences: [],
    seeded: false,
  });
});

function seedPersisted(state: Record<string, unknown>): void {
  window.localStorage.setItem('prism-aac-categories', JSON.stringify({ state, version: 0 }));
}

describe('categoryStore — addCustomCategory caps', () => {
  it('clamps oversized name + icon', () => {
    useCategoryStore.getState().addCustomCategory('a'.repeat(500), 'b'.repeat(50));
    const cat = useCategoryStore.getState().customCategories[0];
    expect(cat.name.length).toBeLessThanOrEqual(80);
    expect(cat.icon.length).toBeLessThanOrEqual(16);
  });

  it('rejects beyond MAX_CUSTOM_CATEGORIES (no row created)', () => {
    for (let i = 0; i < 50; i++) useCategoryStore.getState().addCustomCategory(`cat ${i}`, '📌');
    expect(useCategoryStore.getState().customCategories).toHaveLength(50);
    useCategoryStore.getState().addCustomCategory('overflow', '📌');
    expect(useCategoryStore.getState().customCategories).toHaveLength(50);
  });
});

describe('categoryStore — addCustomPhrase caps', () => {
  it('clamps oversized text', () => {
    useCategoryStore.getState().addCustomPhrase('cat-1', 'x'.repeat(2000));
    expect(useCategoryStore.getState().customPhrases[0].text.length).toBeLessThanOrEqual(500);
  });

  it('rejects empty categoryId', () => {
    useCategoryStore.getState().addCustomPhrase('', 'hi');
    expect(useCategoryStore.getState().customPhrases).toHaveLength(0);
  });
});

describe('categoryStore — hydration validator', () => {
  it('drops malformed customCategories on rehydrate', () => {
    seedPersisted({
      customCategories: [
        { id: 'good', name: 'Good', icon: '🌟', sortOrder: 0, isCustom: true },
        { id: '', name: 'NoId', icon: '!', sortOrder: 1, isCustom: true },              // bad: empty id
        { id: 'huge-name', name: 'a'.repeat(500), icon: '!', sortOrder: 2 },             // bad: name overflow
        { id: 'bad-order', name: 'OK', icon: '!', sortOrder: 'NaN' },                    // bad: sortOrder not number
        'string-not-object',                                                              // bad
      ],
    });
    void useCategoryStore.persist.rehydrate();
    const cats = useCategoryStore.getState().customCategories;
    expect(cats.map((c) => c.id)).toEqual(['good']);
  });

  it('drops malformed customPhrases on rehydrate', () => {
    seedPersisted({
      customPhrases: [
        { id: 'good', categoryId: 'help', text: 'OK', sortOrder: 100, isCustom: true, usageCount: 0 },
        { id: 'huge', categoryId: 'help', text: 'x'.repeat(1000), sortOrder: 101 }, // bad: text overflow
        { id: 'no-cat', categoryId: '', text: 'orphan', sortOrder: 102 },             // bad: empty categoryId
      ],
    });
    void useCategoryStore.persist.rehydrate();
    const phrases = useCategoryStore.getState().customPhrases;
    expect(phrases.map((p) => p.id)).toEqual(['good']);
  });

  it('caps hiddenPhraseIds at MAX_HIDDEN_LIST', () => {
    seedPersisted({
      hiddenPhraseIds: Array.from({ length: 5000 }, (_, i) => `hidden-${i}`),
    });
    void useCategoryStore.persist.rehydrate();
    expect(useCategoryStore.getState().hiddenPhraseIds.length).toBeLessThanOrEqual(1000);
  });

  it('caps customPhrases at MAX_CUSTOM_PHRASES', () => {
    const huge = Array.from({ length: 2000 }, (_, i) => ({
      id: `p-${i}`, categoryId: 'help', text: `phrase ${i}`, sortOrder: i, isCustom: true, usageCount: 0,
    }));
    seedPersisted({ customPhrases: huge });
    void useCategoryStore.persist.rehydrate();
    expect(useCategoryStore.getState().customPhrases.length).toBeLessThanOrEqual(1000);
  });
});
