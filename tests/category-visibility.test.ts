import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '@/store/categoryStore';

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
    expect(visible).toHaveLength(21);
  });

  it('hidden category still appears in allCategories(true)', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    const all = useCategoryStore.getState().allCategories(true);
    expect(all.find((c) => c.id === 'help-needs')).toBeDefined();
    expect(all).toHaveLength(22);
  });

  it('unhideCategoryId restores the category', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    useCategoryStore.getState().unhideCategoryId('help-needs');
    const visible = useCategoryStore.getState().allCategories();
    expect(visible.find((c) => c.id === 'help-needs')).toBeDefined();
    expect(visible).toHaveLength(22);
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
    expect(visible).toHaveLength(19);
    expect(visible.find((c) => c.id === 'help-needs')).toBeUndefined();
    expect(visible.find((c) => c.id === 'quick-talk')).toBeUndefined();
    expect(visible.find((c) => c.id === 'feelings')).toBeUndefined();
  });

  it('hiding same category twice does not duplicate the hidden entry', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    useCategoryStore.getState().hideCategoryId('help-needs');
    const visible = useCategoryStore.getState().allCategories();
    expect(visible).toHaveLength(21);
    // Unhide once should fully restore
    useCategoryStore.getState().unhideCategoryId('help-needs');
    expect(useCategoryStore.getState().allCategories()).toHaveLength(22);
  });

  it('all hidden categories still appear in allCategories(true)', () => {
    useCategoryStore.getState().hideCategoryId('help-needs');
    useCategoryStore.getState().hideCategoryId('actions');
    useCategoryStore.getState().hideCategoryId('animals');
    const all = useCategoryStore.getState().allCategories(true);
    expect(all).toHaveLength(22);
  });

  it('unhiding a non-hidden category is a no-op', () => {
    useCategoryStore.getState().unhideCategoryId('help-needs');
    expect(useCategoryStore.getState().allCategories()).toHaveLength(22);
  });
});

describe('CategoryStore — Phrase visibility', () => {
  it('hideDefaultPhrase hides a phrase from getPhrasesForCategory', () => {
    useCategoryStore.getState().hideDefaultPhrase('help-all-done');
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(phrases.find((p) => p.id === 'help-all-done')).toBeUndefined();
    expect(phrases).toHaveLength(13);
  });

  it('unhideDefaultPhrase restores the phrase', () => {
    useCategoryStore.getState().hideDefaultPhrase('help-all-done');
    useCategoryStore.getState().unhideDefaultPhrase('help-all-done');
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(phrases.find((p) => p.id === 'help-all-done')).toBeDefined();
    expect(phrases).toHaveLength(14);
  });
});
