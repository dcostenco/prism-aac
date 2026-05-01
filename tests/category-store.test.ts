import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '@/store/categoryStore';
import { TEMPLATE_ORDERING_SEQUENCES as DEFAULT_ORDERING_SEQUENCES } from '@/constants/orderingSequences';

beforeEach(() => useCategoryStore.setState({ customCategories: [], customPhrases: [] }));

describe('CategoryStore — Default data', () => {
  it('returns 22 default categories', () => {
    const cats = useCategoryStore.getState().allCategories();
    expect(cats).toHaveLength(22);
    expect(cats.map(c => c.id)).toEqual([
      'core-pronouns', 'core-verbs', 'core-descriptors', 'core-little-words',
      'help-needs', 'quick-talk', 'feelings', 'questions',
      'actions', 'describing', 'people-social', 'food-ordering',
      'places-plans', 'school-work', 'health-body', 'time',
      'animals', 'colors', 'clothes', 'transport', 'weather', 'toys-fun',
    ]);
  });

  it('returns correct phrases for help-needs', () => {
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(phrases.length).toBe(14);
    expect(phrases[0].text).toBe('All done');
    expect(phrases[7].text).toBe('No');
    expect(phrases[13].text).toBe('I am tired');
  });

  it('returns empty array for unknown category', () => {
    const phrases = useCategoryStore.getState().getPhrasesForCategory('nonexistent');
    expect(phrases).toEqual([]);
  });
});

describe('CategoryStore — Custom categories', () => {
  it('addCustomCategory creates a new category', () => {
    useCategoryStore.getState().addCustomCategory('Favorites', '⭐');
    const cats = useCategoryStore.getState().allCategories();
    expect(cats).toHaveLength(23);
    const custom = cats.find(c => c.name === 'Favorites');
    expect(custom).toBeDefined();
    expect(custom!.icon).toBe('⭐');
    expect(custom!.isCustom).toBe(true);
  });

  it('removeCustomCategory removes category and its phrases', () => {
    useCategoryStore.getState().addCustomCategory('Test', '🧪');
    const cats = useCategoryStore.getState().allCategories();
    const testCat = cats.find(c => c.name === 'Test')!;
    useCategoryStore.getState().addCustomPhrase(testCat.id, 'test phrase');
    expect(useCategoryStore.getState().getPhrasesForCategory(testCat.id)).toHaveLength(1);
    useCategoryStore.getState().removeCustomCategory(testCat.id);
    expect(useCategoryStore.getState().allCategories()).toHaveLength(22);
    expect(useCategoryStore.getState().getPhrasesForCategory(testCat.id)).toHaveLength(0);
  });
});

describe('CategoryStore — Custom phrases', () => {
  it('addCustomPhrase adds to existing category', () => {
    useCategoryStore.getState().addCustomPhrase('help-needs', 'I feel sick');
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(phrases).toHaveLength(15);
    expect(phrases.some(p => p.text === 'I feel sick')).toBe(true);
  });

  it('removeCustomPhrase removes only that phrase', () => {
    useCategoryStore.getState().addCustomPhrase('help-needs', 'Temp phrase');
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    const temp = phrases.find(p => p.text === 'Temp phrase')!;
    useCategoryStore.getState().removeCustomPhrase(temp.id);
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs')).toHaveLength(14);
  });

  it('cannot remove default phrases', () => {
    useCategoryStore.getState().removeCustomPhrase('help-all-done');
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs')).toHaveLength(14);
  });
});

describe('CategoryStore — Gap tests', () => {
  it('custom category with empty name still works', () => {
    useCategoryStore.getState().addCustomCategory('', '📌');
    expect(useCategoryStore.getState().allCategories()).toHaveLength(23);
  });

  it('custom phrase with empty text still works', () => {
    useCategoryStore.getState().addCustomPhrase('help-needs', '');
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs')).toHaveLength(15);
  });

  it('ordering sequences exist for food-ordering category', () => {
    // Verify the data constants are correct
    const foodSeqs = DEFAULT_ORDERING_SEQUENCES.filter(s => s.categoryId === 'food-ordering');
    expect(foodSeqs).toHaveLength(2);
    expect(foodSeqs[0].name).toBe('Chipotle');
    expect(foodSeqs[0].steps).toHaveLength(5);
    expect(foodSeqs[1].name).toBe('General Restaurant');
    expect(foodSeqs[1].steps).toHaveLength(4);
  });
});
