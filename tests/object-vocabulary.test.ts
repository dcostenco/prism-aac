import { describe, it, expect } from 'vitest';
import { OBJECT_WORDS, getObjectWords } from '@/constants/objectVocabulary';

describe('objectVocabulary', () => {
  it('every object has English words', () => {
    for (const [label, langs] of Object.entries(OBJECT_WORDS)) {
      expect(langs.en, `${label} missing English`).toBeDefined();
      expect(langs.en!.length, `${label} English is empty`).toBeGreaterThan(0);
    }
  });

  it('getObjectWords returns words for known label', () => {
    const words = getObjectWords('cup', 'en');
    expect(words).toContain('cup');
    expect(words).toContain('drink');
  });

  it('getObjectWords is case-insensitive', () => {
    expect(getObjectWords('CUP', 'en')).toEqual(getObjectWords('cup', 'en'));
  });

  it('getObjectWords falls back to English', () => {
    const words = getObjectWords('cup', 'bg');
    expect(words.length).toBeGreaterThan(0);
    expect(words).toContain('cup');
  });

  it('getObjectWords returns empty for unknown label', () => {
    expect(getObjectWords('unicorn', 'en')).toEqual([]);
  });

  it('all AAC-critical objects are mapped', () => {
    const critical = ['cup', 'fork', 'spoon', 'bottle', 'bed', 'book', 'tv', 'toilet', 'teddy bear'];
    for (const obj of critical) {
      expect(OBJECT_WORDS[obj], `${obj} not mapped`).toBeDefined();
    }
  });

  it('Russian words use Cyrillic', () => {
    const words = getObjectWords('cup', 'ru');
    for (const w of words) {
      expect(w, `"${w}" is not Cyrillic`).toMatch(/[а-яёА-ЯЁ]/);
    }
  });
});
