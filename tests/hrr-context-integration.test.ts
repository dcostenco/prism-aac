/**
 * HRR Context Integration — Deep Tests
 *
 * Covers the full AAC HRR pipeline:
 *   1. initAacHrr — WASM init, localStorage restore, graceful degradation
 *   2. recordPhrase — bigram + trigram encoding, context metadata
 *   3. getNextWordSuggestions — trigram-first cascade, dedup, topK
 *   4. getContextualSuggestions — phrase-level retrieval
 *   5. Persistence — debounced save to localStorage
 *   6. Edge cases — empty input, single words, Unicode, long phrases
 *   7. End-to-end record → suggest cycle
 *
 * synalux-hrr is resolved to tests/mocks/synalux-hrr.ts via vitest alias.
 * The mock HrrHologram uses exact key matching in probe(), so bigram/trigram
 * tests verify the exact keys being produced.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Spy on the mock HrrHologram to track encode calls
const encodeSpy = vi.fn();
const probeSpy = vi.fn();

vi.mock('synalux-hrr', async () => {
    const original = await vi.importActual<typeof import('synalux-hrr')>('synalux-hrr');
    const OrigHologram = original.HrrHologram;

    class SpyHologram extends OrigHologram {
        encode(concept: string, summary: string) {
            encodeSpy(concept, summary);
            super.encode(concept, summary);
        }
        probe(query: string, topK: number) {
            probeSpy(query, topK);
            return super.probe(query, topK);
        }
    }
    return { HrrHologram: SpyHologram };
});

let mod: typeof import('../services/hrrContext');

beforeEach(async () => {
    encodeSpy.mockClear();
    probeSpy.mockClear();
    vi.useFakeTimers();

    // Fresh module state
    vi.resetModules();
    mod = await import('../services/hrrContext');
});

afterEach(() => {
    vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════
// 1. Initialization
// ═══════════════════════════════════════════════════════════════

describe('initAacHrr', () => {
    it('initializes successfully', async () => {
        expect(mod.isAacHrrReady()).toBe(false);
        const ok = await mod.initAacHrr();
        expect(ok).toBe(true);
        expect(mod.isAacHrrReady()).toBe(true);
    });

    it('is idempotent', async () => {
        await mod.initAacHrr();
        encodeSpy.mockClear();
        const ok = await mod.initAacHrr();
        expect(ok).toBe(true);
    });

    it('restores valid hologram from localStorage', async () => {
        const valid = new Array(1024).fill(0.001);
        localStorage.setItem('prism-aac-hrr-hologram', JSON.stringify(valid));
        await mod.initAacHrr();
        expect(mod.isAacHrrReady()).toBe(true);
        expect(localStorage.getItem('prism-aac-hrr-hologram')).not.toBeNull();
    });

    it('handles corrupt localStorage gracefully', async () => {
        localStorage.setItem('prism-aac-hrr-hologram', 'NOT JSON');
        const ok = await mod.initAacHrr();
        expect(ok).toBe(true);
    });

    it('rejects hologram with wrong dimension', async () => {
        // DIM=1024, but this array is length 3 — should be rejected
        localStorage.setItem('prism-aac-hrr-hologram', JSON.stringify([1, 2, 3]));
        await mod.initAacHrr();
        expect(mod.isAacHrrReady()).toBe(true);
        // Corrupt data should have been removed
        expect(localStorage.getItem('prism-aac-hrr-hologram')).toBeNull();
    });

    it('rejects hologram containing NaN values', async () => {
        const corrupt = new Array(1024).fill(0);
        corrupt[0] = NaN;
        localStorage.setItem('prism-aac-hrr-hologram', JSON.stringify(corrupt));
        await mod.initAacHrr();
        expect(mod.isAacHrrReady()).toBe(true);
        expect(localStorage.getItem('prism-aac-hrr-hologram')).toBeNull();
    });

    it('rejects hologram containing Infinity', async () => {
        const corrupt = new Array(1024).fill(0);
        corrupt[5] = Infinity;
        localStorage.setItem('prism-aac-hrr-hologram', JSON.stringify(corrupt));
        await mod.initAacHrr();
        expect(mod.isAacHrrReady()).toBe(true);
        expect(localStorage.getItem('prism-aac-hrr-hologram')).toBeNull();
    });

    it('rejects hologram containing non-number values', async () => {
        const corrupt = new Array(1024).fill(0);
        corrupt[10] = 'not a number';
        localStorage.setItem('prism-aac-hrr-hologram', JSON.stringify(corrupt));
        await mod.initAacHrr();
        expect(mod.isAacHrrReady()).toBe(true);
        expect(localStorage.getItem('prism-aac-hrr-hologram')).toBeNull();
    });

    it('accepts valid hologram with correct dimension', async () => {
        const valid = new Array(1024).fill(0.001);
        localStorage.setItem('prism-aac-hrr-hologram', JSON.stringify(valid));
        await mod.initAacHrr();
        expect(mod.isAacHrrReady()).toBe(true);
        expect(localStorage.getItem('prism-aac-hrr-hologram')).not.toBeNull();
    });

    it('rejects hologram with NaN at element 500 (validates ALL elements)', async () => {
        const corrupt = new Array(1024).fill(0);
        corrupt[500] = NaN;
        localStorage.setItem('prism-aac-hrr-hologram', JSON.stringify(corrupt));
        await mod.initAacHrr();
        expect(localStorage.getItem('prism-aac-hrr-hologram')).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════
// destroyAacHrr — cleanup
// ═══════════════════════════════════════════════════════════════

describe('destroyAacHrr', () => {
    it('sets isAacHrrReady to false', async () => {
        await mod.initAacHrr();
        expect(mod.isAacHrrReady()).toBe(true);
        mod.destroyAacHrr();
        expect(mod.isAacHrrReady()).toBe(false);
    });

    it('recordPhrase is no-op after destroy', async () => {
        await mod.initAacHrr();
        mod.destroyAacHrr();
        encodeSpy.mockClear();
        mod.recordPhrase('hello world');
        expect(encodeSpy).not.toHaveBeenCalled();
    });

    it('getNextWordSuggestions returns empty after destroy', async () => {
        await mod.initAacHrr();
        mod.recordPhrase('I want water');
        mod.destroyAacHrr();
        expect(mod.getNextWordSuggestions('I')).toEqual([]);
    });

    it('re-init after destroy works correctly', async () => {
        await mod.initAacHrr();
        mod.recordPhrase('I want water');
        mod.destroyAacHrr();
        // Re-init
        const ok = await mod.initAacHrr();
        expect(ok).toBe(true);
        expect(mod.isAacHrrReady()).toBe(true);
    });

    it('does not resurrect a user scope when destroy races pending initialization', async () => {
        const pending = mod.initAacHrr('user:previous@example.com');
        mod.destroyAacHrr();

        expect(await pending).toBe(false);
        expect(mod.isAacHrrReady('user:previous@example.com')).toBe(false);

        expect(await mod.initAacHrr('user:next@example.com')).toBe(true);
        expect(mod.isAacHrrReady('user:next@example.com')).toBe(true);
    });

    it('clears persist timer — no crash after destroy', async () => {
        await mod.initAacHrr();
        mod.recordPhrase('test phrase');
        mod.destroyAacHrr();
        // Advance past debounce — timer was cleared, no crash
        vi.advanceTimersByTime(10_000);
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. recordPhrase — bigram + trigram encoding
// ═══════════════════════════════════════════════════════════════

describe('recordPhrase', () => {
    beforeEach(async () => {
        await mod.initAacHrr();
        encodeSpy.mockClear();
    });

    it('encodes full phrase as concept', () => {
        mod.recordPhrase('I want water');
        expect(encodeSpy).toHaveBeenCalledWith('I want water', 'I want water');
    });

    it('encodes bigrams: word_N → word_N+1', () => {
        mod.recordPhrase('I want water');
        expect(encodeSpy).toHaveBeenCalledWith('w:i', 'want');
        expect(encodeSpy).toHaveBeenCalledWith('w:want', 'water');
    });

    it('encodes trigrams: word_N word_N+1 → word_N+2', () => {
        mod.recordPhrase('I want water');
        expect(encodeSpy).toHaveBeenCalledWith('w:i want', 'water');
    });

    it('3-word phrase: 1 phrase + 2 bigrams + 1 trigram = 4 encodes', () => {
        mod.recordPhrase('I want water');
        expect(encodeSpy).toHaveBeenCalledTimes(4);
    });

    it('2-word phrase: 1 phrase + 1 bigram + 0 trigrams = 2 encodes', () => {
        mod.recordPhrase('more please');
        expect(encodeSpy).toHaveBeenCalledTimes(2);
        expect(encodeSpy).toHaveBeenCalledWith('more please', 'more please');
        expect(encodeSpy).toHaveBeenCalledWith('w:more', 'please');
    });

    it('single word: only phrase encode', () => {
        mod.recordPhrase('help');
        expect(encodeSpy).toHaveBeenCalledTimes(1);
        expect(encodeSpy).toHaveBeenCalledWith('help', 'help');
    });

    it('4-word phrase: 1 + 3 bigrams + 2 trigrams = 6', () => {
        mod.recordPhrase('I want more water');
        expect(encodeSpy).toHaveBeenCalledTimes(6);
        expect(encodeSpy).toHaveBeenCalledWith('w:i want', 'more');
        expect(encodeSpy).toHaveBeenCalledWith('w:want more', 'water');
    });

    it('5-word phrase: 1 + 4 bigrams + 3 trigrams = 8', () => {
        mod.recordPhrase('I want to go home');
        expect(encodeSpy).toHaveBeenCalledTimes(8);
    });

    it('lowercases n-gram keys, preserves value case', () => {
        mod.recordPhrase('Hello World');
        expect(encodeSpy).toHaveBeenCalledWith('w:hello', 'World');
    });

    it('includes context metadata in phrase key only', () => {
        mod.recordPhrase('I need help', { category: 'medical', timeOfDay: 'morning' });
        expect(encodeSpy).toHaveBeenCalledWith(
            'I need help|cat:medical|time:morning',
            'I need help',
        );
        // Bigrams do NOT have metadata
        expect(encodeSpy).toHaveBeenCalledWith('w:i', 'need');
        expect(encodeSpy).toHaveBeenCalledWith('w:need', 'help');
    });

    it('tone context included in phrase key', () => {
        mod.recordPhrase('stop', { tone: 'urgent' });
        expect(encodeSpy).toHaveBeenCalledWith('stop|tone:urgent', 'stop');
    });

    it('partitions personalized n-grams by AAC input language', () => {
        mod.recordPhrase('I need mom', { language: 'en' });

        expect(encodeSpy).toHaveBeenCalledWith('I need mom|lang:en', 'I need mom');
        expect(encodeSpy).toHaveBeenCalledWith('lang:en|w:i', 'need');
        expect(encodeSpy).toHaveBeenCalledWith('lang:en|w:i need', 'mom');
    });

    it('no-ops when not initialized', async () => {
        vi.resetModules();
        const fresh = await import('../services/hrrContext');
        encodeSpy.mockClear();
        fresh.recordPhrase('hello');
        expect(encodeSpy).not.toHaveBeenCalled();
    });

    // ── Unicode / multilingual ──

    it('Russian (Cyrillic) bigrams', () => {
        mod.recordPhrase('Я хочу воду');
        expect(encodeSpy).toHaveBeenCalledWith('w:я', 'хочу');
        expect(encodeSpy).toHaveBeenCalledWith('w:хочу', 'воду');
    });

    it('Arabic RTL text', () => {
        mod.recordPhrase('أريد ماء');
        expect(encodeSpy).toHaveBeenCalledWith('w:أريد', 'ماء');
    });

    it('mixed emoji + text', () => {
        mod.recordPhrase('I feel 😊 today');
        expect(encodeSpy).toHaveBeenCalledWith('w:i', 'feel');
        expect(encodeSpy).toHaveBeenCalledWith('w:feel', '😊');
        expect(encodeSpy).toHaveBeenCalledWith('w:😊', 'today');
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. getNextWordSuggestions
// ═══════════════════════════════════════════════════════════════

describe('getNextWordSuggestions', () => {
    beforeEach(async () => {
        await mod.initAacHrr();
        probeSpy.mockClear();
    });

    it('returns empty for empty text', () => {
        expect(mod.getNextWordSuggestions('')).toEqual([]);
    });

    it('returns empty for whitespace', () => {
        expect(mod.getNextWordSuggestions('   ')).toEqual([]);
    });

    it('returns empty when not initialized', async () => {
        vi.resetModules();
        const fresh = await import('../services/hrrContext');
        expect(fresh.getNextWordSuggestions('hello')).toEqual([]);
    });

    it('probes bigram only for single-word input', () => {
        mod.getNextWordSuggestions('hello');
        expect(probeSpy).toHaveBeenCalledWith('w:hello', 5);
        // No trigram probe (only 1 word)
        expect(probeSpy).toHaveBeenCalledTimes(1);
    });

    it('probes trigram + bigram for 2+ word input', () => {
        mod.getNextWordSuggestions('I want');
        expect(probeSpy).toHaveBeenCalledWith('w:i want', 5); // trigram first
        expect(probeSpy).toHaveBeenCalledWith('w:want', expect.any(Number)); // bigram second
    });

    it('trigram probe comes before bigram', () => {
        mod.getNextWordSuggestions('I want');
        expect(probeSpy.mock.calls[0][0]).toBe('w:i want');
        expect(probeSpy.mock.calls[1][0]).toBe('w:want');
    });

    it('uses last 2 words for trigram in long text', () => {
        mod.getNextWordSuggestions('please can you help me now');
        expect(probeSpy.mock.calls[0][0]).toBe('w:me now');
        expect(probeSpy.mock.calls[1][0]).toBe('w:now');
    });

    it('lowercases the probe keys', () => {
        mod.getNextWordSuggestions('Hello World');
        expect(probeSpy).toHaveBeenCalledWith('w:hello world', 5);
        expect(probeSpy).toHaveBeenCalledWith('w:world', expect.any(Number));
    });

    it('record then suggest: "I want" → "water"', () => {
        mod.recordPhrase('I want water');
        const suggestions = mod.getNextWordSuggestions('I want');
        // Trigram "w:i want" → "water" (similarity 0.72 from mock)
        expect(suggestions.some(s => s.word === 'water')).toBe(true);
    });

    it('never returns a phrase learned under a different language scope', () => {
        mod.recordPhrase('I need mom', { language: 'en' });
        mod.recordPhrase('I need eu', { language: 'ro' });

        expect(mod.getNextWordSuggestions('I need', 5, 'en').map((item) => item.word))
            .toContain('mom');
        expect(mod.getNextWordSuggestions('I need', 5, 'en').map((item) => item.word))
            .not.toContain('eu');
        expect(mod.getNextWordSuggestions('I need', 5, 'ro').map((item) => item.word))
            .toContain('eu');
        expect(mod.getNextWordSuggestions('I need', 5, 'fr')).toEqual([]);
    });

    it('record then suggest: "I" → "want" via bigram', () => {
        mod.recordPhrase('I want water');
        const suggestions = mod.getNextWordSuggestions('I');
        expect(suggestions.some(s => s.word === 'want')).toBe(true);
    });

    it('returns relevance scores', () => {
        mod.recordPhrase('I want water');
        const suggestions = mod.getNextWordSuggestions('I');
        for (const s of suggestions) {
            expect(typeof s.word).toBe('string');
            expect(typeof s.relevance).toBe('number');
            expect(s.relevance).toBeGreaterThanOrEqual(0.02);
        }
    });

    it('handles trailing space correctly (word is complete)', () => {
        mod.recordPhrase('I want water');
        probeSpy.mockClear();
        mod.getNextWordSuggestions('I want ');
        // split+filter gives ["I", "want"], trigram key: "w:i want"
        expect(probeSpy.mock.calls[0][0]).toBe('w:i want');
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. getContextualSuggestions
// ═══════════════════════════════════════════════════════════════

describe('getContextualSuggestions', () => {
    beforeEach(async () => {
        await mod.initAacHrr();
        probeSpy.mockClear();
    });

    it('returns empty for empty text', () => {
        expect(mod.getContextualSuggestions('')).toEqual([]);
    });

    it('probes with full text', () => {
        mod.getContextualSuggestions('I want water');
        expect(probeSpy).toHaveBeenCalledWith('I want water', 5);
    });

    it('includes category in query', () => {
        mod.getContextualSuggestions('lunch', { category: 'food' });
        expect(probeSpy).toHaveBeenCalledWith('lunch cat:food', 5);
    });

    it('includes timeOfDay in query', () => {
        mod.getContextualSuggestions('breakfast', { timeOfDay: 'morning' });
        expect(probeSpy).toHaveBeenCalledWith('breakfast time:morning', 5);
    });

    it('respects topK', () => {
        mod.getContextualSuggestions('test', undefined, 3);
        expect(probeSpy).toHaveBeenCalledWith('test', 3);
    });

    it('strips pipe-delimited metadata from results', () => {
        mod.recordPhrase('I want water', { category: 'food' });
        const results = mod.getContextualSuggestions('I want water|cat:food');
        for (const r of results) {
            expect(r.phrase).not.toContain('|');
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// 5. Persistence
// ═══════════════════════════════════════════════════════════════

describe('persistence', () => {
    beforeEach(async () => {
        await mod.initAacHrr();
    });

    it('does not persist immediately', () => {
        localStorage.removeItem('prism-aac-hrr-hologram');
        mod.recordPhrase('hello world');
        expect(localStorage.getItem('prism-aac-hrr-hologram')).toBeNull();
    });

    it('persists after 5s debounce', () => {
        mod.recordPhrase('hello world');
        vi.advanceTimersByTime(5_001);
        const stored = localStorage.getItem('prism-aac-hrr-hologram');
        expect(stored).not.toBeNull();
        expect(() => JSON.parse(stored!)).not.toThrow();
    });

    it('coalesces rapid writes into one persist', () => {
        // Clear any prior data so we can detect the single write
        localStorage.removeItem('prism-aac-hrr-hologram');
        mod.recordPhrase('a b');
        mod.recordPhrase('c d');
        mod.recordPhrase('e f');
        // Before debounce fires, nothing persisted
        expect(localStorage.getItem('prism-aac-hrr-hologram')).toBeNull();
        vi.advanceTimersByTime(5_001);
        // After debounce, exactly one write
        expect(localStorage.getItem('prism-aac-hrr-hologram')).not.toBeNull();
        const data = JSON.parse(localStorage.getItem('prism-aac-hrr-hologram')!);
        expect(Array.isArray(data)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// 6. Edge cases
// ═══════════════════════════════════════════════════════════════

describe('edge cases', () => {
    beforeEach(async () => {
        await mod.initAacHrr();
        encodeSpy.mockClear();
    });

    it('extra whitespace collapses to clean tokens', () => {
        mod.recordPhrase('  I   want   water  ');
        expect(encodeSpy).toHaveBeenCalledWith('w:i', 'want');
        expect(encodeSpy).toHaveBeenCalledWith('w:want', 'water');
    });

    it('very long phrase (50 words) — no crash, correct count', () => {
        const long = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
        mod.recordPhrase(long);
        // 1 phrase + 49 bigrams + 48 trigrams = 98
        expect(encodeSpy).toHaveBeenCalledTimes(98);
    });

    it('repeated words ("go go go")', () => {
        mod.recordPhrase('go go go');
        // Bigrams: w:go → go (×2), Trigram: w:go go → go (×1), Phrase: 1
        expect(encodeSpy).toHaveBeenCalledTimes(4);
    });

    it('punctuation preserved in words', () => {
        mod.recordPhrase("it's a dog!");
        expect(encodeSpy).toHaveBeenCalledWith("w:it's", 'a');
    });

    it('rapid fire: 100 encodes without crash', () => {
        for (let i = 0; i < 100; i++) {
            mod.recordPhrase(`word${i} word${i + 1}`);
        }
        expect(encodeSpy.mock.calls.length).toBeGreaterThan(100);
    });
});

// ═══════════════════════════════════════════════════════════════
// 7. N-gram exactness
// ═══════════════════════════════════════════════════════════════

describe('n-gram encoding exactness', () => {
    beforeEach(async () => {
        await mod.initAacHrr();
        encodeSpy.mockClear();
    });

    it('"I want water" — exact encode sequence', () => {
        mod.recordPhrase('I want water');
        const calls = encodeSpy.mock.calls.map(([c, s]: [string, string]) => [c, s]);
        expect(calls).toEqual([
            ['I want water', 'I want water'],  // phrase
            ['w:i', 'want'],                    // bigram 0→1
            ['w:i want', 'water'],              // trigram 0,1→2
            ['w:want', 'water'],                // bigram 1→2
        ]);
    });

    it('"Я хочу пить воду" — Russian n-grams', () => {
        mod.recordPhrase('Я хочу пить воду');
        const calls = encodeSpy.mock.calls.map(([c, s]: [string, string]) => [c, s]);
        expect(calls).toEqual([
            ['Я хочу пить воду', 'Я хочу пить воду'],
            ['w:я', 'хочу'],
            ['w:я хочу', 'пить'],
            ['w:хочу', 'пить'],
            ['w:хочу пить', 'воду'],
            ['w:пить', 'воду'],
        ]);
    });

    it('with context — metadata only on phrase key', () => {
        mod.recordPhrase('help me', { category: 'emergency', tone: 'urgent' });
        const calls = encodeSpy.mock.calls.map(([c, s]: [string, string]) => [c, s]);
        expect(calls).toEqual([
            ['help me|cat:emergency|tone:urgent', 'help me'],
            ['w:help', 'me'],
        ]);
    });
});

// ═══════════════════════════════════════════════════════════════
// 8. End-to-end: record → predict
// ═══════════════════════════════════════════════════════════════

describe('end-to-end: record → predict', () => {
    beforeEach(async () => {
        await mod.initAacHrr();
    });

    it('"I want water" → typing "I" → suggests "want"', () => {
        mod.recordPhrase('I want water');
        const results = mod.getNextWordSuggestions('I');
        expect(results.some(r => r.word === 'want')).toBe(true);
    });

    it('"I want water" → typing "I want" → trigram suggests "water"', () => {
        mod.recordPhrase('I want water');
        const results = mod.getNextWordSuggestions('I want');
        expect(results.some(r => r.word === 'water')).toBe(true);
    });

    it('"more please" → typing "more" → suggests "please"', () => {
        mod.recordPhrase('more please');
        const results = mod.getNextWordSuggestions('more');
        expect(results.some(r => r.word === 'please')).toBe(true);
    });

    it('multiple phrases build cumulative vocabulary', () => {
        mod.recordPhrase('I want water');
        mod.recordPhrase('I need help');
        mod.recordPhrase('more please');

        // "I" should return something (want or need)
        const afterI = mod.getNextWordSuggestions('I');
        expect(afterI.length).toBeGreaterThan(0);

        // "more" → "please"
        const afterMore = mod.getNextWordSuggestions('more');
        expect(afterMore.some(r => r.word === 'please')).toBe(true);
    });

    it('contextual suggestions return phrase-level results', () => {
        mod.recordPhrase('I want water');
        const results = mod.getContextualSuggestions('I want water');
        expect(Array.isArray(results)).toBe(true);
        if (results.length > 0) {
            expect(results[0]).toHaveProperty('phrase');
            expect(results[0]).toHaveProperty('relevance');
            expect(typeof results[0].phrase).toBe('string');
            expect(results[0].relevance).toBeGreaterThan(0);
        }
    });

    it('no suggestions for unrecorded vocabulary', () => {
        mod.recordPhrase('I want water');
        const results = mod.getNextWordSuggestions('xyz');
        // Mock only matches exact keys — "w:xyz" was never encoded
        expect(results).toEqual([]);
    });
});

describe('account and anonymous scope isolation', () => {
    const userA = 'user:a@example.com';
    const userB = 'user:b@example.com';

    it('never retrieves User A phrases from User B or logged-out scope', async () => {
        await mod.initAacHrr(userA);
        mod.recordPhrase('I need mom', { language: 'en', scope: userA });
        await mod.initAacHrr(userB);
        mod.recordPhrase('I need grandma', { language: 'en', scope: userB });
        await mod.initAacHrr('anon:logged-out-tab');

        expect(mod.getNextWordSuggestions('I need', 5, 'en', userA).map((item) => item.word))
            .toContain('mom');
        expect(mod.getNextWordSuggestions('I need', 5, 'en', userB).map((item) => item.word))
            .toContain('grandma');
        expect(mod.getNextWordSuggestions('I need', 5, 'en', userB).map((item) => item.word))
            .not.toContain('mom');
        expect(mod.getNextWordSuggestions('I need', 5, 'en', 'anon:logged-out-tab'))
            .toEqual([]);
    });

    it('persists each signed-in scope separately without a delayed cross-account write', async () => {
        const userAKey = 'prism-aac-hrr-hologram:user%3Aa%40example.com';
        const userBKey = 'prism-aac-hrr-hologram:user%3Ab%40example.com';
        localStorage.removeItem(userAKey);
        localStorage.removeItem(userBKey);

        await mod.initAacHrr(userA);
        mod.recordPhrase('I need mom', { language: 'en', scope: userA });
        await mod.initAacHrr(userB);
        mod.recordPhrase('I need grandma', { language: 'en', scope: userB });
        vi.advanceTimersByTime(5_000);

        expect(localStorage.getItem(userAKey)).not.toBeNull();
        expect(localStorage.getItem(userBKey)).not.toBeNull();
    });

    it('keeps anonymous tab memory ephemeral and isolated from a new tab scope', async () => {
        const firstTab = 'anon:first-tab';
        const secondTab = 'anon:second-tab';
        await mod.initAacHrr(firstTab);
        mod.recordPhrase('I need mom', { language: 'en', scope: firstTab });
        vi.advanceTimersByTime(5_000);
        await mod.initAacHrr(secondTab);

        expect(mod.getNextWordSuggestions('I need', 5, 'en', firstTab).map((item) => item.word))
            .toContain('mom');
        expect(mod.getNextWordSuggestions('I need', 5, 'en', secondTab)).toEqual([]);
        expect(localStorage.getItem('prism-aac-hrr-hologram:anon%3Afirst-tab'))
            .toBeNull();
    });
});
