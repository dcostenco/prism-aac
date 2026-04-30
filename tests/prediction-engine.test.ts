import { describe, it, expect } from 'vitest';
import { getPredictions, recordWord, recordBigram, decayPredictions } from '@/engine/predictionEngine';
import { WordFreqEntry } from '@/types';

describe('PredictionEngine — Core algorithm', () => {
  it('returns default predictions when no data', () => {
    const preds = getPredictions('', {}, {});
    expect(preds).toEqual(['I', 'We', 'Can', 'Help', 'All done']);
  });

  it('returns 5 predictions max', () => {
    const wf: Record<string, WordFreqEntry> = {};
    for (let i = 0; i < 20; i++) wf[`word${i}`] = { count: 20 - i, lastUsed: Date.now() };
    const preds = getPredictions('', wf, {});
    expect(preds).toHaveLength(5);
  });

  it('bigram context boosts related words', () => {
    const wf: Record<string, WordFreqEntry> = {
      pizza: { count: 5, lastUsed: Date.now() },
      water: { count: 10, lastUsed: Date.now() },
    };
    const bg: Record<string, WordFreqEntry> = {
      'want|pizza': { count: 8, lastUsed: Date.now() },
    };
    const preds = getPredictions('I want', wf, bg);
    expect(preds[0]).toBe('Pizza'); // bigram "want→pizza" should boost it to #1
  });

  it('excludes the last word from predictions', () => {
    const wf: Record<string, WordFreqEntry> = {
      hello: { count: 100, lastUsed: Date.now() },
      world: { count: 50, lastUsed: Date.now() },
    };
    const preds = getPredictions('hello', wf, {});
    expect(preds.map(p => p.toLowerCase())).not.toContain('hello');
  });

  it('fills remaining slots with defaults', () => {
    const wf: Record<string, WordFreqEntry> = {
      pizza: { count: 5, lastUsed: Date.now() },
    };
    const preds = getPredictions('', wf, {});
    expect(preds).toHaveLength(5);
    expect(preds).toContain('Pizza');
    // Defaults fill remaining slots
    expect(preds.filter(p => ['I', 'We', 'Can', 'Help', 'All done'].includes(p)).length).toBeGreaterThanOrEqual(4);
  });
});

describe('PredictionEngine — Learning', () => {
  it('recordWord creates new entry', () => {
    const wf = recordWord({}, 'hello');
    expect(wf.hello).toBeDefined();
    expect(wf.hello.count).toBe(1);
  });

  it('recordWord increments existing entry', () => {
    let wf: Record<string, WordFreqEntry> = { hello: { count: 3, lastUsed: 1000 } };
    wf = recordWord(wf, 'hello');
    expect(wf.hello.count).toBe(4);
    expect(wf.hello.lastUsed).toBeGreaterThan(1000);
  });

  it('recordBigram creates word pair entry', () => {
    const bg = recordBigram({}, 'want', 'pizza');
    expect(bg['want|pizza']).toBeDefined();
    expect(bg['want|pizza'].count).toBe(1);
  });

  it('recordWord normalizes to lowercase', () => {
    const wf = recordWord({}, 'Hello');
    expect(wf.hello).toBeDefined();
    expect(wf.Hello).toBeUndefined();
  });
});

describe('PredictionEngine — Decay', () => {
  it('decays old entries by 5%', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const wf: Record<string, WordFreqEntry> = {
      old: { count: 100, lastUsed: eightDaysAgo },
      recent: { count: 50, lastUsed: Date.now() },
    };
    const result = decayPredictions(wf);
    expect(result.old.count).toBe(95); // 100 * 0.95
    expect(result.recent.count).toBe(50); // not decayed
  });

  it('removes entries that decay to count 1', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const wf: Record<string, WordFreqEntry> = {
      rare: { count: 1, lastUsed: eightDaysAgo },
    };
    const result = decayPredictions(wf);
    expect(result.rare).toBeUndefined();
  });

  it('does not decay entries newer than 7 days', () => {
    const wf: Record<string, WordFreqEntry> = {
      fresh: { count: 5, lastUsed: Date.now() - 3 * 24 * 60 * 60 * 1000 },
    };
    const result = decayPredictions(wf);
    expect(result.fresh.count).toBe(5);
  });
});

describe('PredictionEngine — Gap tests', () => {
  it('handles empty text input', () => {
    const preds = getPredictions('', {}, {});
    expect(preds).toHaveLength(5);
  });

  it('handles text with only spaces', () => {
    const preds = getPredictions('   ', {}, {});
    expect(preds).toHaveLength(5);
  });

  it('handles very long text input', () => {
    const longText = Array(100).fill('word').join(' ');
    const preds = getPredictions(longText, {}, {});
    expect(preds).toHaveLength(5);
  });

  it('handles special characters in text', () => {
    const preds = getPredictions("I don't know!", {}, {});
    expect(preds).toHaveLength(5);
  });

  it('bigram lookup is case-insensitive', () => {
    const bg: Record<string, WordFreqEntry> = {
      'want|pizza': { count: 5, lastUsed: Date.now() },
    };
    const preds = getPredictions('I Want', {}, bg);
    expect(preds.map(p => p.toLowerCase())).toContain('pizza');
  });
});
