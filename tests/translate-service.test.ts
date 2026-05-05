import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock — translateService dynamically imports aiService inside a
// setTimeout, and ESM caches that import after first use. vi.doMock() per
// test is ignored once cached. Hoisted vi.mock + a mutable spy is the
// reliable way to control return values per test.
const { translateAIMock } = vi.hoisted(() => ({
  translateAIMock: vi.fn(async (_text: string, _from: string, _to: string) => ''),
}));
vi.mock('@/services/aiService', () => ({
  translateAI: translateAIMock,
}));

import { translateText, translateWithAIRefine } from '@/services/translateService';

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

/**
 * Script-mismatch sanity check (regression: prism-coder ignored the
 * translate system prompt and replied as the AAC chat assistant in the
 * source language — e.g. "Я иду" RU→EN came back as the Russian greeting
 * "Я здесь, чтобы помочь…", garbage in the translation slot).
 */
describe('translateWithAIRefine — script sanity check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    translateAIMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects an "EN translation" returned in Cyrillic (the actual prod regression)', async () => {
    translateAIMock.mockResolvedValue('Я здесь, чтобы помочь. Что бы вы хотели сделать?');
    const onRefined = vi.fn();
    translateWithAIRefine('Я иду домой', 'ru', 'en', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).not.toHaveBeenCalled();
  });

  it('rejects a "RU translation" returned in Latin script', async () => {
    translateAIMock.mockResolvedValue("I'm going home");
    const onRefined = vi.fn();
    translateWithAIRefine('Take me home', 'en', 'ru', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).not.toHaveBeenCalled();
  });

  it('accepts a real EN translation of a RU phrase', async () => {
    translateAIMock.mockResolvedValue("I'm walking home");
    const onRefined = vi.fn();
    translateWithAIRefine('Я иду пешком', 'ru', 'en', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).toHaveBeenCalledWith("I'm walking home");
  });

  it('accepts a real Japanese translation', async () => {
    translateAIMock.mockResolvedValue('家に帰ります');
    const onRefined = vi.fn();
    translateWithAIRefine('Where is the kitchen', 'en', 'ja', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).toHaveBeenCalled();
  });

  it('rejects a "JA translation" returned in Latin script (model fell back to English)', async () => {
    translateAIMock.mockResolvedValue('I am going home (sorry, I cannot translate to Japanese)');
    const onRefined = vi.fn();
    translateWithAIRefine('Open the door now', 'en', 'ja', onRefined);
    await vi.runAllTimersAsync();
    expect(onRefined).not.toHaveBeenCalled();
  });
});
