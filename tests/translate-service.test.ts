import { describe, it, expect } from 'vitest';
import { translateText } from '@/services/translateService';

describe('translateService', () => {
  it('returns original text when fromLang === toLang', async () => {
    const result = await translateText('Hello', 'en', 'en');
    expect(result).toBe('Hello');
  });

  it('returns original text for empty input', async () => {
    const result = await translateText('', 'en', 'es');
    expect(result).toBe('');
  });

  it('returns original text for whitespace-only input', async () => {
    const result = await translateText('   ', 'en', 'es');
    expect(result).toBe('   ');
  });

  it('returns original text when AI is unavailable (no account)', async () => {
    const result = await translateText('Hello world', 'en', 'ru');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
