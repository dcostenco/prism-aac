/**
 * Tests for the v14.0.0 ACT-R port that drives AAC phrase ranking.
 * Critical for a life-safety device: a regression here means a phrase
 * the child needs ("call 911", "I can't breathe") could be ranked below
 * a phrase they last said a year ago.
 */
import { describe, it, expect } from 'vitest';
import {
  baseLevelActivation,
  parameterizedSigmoid,
  lessonActivation,
  rankPhrases,
  recordPhraseUse,
  ACTIVATION_FLOOR,
  PRISM_GRAPH_PRUNE_MIN_STRENGTH,
} from '@/services/aacPhraseRanking';
import { Phrase } from '@/types';

const NOW = 1_700_000_000;
const DAY = 86_400;

const mkPhrase = (id: string, sortOrder: number, text = id): Phrase => ({
  id, categoryId: 'help-needs', text, sortOrder,
});

describe('baseLevelActivation', () => {
  it('returns ACTIVATION_FLOOR for empty history', () => {
    expect(baseLevelActivation([], NOW)).toBe(ACTIVATION_FLOOR);
  });

  it('grows monotonically with citation count', () => {
    const a1 = baseLevelActivation([NOW - 60], NOW);
    const a2 = baseLevelActivation([NOW - 60, NOW - 120], NOW);
    const a3 = baseLevelActivation([NOW - 60, NOW - 120, NOW - 180], NOW);
    expect(a2).toBeGreaterThan(a1);
    expect(a3).toBeGreaterThan(a2);
  });

  it('decays with age — older citations contribute less', () => {
    const recent = baseLevelActivation([NOW - 60], NOW);
    const old = baseLevelActivation([NOW - DAY * 365], NOW);
    expect(recent).toBeGreaterThan(old);
  });

  it('clamps tiny deltas to MIN_TIME_DELTA so log never blows up', () => {
    // delta < 1 second clamped to 1 — t^(-d) = 1 — log(1) = 0
    expect(baseLevelActivation([NOW], NOW)).toBe(0);
    expect(baseLevelActivation([NOW + 100], NOW)).toBe(0);
  });
});

describe('parameterizedSigmoid', () => {
  it('returns 0.5 at the midpoint', () => {
    expect(parameterizedSigmoid(-2.0)).toBeCloseTo(0.5, 5);
  });

  it('saturates at extremes without overflow', () => {
    expect(parameterizedSigmoid(1000)).toBeCloseTo(1, 5);
    expect(parameterizedSigmoid(-1000)).toBeCloseTo(0, 5);
  });

  it('passes Infinity through', () => {
    expect(parameterizedSigmoid(Infinity)).toBe(1);
    expect(parameterizedSigmoid(-Infinity)).toBe(0);
  });
});

describe('lessonActivation', () => {
  it('a phrase used moments ago is highly activated', () => {
    const a = lessonActivation([NOW - 60], NOW);
    expect(a).toBeGreaterThan(0.5);
  });

  it('a phrase used a handful of times over the year stays above prune', () => {
    // Lesson-rate decay (d=0.25) is designed so long-term knowledge
    // doesn't fall off the map. A phrase the user said a few times
    // throughout the year must remain above the prune threshold.
    const ts = [NOW - DAY * 30, NOW - DAY * 90, NOW - DAY * 180, NOW - DAY * 365];
    const a = lessonActivation(ts, NOW);
    expect(a).toBeGreaterThanOrEqual(PRISM_GRAPH_PRUNE_MIN_STRENGTH);
  });

  it('a single citation a year old decays below prune (realistic)', () => {
    // Single citation 1y old falls below 0.15 — the spreading-activation
    // model treats it as a faint trace, not core vocabulary. The default
    // hideStale=false in rankPhrases ensures it stays visible to the
    // child anyway (life-safety override).
    const a = lessonActivation([NOW - DAY * 365], NOW);
    expect(a).toBeLessThan(PRISM_GRAPH_PRUNE_MIN_STRENGTH);
  });

  it('frequent recent use ranks higher than rare recent use', () => {
    const rare = lessonActivation([NOW - 60], NOW);
    const frequent = lessonActivation(
      [NOW - 60, NOW - 120, NOW - 180, NOW - 240, NOW - 300],
      NOW,
    );
    expect(frequent).toBeGreaterThan(rare);
  });
});

describe('rankPhrases', () => {
  const phrases: Phrase[] = [
    mkPhrase('a', 0, 'help'),
    mkPhrase('b', 1, 'water'),
    mkPhrase('c', 2, 'bathroom'),
    mkPhrase('d', 3, 'sick'),
  ];

  it('returns empty array for empty input', () => {
    expect(rankPhrases([], { usage: {} })).toEqual([]);
  });

  it('preserves static sortOrder when no usage history exists', () => {
    const ranked = rankPhrases(phrases, { usage: {}, nowSec: NOW });
    expect(ranked.map((r) => r.phrase.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('floats a recently-used phrase above unused phrases', () => {
    const usage = { c: { timestamps: [NOW - 60, NOW - 120, NOW - 180] } };
    const ranked = rankPhrases(phrases, { usage, nowSec: NOW });
    expect(ranked[0].phrase.id).toBe('c');
  });

  it('a brand-new phrase still appears (never starved by old usage)', () => {
    // Existing phrase 'a' has no usage, fresh phrase 'b' had heavy
    // year-old usage. New phrases must not be invisible.
    const usage = { b: { timestamps: Array(10).fill(NOW - DAY * 365) } };
    const ranked = rankPhrases(phrases, { usage, nowSec: NOW });
    expect(ranked.find((r) => r.phrase.id === 'a')).toBeDefined();
  });

  it('keeps stale phrases visible by default (life-safety)', () => {
    // Default hideStale=false: a child must keep access to all phrases
    // even if they haven't been used in years.
    const usage = { a: { timestamps: [NOW - DAY * 365 * 5] } };
    const ranked = rankPhrases(phrases, { usage, nowSec: NOW });
    expect(ranked).toHaveLength(4);
  });

  it('hideStale=true removes only phrases below prune threshold', () => {
    const usage = {
      a: { timestamps: [NOW - 60] },                  // active
      b: { timestamps: [NOW - DAY * 365 * 100] },     // very old → may prune
    };
    const ranked = rankPhrases(phrases, {
      usage,
      nowSec: NOW,
      hideStale: true,
    });
    // 'a' must always survive
    expect(ranked.find((r) => r.phrase.id === 'a')).toBeDefined();
  });

  it('produces a stable score in [0, 1] regardless of phrase count', () => {
    const usage = { a: { timestamps: [NOW - 60] } };
    const ranked = rankPhrases(phrases, { usage, nowSec: NOW });
    for (const r of ranked) {
      expect(r.activation).toBeGreaterThanOrEqual(0);
      expect(r.activation).toBeLessThanOrEqual(1);
    }
  });
});

describe('recordPhraseUse', () => {
  it('appends a timestamp to a phrase that had no history', () => {
    const next = recordPhraseUse({}, 'help', NOW);
    expect(next.help.timestamps).toEqual([NOW]);
  });

  it('appends to existing history without losing prior timestamps', () => {
    const prev = { help: { timestamps: [NOW - 100] } };
    const next = recordPhraseUse(prev, 'help', NOW);
    expect(next.help.timestamps).toEqual([NOW - 100, NOW]);
  });

  it('caps timestamps at 50 per phrase (oldest evicted)', () => {
    const start = NOW - 100;
    let usage: Record<string, { timestamps: number[] }> = {};
    for (let i = 0; i < 60; i++) {
      usage = recordPhraseUse(usage, 'help', start + i);
    }
    expect(usage.help.timestamps).toHaveLength(50);
    // Oldest 10 evicted — first remaining ts must be start+10.
    expect(usage.help.timestamps[0]).toBe(start + 10);
    expect(usage.help.timestamps[49]).toBe(start + 59);
  });

  it('does not mutate the input map', () => {
    const prev = { help: { timestamps: [NOW - 100] } };
    const snapshot = JSON.parse(JSON.stringify(prev));
    recordPhraseUse(prev, 'help', NOW);
    expect(prev).toEqual(snapshot);
  });
});
