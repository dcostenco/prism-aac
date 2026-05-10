import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '@/store/categoryStore';
import { DEFAULT_PHRASES } from '@/constants/phrases';

// Derive total dynamically so category expansions don't break counts.
const TOTAL = useCategoryStore.getState().allCategories().length;

beforeEach(() => {
  useCategoryStore.setState({
    customCategories: [],
    customPhrases: [],
    hiddenPhraseIds: [],
    hiddenCategoryIds: [],
  });
});

describe('CategoryStore — Category visibility', () => {
  it('hideCategoryId hides a category from allCategories()', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    const visible = useCategoryStore.getState().allCategories();
    expect(visible.find((c) => c.id === 'help-needs')).toBeUndefined();
    expect(visible).toHaveLength(TOTAL - 1);
  });

  it('hidden category still appears in allCategories(true)', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    const all = useCategoryStore.getState().allCategories(true);
    expect(all.find((c) => c.id === 'help-needs')).toBeDefined();
    expect(all).toHaveLength(TOTAL);
  });

  it('unhideCategoryId restores the category', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    useCategoryStore.getState().unhideCategoryId('help-needs');
    const visible = useCategoryStore.getState().allCategories();
    expect(visible.find((c) => c.id === 'help-needs')).toBeDefined();
    expect(visible).toHaveLength(TOTAL);
  });

  it('hidden category keeps its sort position when restored', () => {
    const originalIds = useCategoryStore.getState().allCategories().map((c) => c.id);
    useCategoryStore.getState().hideCategoryId('quick-talk');
    useCategoryStore.getState().unhideCategoryId('quick-talk');
    const restoredIds = useCategoryStore.getState().allCategories().map((c) => c.id);
    expect(restoredIds).toEqual(originalIds);
  });

  it('multiple categories can be hidden simultaneously', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    useCategoryStore.getState().hideCategoryId('quick-talk');
    useCategoryStore.getState().hideCategoryId('feelings');
    const visible = useCategoryStore.getState().allCategories();
    expect(visible).toHaveLength(TOTAL - 3);
    expect(visible.find((c) => c.id === 'help-needs')).toBeUndefined();
    expect(visible.find((c) => c.id === 'quick-talk')).toBeUndefined();
    expect(visible.find((c) => c.id === 'feelings')).toBeUndefined();
  });

  it('hiding same category twice does not duplicate the hidden entry', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    useCategoryStore.getState().hideCategoryId('help-needs');
    const visible = useCategoryStore.getState().allCategories();
    expect(visible).toHaveLength(TOTAL - 1);
    // Unhide once should fully restore
    useCategoryStore.getState().unhideCategoryId('help-needs');
    expect(useCategoryStore.getState().allCategories()).toHaveLength(TOTAL);
  });

  it('all hidden categories still appear in allCategories(true)', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    useCategoryStore.getState().hideCategoryId('actions');
    useCategoryStore.getState().hideCategoryId('animals');
    const all = useCategoryStore.getState().allCategories(true);
    expect(all).toHaveLength(TOTAL);
  });

  it('unhiding a non-hidden category is a no-op', () => {
    useCategoryStore.getState().unhideCategoryId('help-needs');
    expect(useCategoryStore.getState().allCategories()).toHaveLength(TOTAL);
  });
});

describe('CategoryStore — Phrase visibility', () => {
  // Derive count dynamically; Phase 1 dict expansion bumped help-needs from 14 → 69.
  const HELP_NEEDS_COUNT = DEFAULT_PHRASES.filter(p => p.categoryId === 'help-needs').length;

  it('hideDefaultPhrase hides a phrase from getPhrasesForCategory', () => {
    useCategoryStore.getState().hideDefaultPhrase('help-all-done');
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(phrases.find((p) => p.id === 'help-all-done')).toBeUndefined();
    expect(phrases).toHaveLength(HELP_NEEDS_COUNT - 1);
  });

  it('unhideDefaultPhrase restores the phrase', () => {
    useCategoryStore.getState().hideDefaultPhrase('help-all-done');
    useCategoryStore.getState().unhideDefaultPhrase('help-all-done');
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(phrases.find((p) => p.id === 'help-all-done')).toBeDefined();
    expect(phrases).toHaveLength(HELP_NEEDS_COUNT);
  });
});
