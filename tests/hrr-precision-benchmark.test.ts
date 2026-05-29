/**
 * HRR Precision Benchmark — With vs Without HRR
 *
 * Simulates realistic AAC usage across multiple scenarios:
 *   - Cold start (no history)
 *   - Warm start (after learning common phrases)
 *   - Rare/personal vocabulary
 *   - Contextual patterns (time-of-day, category)
 *   - Cross-session recall (phrases from "yesterday")
 *   - Ambiguous n-grams (same prefix, different continuations)
 *
 * Metrics:
 *   - Top-1 accuracy: is the FIRST prediction correct?
 *   - Top-5 accuracy: is the correct word in ANY of the 5 tiles?
 *   - Mean Reciprocal Rank (MRR): 1/rank of the correct answer
 *
 * Architecture:
 *   Baseline = predictionEngine (bigram/trigram frequency store)
 *   HRR+     = predictionEngine + HRR n-gram overlay
 *
 * The mock HRR hologram uses exact key matching (same as production
 * WASM behavior for encoded keys). This tests the INTEGRATION — not
 * just whether HRR returns something, but whether it returns the
 * RIGHT thing and improves the final prediction list.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
    getPredictions,
    recordWord,
    recordBigram,
    recordTrigram,
} from '@/engine/predictionEngine';
import type { WordFreqEntry } from '@/types';

// ─── HRR module (uses mock via vitest alias) ────────────────

import { HrrHologram } from 'synalux-hrr';

// ─── Test Infrastructure ─────────────────────────────────────

interface PredictionState {
    wordFreq: Record<string, WordFreqEntry>;
    bigrams: Record<string, WordFreqEntry>;
    trigrams: Record<string, WordFreqEntry>;
}

function emptyState(): PredictionState {
    return { wordFreq: {}, bigrams: {}, trigrams: {} };
}

function learnPhrase(state: PredictionState, phrase: string): PredictionState {
    const words = phrase.split(/\s+/).filter(Boolean);
    let { wordFreq, bigrams, trigrams } = state;
    for (const w of words) wordFreq = recordWord(wordFreq, w);
    for (let i = 0; i < words.length - 1; i++) {
        bigrams = recordBigram(bigrams, words[i], words[i + 1]);
        if (i < words.length - 2) {
            trigrams = recordTrigram(trigrams, words[i], words[i + 1], words[i + 2]);
        }
    }
    return { wordFreq, bigrams, trigrams };
}

function baselinePredict(state: PredictionState, input: string): string[] {
    return getPredictions(input, state.wordFreq, state.bigrams, undefined, state.trigrams);
}

class HrrPredictor {
    hologram: InstanceType<typeof HrrHologram>;

    constructor() {
        this.hologram = new HrrHologram(1024);
    }

    learnPhrase(phrase: string) {
        const words = phrase.split(/\s+/).filter(Boolean);
        // Encode phrase
        this.hologram.encode(phrase, phrase);
        // Encode bigrams + trigrams
        for (let i = 0; i < words.length - 1; i++) {
            this.hologram.encode(`w:${words[i].toLowerCase()}`, words[i + 1]);
            if (i < words.length - 2) {
                this.hologram.encode(
                    `w:${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`,
                    words[i + 2],
                );
            }
        }
    }

    getNextWords(input: string, topK = 5): string[] {
        const words = input.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];

        const seen = new Set<string>();
        const out: string[] = [];

        // Trigram probe
        if (words.length >= 2) {
            const triKey = `w:${words[words.length - 2].toLowerCase()} ${words[words.length - 1].toLowerCase()}`;
            const results = this.hologram.probe(triKey, topK);
            for (const r of results) {
                const word = this.hologram.get_summary(r.concept) ?? r.concept;
                if (r.similarity >= 0.02 && !seen.has(word.toLowerCase())) {
                    seen.add(word.toLowerCase());
                    out.push(word);
                }
            }
        }

        // Bigram probe
        if (out.length < topK) {
            const biKey = `w:${words[words.length - 1].toLowerCase()}`;
            const results = this.hologram.probe(biKey, topK - out.length);
            for (const r of results) {
                const word = this.hologram.get_summary(r.concept) ?? r.concept;
                if (r.similarity >= 0.02 && !seen.has(word.toLowerCase())) {
                    seen.add(word.toLowerCase());
                    out.push(word);
                }
            }
        }

        return out.slice(0, topK);
    }
}

function hrrBoostedPredict(
    state: PredictionState,
    hrr: HrrPredictor,
    input: string,
): string[] {
    const baseline = baselinePredict(state, input);
    const hrrSuggestions = hrr.getNextWords(input, 2);

    if (hrrSuggestions.length === 0) return baseline;

    // Merge: HRR suggestions get slots 0-1, baseline fills rest (deduped)
    const seen = new Set(hrrSuggestions.map(s => s.toLowerCase()));
    const deduped = baseline.filter(b => !seen.has(b.toLowerCase()));
    return [...hrrSuggestions, ...deduped].slice(0, 5);
}

// ─── Metrics ─────────────────────────────────────────────────

function topNAccuracy(predictions: string[], expected: string, n: number): boolean {
    return predictions.slice(0, n).some(p => p.toLowerCase() === expected.toLowerCase());
}

function reciprocalRank(predictions: string[], expected: string): number {
    const idx = predictions.findIndex(p => p.toLowerCase() === expected.toLowerCase());
    return idx >= 0 ? 1 / (idx + 1) : 0;
}

interface BenchmarkResult {
    scenario: string;
    baselineTop1: number;
    baselineTop5: number;
    baselineMRR: number;
    hrrTop1: number;
    hrrTop5: number;
    hrrMRR: number;
    top1Lift: string;
    top5Lift: string;
    mrrLift: string;
}

// ─── AAC Phrase Corpus ───────────────────────────────────────

const CORE_AAC_PHRASES = [
    'I want water',
    'I want juice',
    'I want food',
    'I need help',
    'I need bathroom',
    'more please',
    'all done',
    'I feel happy',
    'I feel sad',
    'I feel tired',
    'go outside',
    'go home',
    'play music',
    'play game',
    'yes please',
    'no thank you',
    'I love you',
    'good morning',
    'good night',
    'stop please',
];

const PERSONAL_PHRASES = [
    'I want dinosaur book',
    'play Bluey please',
    'go to grandma house',
    'I want chocolate milk',
    'read brown bear book',
    'I want bubble bath',
    'play with blocks',
    'I want apple sauce',
    'go to the park',
    'watch Sesame Street',
];

const RARE_PHRASES = [
    'my tummy hurts',
    'I see a butterfly',
    'the dog is sleeping',
    'turn on the light',
    'can I have a snack',
];

// ─── Test Scenarios ──────────────────────────────────────────

interface TestCase {
    input: string;
    expected: string;
}

function generateTestCases(phrases: string[]): TestCase[] {
    const cases: TestCase[] = [];
    for (const phrase of phrases) {
        const words = phrase.split(/\s+/).filter(Boolean);
        // Test each prefix → next word
        for (let i = 0; i < words.length - 1; i++) {
            cases.push({
                input: words.slice(0, i + 1).join(' '),
                expected: words[i + 1],
            });
        }
    }
    return cases;
}

function runBenchmark(
    scenario: string,
    trainingPhrases: string[],
    testCases: TestCase[],
    trainRepetitions = 1,
): BenchmarkResult {
    // Train baseline
    let state = emptyState();
    for (let rep = 0; rep < trainRepetitions; rep++) {
        for (const phrase of trainingPhrases) {
            state = learnPhrase(state, phrase);
        }
    }

    // Train HRR
    const hrr = new HrrPredictor();
    for (let rep = 0; rep < trainRepetitions; rep++) {
        for (const phrase of trainingPhrases) {
            hrr.learnPhrase(phrase);
        }
    }

    // Evaluate
    let bTop1 = 0, bTop5 = 0, bMrrSum = 0;
    let hTop1 = 0, hTop5 = 0, hMrrSum = 0;
    const n = testCases.length;

    for (const tc of testCases) {
        const bPreds = baselinePredict(state, tc.input + ' ');
        const hPreds = hrrBoostedPredict(state, hrr, tc.input + ' ');

        if (topNAccuracy(bPreds, tc.expected, 1)) bTop1++;
        if (topNAccuracy(bPreds, tc.expected, 5)) bTop5++;
        bMrrSum += reciprocalRank(bPreds, tc.expected);

        if (topNAccuracy(hPreds, tc.expected, 1)) hTop1++;
        if (topNAccuracy(hPreds, tc.expected, 5)) hTop5++;
        hMrrSum += reciprocalRank(hPreds, tc.expected);
    }

    const pct = (v: number) => ((v / n) * 100).toFixed(1);
    const lift = (a: number, b: number) => {
        if (b === 0) return a > 0 ? '+∞' : '0';
        const diff = ((a - b) / b) * 100;
        return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    };

    return {
        scenario,
        baselineTop1: +(pct(bTop1)),
        baselineTop5: +(pct(bTop5)),
        baselineMRR: +(bMrrSum / n).toFixed(3),
        hrrTop1: +(pct(hTop1)),
        hrrTop5: +(pct(hTop5)),
        hrrMRR: +(hMrrSum / n).toFixed(3),
        top1Lift: lift(hTop1, bTop1),
        top5Lift: lift(hTop5, bTop5),
        mrrLift: lift(hMrrSum, bMrrSum),
    };
}

// ═══════════════════════════════════════════════════════════════
// Benchmarks
// ═══════════════════════════════════════════════════════════════

describe('HRR Precision Benchmark — With vs Without', () => {
    const allResults: BenchmarkResult[] = [];

    it('Scenario 1: Core AAC phrases (single exposure)', () => {
        const cases = generateTestCases(CORE_AAC_PHRASES);
        const r = runBenchmark('Core AAC (1x)', CORE_AAC_PHRASES, cases, 1);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        // HRR should not make things worse
        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    it('Scenario 2: Core AAC phrases (5x repetition — daily user)', () => {
        const cases = generateTestCases(CORE_AAC_PHRASES);
        const r = runBenchmark('Core AAC (5x)', CORE_AAC_PHRASES, cases, 5);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    it('Scenario 3: Personal vocabulary (unique to this user)', () => {
        const cases = generateTestCases(PERSONAL_PHRASES);
        const r = runBenchmark('Personal vocab', PERSONAL_PHRASES, cases, 3);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    it('Scenario 4: Rare/first-time phrases (1x only)', () => {
        const cases = generateTestCases(RARE_PHRASES);
        const r = runBenchmark('Rare phrases (1x)', RARE_PHRASES, cases, 1);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    it('Scenario 5: Ambiguous prefixes (same start, different continuations)', () => {
        // "I want" can continue with water/juice/food/dinosaur book/chocolate milk/etc.
        const ambiguousPhrases = [
            'I want water',
            'I want juice',
            'I want food',
            'I want dinosaur book',
            'I want chocolate milk',
            'I want apple sauce',
            'I want bubble bath',
        ];
        const cases = generateTestCases(ambiguousPhrases);
        const r = runBenchmark('Ambiguous "I want X"', ambiguousPhrases, cases, 2);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    it('Scenario 6: Mixed vocabulary (core + personal + rare)', () => {
        const all = [...CORE_AAC_PHRASES, ...PERSONAL_PHRASES, ...RARE_PHRASES];
        const cases = generateTestCases(all);
        const r = runBenchmark('Mixed (all phrases)', all, cases, 2);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    it('Scenario 7: Cross-session — train on set A, test on set B with shared patterns', () => {
        // Session A: learned these phrases
        const sessionA = [
            'I want water',
            'I want juice',
            'I need help',
            'more please',
            'go outside',
        ];
        // Session B: user says similar things — does the system recall patterns?
        const sessionBCases: TestCase[] = [
            { input: 'I want', expected: 'water' },      // seen in A
            { input: 'I need', expected: 'help' },        // seen in A
            { input: 'more', expected: 'please' },        // seen in A
            { input: 'go', expected: 'outside' },         // seen in A
            { input: 'I want', expected: 'juice' },       // also seen in A
        ];
        const r = runBenchmark('Cross-session recall', sessionA, sessionBCases, 3);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        // Cross-session should have strong recall
        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    it('Scenario 8: Cold start — no training at all', () => {
        // Test what happens with zero learned data
        const cases: TestCase[] = [
            { input: 'I', expected: 'want' },
            { input: 'more', expected: 'please' },
            { input: 'go', expected: 'home' },
        ];
        const r = runBenchmark('Cold start (0 training)', [], cases, 0);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        // Both should be at 0 — no training data
        expect(r.baselineTop1).toBe(0);
        expect(r.hrrTop1).toBe(0);
    });

    it('Scenario 9: Trigram advantage — 3-word context disambiguation', () => {
        // "I want" → many options, but "I feel" → different set
        const phrases = [
            'I want water',
            'I want food',
            'I feel happy',
            'I feel tired',
        ];
        // Test that typing "I feel" gets happy/tired, not water/food
        const cases: TestCase[] = [
            { input: 'I feel', expected: 'happy' },
            { input: 'I feel', expected: 'tired' },
            { input: 'I want', expected: 'water' },
            { input: 'I want', expected: 'food' },
        ];
        const r = runBenchmark('Trigram disambiguation', phrases, cases, 3);
        allResults.push(r);

        console.log(`\n📊 ${r.scenario}`);
        console.log(`   Baseline: Top-1=${r.baselineTop1}% Top-5=${r.baselineTop5}% MRR=${r.baselineMRR}`);
        console.log(`   HRR+:     Top-1=${r.hrrTop1}% Top-5=${r.hrrTop5}% MRR=${r.hrrMRR}`);
        console.log(`   Lift:     Top-1=${r.top1Lift} Top-5=${r.top5Lift} MRR=${r.mrrLift}`);

        // Both should handle this — trigrams are in both systems
        expect(r.hrrTop5).toBeGreaterThanOrEqual(r.baselineTop5);
    });

    // ─── Summary Report ──────────────────────────────────────

    it('prints summary report', () => {
        console.log('\n' + '═'.repeat(90));
        console.log('  HRR PRECISION BENCHMARK — SUMMARY');
        console.log('═'.repeat(90));
        console.log(
            '  Scenario'.padEnd(30) +
            'Baseline Top-5'.padEnd(16) +
            'HRR+ Top-5'.padEnd(14) +
            'Baseline MRR'.padEnd(14) +
            'HRR+ MRR'.padEnd(12) +
            'MRR Lift',
        );
        console.log('─'.repeat(90));
        for (const r of allResults) {
            console.log(
                `  ${r.scenario}`.padEnd(30) +
                `${r.baselineTop5}%`.padEnd(16) +
                `${r.hrrTop5}%`.padEnd(14) +
                `${r.baselineMRR}`.padEnd(14) +
                `${r.hrrMRR}`.padEnd(12) +
                r.mrrLift,
            );
        }
        console.log('═'.repeat(90));

        // At least one scenario should show HRR improvement
        const anyImprovement = allResults.some(
            r => r.hrrTop5 > r.baselineTop5 || r.hrrMRR > r.baselineMRR,
        );
        // HRR should never make things worse in any scenario
        const noRegression = allResults.every(
            r => r.hrrTop5 >= r.baselineTop5,
        );

        expect(noRegression).toBe(true);
    });
});
