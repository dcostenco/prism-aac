import { ALL_DEFAULT_PHRASES } from '../../constants/defaultPhrases';
import { DEFAULT_CATEGORIES } from '../../constants/defaultCategories';
import { ToneStyle } from '../../types';

const VALID_TONES: ToneStyle[] = [
  'cheerful', 'sad', 'angry', 'excited', 'friendly',
  'hopeful', 'calm', 'serious', 'empathetic',
];

describe('Default Phrases', () => {
  it('has phrases for every default category', () => {
    const categoryIds = DEFAULT_CATEGORIES.map(c => c.id);
    const phraseCategoryIds = new Set(ALL_DEFAULT_PHRASES.map(p => p.categoryId));
    for (const catId of categoryIds) {
      expect(phraseCategoryIds).toContain(catId);
    }
  });

  it('all phrases have unique IDs', () => {
    const ids = ALL_DEFAULT_PHRASES.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all phrases have non-empty text', () => {
    for (const p of ALL_DEFAULT_PHRASES) {
      expect(p.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('all phrases have valid tone values', () => {
    for (const p of ALL_DEFAULT_PHRASES) {
      expect(VALID_TONES).toContain(p.tone);
    }
  });

  it('all phrases reference existing categories', () => {
    const categoryIds = new Set(DEFAULT_CATEGORIES.map(c => c.id));
    for (const p of ALL_DEFAULT_PHRASES) {
      expect(categoryIds).toContain(p.categoryId);
    }
  });

  it('help category has essential phrases', () => {
    const helpPhrases = ALL_DEFAULT_PHRASES.filter(p => p.categoryId === 'help-needs');
    const texts = helpPhrases.map(p => p.text);
    expect(texts).toContain('All done');
    expect(texts).toContain('I need help');
    expect(texts).toContain('Bathroom');
    expect(texts).toContain('Yes');
    expect(texts).toContain('No');
  });

  it('all phrases have non-negative sort orders', () => {
    for (const p of ALL_DEFAULT_PHRASES) {
      expect(p.sortOrder).toBeGreaterThanOrEqual(0);
    }
  });

  it('no phrase has usage count > 0 by default', () => {
    for (const p of ALL_DEFAULT_PHRASES) {
      expect(p.usageCount).toBe(0);
    }
  });
});
