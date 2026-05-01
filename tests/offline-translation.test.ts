import { describe, it, expect } from 'vitest';
import { translateTextSync } from '@/services/translateService';

describe('Offline translation — Russian to English', () => {
  it('translates single AAC words', () => {
    expect(translateTextSync('да', 'ru', 'en').toLowerCase()).toContain('yes');
  });

  it('translates "нет" to "no"', () => {
    expect(translateTextSync('нет', 'ru', 'en').toLowerCase()).toContain('no');
  });

  it('returns original when same language', () => {
    expect(translateTextSync('hello', 'en', 'en')).toBe('hello');
  });

  it('returns original for empty text', () => {
    expect(translateTextSync('', 'ru', 'en')).toBe('');
  });

  it('translates known phrases', () => {
    const result = translateTextSync('привет', 'ru', 'en');
    expect(result.toLowerCase()).not.toBe('привет');
  });
});

describe('Offline translation — English to Russian', () => {
  it('translates "yes" to Russian', () => {
    const result = translateTextSync('yes', 'en', 'ru');
    expect(result).not.toBe('yes');
  });

  it('translates "hello" to Russian', () => {
    const result = translateTextSync('hello', 'en', 'ru');
    expect(result).not.toBe('hello');
  });
});

describe('Offline translation — Spanish to English', () => {
  it('translates "hola" to English', () => {
    const result = translateTextSync('hola', 'es', 'en');
    expect(result.toLowerCase()).not.toBe('hola');
  });

  it('translates "sí" to English', () => {
    const result = translateTextSync('sí', 'es', 'en');
    expect(result.toLowerCase()).toContain('yes');
  });
});

describe('Offline translation — word-by-word fallback', () => {
  it('translates known words in a sentence individually', () => {
    const result = translateTextSync('да нет', 'ru', 'en');
    expect(result.toLowerCase()).not.toBe('да нет');
  });

  it('preserves unknown words', () => {
    const result = translateTextSync('xyzunknown', 'ru', 'en');
    expect(result).toBe('xyzunknown');
  });
});
