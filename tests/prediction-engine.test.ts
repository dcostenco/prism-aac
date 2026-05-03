import { describe, it, expect } from 'vitest';
import { getPredictions, recordWord, recordBigram, recordTrigram, buildNgramsFromPhrases, decayPredictions } from '@/engine/predictionEngine';
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
    // Mid-sentence predictions stay lowercase (matches user typing register).
    // Capitalization is reserved for sentence-start (empty input or after .!?)
    // and special always-caps words like "I".
    expect(preds[0]).toBe('pizza');
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

  it('preserves entries that decay to count 1 (protected by 30-day hard cutoff)', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const wf: Record<string, WordFreqEntry> = {
      rare: { count: 2, lastUsed: eightDaysAgo },
    };
    const result = decayPredictions(wf);
    expect(result.rare).toBeDefined();
    expect(result.rare.count).toBe(1);
  });

  it('hard-deletes single-use entries older than 30 days (typo cleanup)', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const wf: Record<string, WordFreqEntry> = {
      typo: { count: 1, lastUsed: thirtyOneDaysAgo },
      realword: { count: 5, lastUsed: thirtyOneDaysAgo },
    };
    const result = decayPredictions(wf);
    expect(result.typo).toBeUndefined(); // count=1, >30 days → deleted
    expect(result.realword).toBeDefined(); // count=5, survives decay
  });

  it('keeps single-use entries younger than 30 days', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const wf: Record<string, WordFreqEntry> = {
      newword: { count: 1, lastUsed: twoDaysAgo },
    };
    const result = decayPredictions(wf);
    expect(result.newword).toBeDefined();
  });

  it('does not decay entries newer than 7 days', () => {
    const wf: Record<string, WordFreqEntry> = {
      fresh: { count: 5, lastUsed: Date.now() - 3 * 24 * 60 * 60 * 1000 },
    };
    const result = decayPredictions(wf);
    expect(result.fresh.count).toBe(5);
  });
});

describe('PredictionEngine — Trigram', () => {
  it('trigram context provides strongest prediction signal', () => {
    const wf: Record<string, WordFreqEntry> = {
      help: { count: 10, lastUsed: Date.now() },
      hungry: { count: 5, lastUsed: Date.now() },
      bathroom: { count: 3, lastUsed: Date.now() },
    };
    const bg: Record<string, WordFreqEntry> = {
      'am|hungry': { count: 5, lastUsed: Date.now() },
    };
    const tg: Record<string, WordFreqEntry> = {
      'i|am|hungry': { count: 8, lastUsed: Date.now() },
      'i|am|thirsty': { count: 2, lastUsed: Date.now() },
    };
    const preds = getPredictions('I am', wf, bg, undefined, tg);
    expect(preds[0].toLowerCase()).toBe('hungry');
  });

  it('recordTrigram creates word triple entry', () => {
    const tg = recordTrigram({}, 'i', 'want', 'pizza');
    expect(tg['i|want|pizza']).toBeDefined();
    expect(tg['i|want|pizza'].count).toBe(1);
  });

  it('recordTrigram increments existing entry', () => {
    let tg: Record<string, WordFreqEntry> = { 'i|want|pizza': { count: 3, lastUsed: 1000 } };
    tg = recordTrigram(tg, 'i', 'want', 'pizza');
    expect(tg['i|want|pizza'].count).toBe(4);
  });

  it('buildNgramsFromPhrases extracts bigrams and trigrams', () => {
    const { bigrams, trigrams } = buildNgramsFromPhrases([
      'I need help',
      'I am hungry',
      'I am thirsty',
    ]);
    expect(bigrams['i|need']).toBeDefined();
    expect(bigrams['i|am'].count).toBe(2);
    expect(trigrams['i|need|help']).toBeDefined();
    expect(trigrams['i|am|hungry']).toBeDefined();
    expect(trigrams['i|am|thirsty']).toBeDefined();
  });

  it('falls back to bigram when no trigram match', () => {
    const wf: Record<string, WordFreqEntry> = {
      pizza: { count: 5, lastUsed: Date.now() },
    };
    const bg: Record<string, WordFreqEntry> = {
      'want|pizza': { count: 8, lastUsed: Date.now() },
    };
    const tg: Record<string, WordFreqEntry> = {};
    const preds = getPredictions('I want', wf, bg, undefined, tg);
    expect(preds[0]).toBe('pizza');
  });

  it('capitalizes prediction at sentence start (empty input)', () => {
    const wf: Record<string, WordFreqEntry> = { hello: { count: 100, lastUsed: Date.now() } };
    const bg: Record<string, WordFreqEntry> = {};
    const preds = getPredictions('', wf, bg);
    expect(preds[0]).toBe('Hello');
  });

  it('capitalizes prediction after sentence-ending punctuation', () => {
    const wf: Record<string, WordFreqEntry> = { hello: { count: 100, lastUsed: Date.now() } };
    const bg: Record<string, WordFreqEntry> = {};
    const preds = getPredictions('Done.', wf, bg);
    expect(preds[0]).toBe('Hello');
  });

  it('always capitalizes "i" pronoun regardless of position', () => {
    const wf: Record<string, WordFreqEntry> = { i: { count: 100, lastUsed: Date.now() } };
    const bg: Record<string, WordFreqEntry> = { 'and|i': { count: 50, lastUsed: Date.now() } };
    const preds = getPredictions('you and', wf, bg);
    expect(preds[0]).toBe('I');
  });
});

describe('PredictionEngine — Prefix completion', () => {
  it('completes partial word input', () => {
    const wf: Record<string, WordFreqEntry> = {
      bathroom: { count: 10, lastUsed: Date.now() },
      banana: { count: 5, lastUsed: Date.now() },
      car: { count: 20, lastUsed: Date.now() },
    };
    const preds = getPredictions('ba', wf, {});
    const lower = preds.map(p => p.toLowerCase());
    expect(lower).toContain('bathroom');
    expect(lower).toContain('banana');
  });

  it('does not suggest the partial word itself', () => {
    const wf: Record<string, WordFreqEntry> = {
      bath: { count: 10, lastUsed: Date.now() },
      bathroom: { count: 5, lastUsed: Date.now() },
    };
    const preds = getPredictions('bath', wf, {});
    expect(preds.map(p => p.toLowerCase())).not.toContain('bath');
    expect(preds.map(p => p.toLowerCase())).toContain('bathroom');
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
