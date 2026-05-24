/**
 * predictionEngine — hardening: mergeUserNgramsWithBoost, recordWord guards,
 * buildNgramsFromPhrases edge cases.
 *
 * These paths are critical for AAC prediction quality:
 *
 *   mergeUserNgramsWithBoost — applies the 10× boost that lets a user's
 *   personal vocabulary surface above the baseline corpus.  A broken boost
 *   silently degrades prediction to generic suggestions, removing
 *   user-specific phrases from the bar.
 *
 *   recordWord / recordBigram length guards — prevent a 201-char garbage
 *   token (pasted URL, OCR artefact) from polluting the word-frequency
 *   table and crowding out real predictions.
 *
 *   buildNgramsFromPhrases edge cases — single-word and two-word phrases
 *   must not crash; they simply produce no bigrams or trigrams (respectively
 *   no trigrams).
 */
import { describe, it, expect } from 'vitest';
import {
  mergeUserNgramsWithBoost,
  recordWord,
  recordBigram,
  buildNgramsFromPhrases,
} from '@/engine/predictionEngine';
import type { WordFreqEntry } from '@/types';

// ── mergeUserNgramsWithBoost ──────────────────────────────────────────────────

describe('mergeUserNgramsWithBoost', () => {
  it('adds user words not present in corpus with 10× boost', () => {
    const corpus: Record<string, WordFreqEntry> = {};
    const user: Record<string, WordFreqEntry> = { hello: { count: 3, lastUsed: 1000 } };
    const merged = mergeUserNgramsWithBoost(corpus, user);
    // 0 + 3 * 10 = 30
    expect(merged.hello.count).toBe(30);
  });

  it('adds boosted user count on top of existing corpus count', () => {
    const corpus: Record<string, WordFreqEntry> = { hello: { count: 5, lastUsed: 500 } };
    const user: Record<string, WordFreqEntry> = { hello: { count: 2, lastUsed: 1000 } };
    const merged = mergeUserNgramsWithBoost(corpus, user);
    // 5 + 2 * 10 = 25
    expect(merged.hello.count).toBe(25);
  });

  it('uses user lastUsed when provided', () => {
    const corpus: Record<string, WordFreqEntry> = { hello: { count: 1, lastUsed: 100 } };
    const user: Record<string, WordFreqEntry> = { hello: { count: 1, lastUsed: 9999 } };
    const merged = mergeUserNgramsWithBoost(corpus, user);
    expect(merged.hello.lastUsed).toBe(9999);
  });

  it('uses user lastUsed=0 as-is (nullish ?? does not fall back on 0)', () => {
    const corpus: Record<string, WordFreqEntry> = { hi: { count: 1, lastUsed: 5000 } };
    const user: Record<string, WordFreqEntry> = { hi: { count: 1, lastUsed: 0 } };
    const merged = mergeUserNgramsWithBoost(corpus, user);
    // v.lastUsed = 0 → 0 ?? ... → 0 (nullish coalescing does NOT fall back on 0)
    expect(merged.hi.lastUsed).toBe(0);
  });

  it('preserves corpus words not in user', () => {
    const corpus: Record<string, WordFreqEntry> = {
      apple: { count: 5, lastUsed: 100 },
      banana: { count: 3, lastUsed: 200 },
    };
    const user: Record<string, WordFreqEntry> = { apple: { count: 1, lastUsed: 999 } };
    const merged = mergeUserNgramsWithBoost(corpus, user);
    expect(merged.banana.count).toBe(3); // untouched
  });

  it('returns full corpus copy when user is empty', () => {
    const corpus: Record<string, WordFreqEntry> = { x: { count: 1, lastUsed: 1 } };
    const merged = mergeUserNgramsWithBoost(corpus, {});
    expect(merged.x.count).toBe(1);
    expect(Object.keys(merged)).toHaveLength(1);
  });

  it('does not mutate the original corpus object', () => {
    const corpus: Record<string, WordFreqEntry> = { word: { count: 1, lastUsed: 1 } };
    const original = { word: { ...corpus.word } };
    mergeUserNgramsWithBoost(corpus, { word: { count: 5, lastUsed: 99 } });
    expect(corpus.word.count).toBe(original.word.count);
  });

  it('user-only words get lastUsed=0 when user.lastUsed is falsy and corpus has no entry', () => {
    const user: Record<string, WordFreqEntry> = { newword: { count: 2, lastUsed: 0 } };
    const merged = mergeUserNgramsWithBoost({}, user);
    // user.lastUsed = 0 → falsy → existing?.lastUsed → undefined → ?? 0
    expect(merged.newword.lastUsed).toBe(0);
  });
});

// ── recordWord — length guard ─────────────────────────────────────────────────

describe('recordWord — input guards', () => {
  it('ignores empty string — returns wordFreq unchanged', () => {
    const wf: Record<string, WordFreqEntry> = { hello: { count: 1, lastUsed: 1 } };
    const result = recordWord(wf, '');
    expect(result).toBe(wf); // same reference — early return
  });

  it('ignores word longer than 200 chars — returns wordFreq unchanged', () => {
    const wf: Record<string, WordFreqEntry> = { hello: { count: 1, lastUsed: 1 } };
    const longWord = 'a'.repeat(201);
    const result = recordWord(wf, longWord);
    expect(result).toBe(wf); // same reference — guarded
    expect(result[longWord.toLowerCase()]).toBeUndefined();
  });

  it('accepts a word of exactly 200 chars', () => {
    const wf: Record<string, WordFreqEntry> = {};
    const word200 = 'b'.repeat(200);
    const result = recordWord(wf, word200);
    expect(result[word200]).toBeDefined();
    expect(result[word200].count).toBe(1);
  });
});

// ── buildNgramsFromPhrases — edge cases ───────────────────────────────────────

describe('buildNgramsFromPhrases — edge cases', () => {
  it('empty phrase list returns empty bigrams and trigrams', () => {
    const { bigrams, trigrams } = buildNgramsFromPhrases([]);
    expect(Object.keys(bigrams)).toHaveLength(0);
    expect(Object.keys(trigrams)).toHaveLength(0);
  });

  it('single-word phrase produces no bigrams or trigrams', () => {
    const { bigrams, trigrams } = buildNgramsFromPhrases(['hello']);
    expect(Object.keys(bigrams)).toHaveLength(0);
    expect(Object.keys(trigrams)).toHaveLength(0);
  });

  it('two-word phrase produces bigram but no trigram', () => {
    const { bigrams, trigrams } = buildNgramsFromPhrases(['want water']);
    expect(bigrams['want|water']).toBeDefined();
    expect(bigrams['want|water'].count).toBe(1);
    expect(Object.keys(trigrams)).toHaveLength(0);
  });

  it('three-word phrase produces bigrams AND trigram', () => {
    const { bigrams, trigrams } = buildNgramsFromPhrases(['I want water']);
    expect(bigrams['i|want']).toBeDefined();
    expect(bigrams['want|water']).toBeDefined();
    expect(trigrams['i|want|water']).toBeDefined();
  });

  it('normalizes to lowercase', () => {
    const { bigrams } = buildNgramsFromPhrases(['Hello World']);
    expect(bigrams['hello|world']).toBeDefined();
    expect(bigrams['Hello|World']).toBeUndefined();
  });

  it('accumulates counts across multiple phrases sharing a bigram', () => {
    const { bigrams } = buildNgramsFromPhrases([
      'I want juice',
      'I want water',
      'I want food',
    ]);
    expect(bigrams['i|want'].count).toBe(3);
  });
});
