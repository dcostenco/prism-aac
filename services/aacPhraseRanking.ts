/**
 * AAC phrase ranking via Prism v14.0.0 ACT-R activation.
 *
 * Replaces the static `sortOrder` ranking with one that adapts to the
 * specific user: phrases said today rise; phrases unused for a year
 * fade. Pure port of hooks/core/decay.py with the lesson-rate
 * d=0.25 default that the v14.0.0 algorithm-stability contract pins.
 *
 * Cited constants (synced with hooks/core/decay.py):
 *   ACT_R_DEFAULT_DECAY      = 0.5         (actrActivation.ts:38)
 *   ROLLUP_DECAY_MULTIPLIER  = 0.5         (graphHandlers.ts:553)
 *   PRISM_GRAPH_PRUNE_MIN_STRENGTH = 0.15  (config.ts:317)
 *   DEFAULT_SIGMOID_MIDPOINT = -2.0        (actrActivation.ts:51)
 *   DEFAULT_SIGMOID_STEEPNESS = 1.0        (actrActivation.ts:54)
 *
 * Effective lesson-rate decay for AAC phrases (d = 0.25):
 *   1 day after use   → activation ≈ 0.56
 *   1 month after use → activation ≈ 0.30
 *   1 year after use  → activation ≈ 0.23 (still above prune threshold)
 *   5 years after use → activation ≈ 0.15 (at prune threshold)
 */
import { Phrase } from '@/types';

// ── Cited Prism constants ─────────────────────────────────────────

export const ACT_R_DEFAULT_DECAY = 0.5;
export const ROLLUP_DECAY_MULTIPLIER = 0.5;
export const PRISM_GRAPH_PRUNE_MIN_STRENGTH = 0.15;
export const SIGMOID_MIDPOINT = -2.0;
export const SIGMOID_STEEPNESS = 1.0;
export const ACTIVATION_FLOOR = -10.0;
export const MIN_TIME_DELTA_SECONDS = 1.0;


// ── Pure functions (port of core/decay.py) ───────────────────────

export function baseLevelActivation(
  citationTimestamps: number[],  // unix epoch seconds
  nowSec: number,
  decayRate: number = ACT_R_DEFAULT_DECAY,
): number {
  if (citationTimestamps.length === 0) return ACTIVATION_FLOOR;
  let total = 0;
  for (const ts of citationTimestamps) {
    const delta = Math.max(MIN_TIME_DELTA_SECONDS, nowSec - ts);
    total += Math.pow(delta, -decayRate);
  }
  if (total <= 0) return ACTIVATION_FLOOR;
  return Math.log(total);
}

export function parameterizedSigmoid(
  x: number,
  midpoint: number = SIGMOID_MIDPOINT,
  steepness: number = SIGMOID_STEEPNESS,
): number {
  if (!Number.isFinite(x)) return x > 0 ? 1.0 : 0.0;
  const exponent = -steepness * (x - midpoint);
  if (exponent > 500) return 0;
  if (exponent < -500) return 1;
  return 1.0 / (1.0 + Math.exp(exponent));
}

/**
 * Lesson-rate activation for AAC phrases. Uses d = 0.25 (rollup rate)
 * because phrases the user actually says are long-term lessons, not
 * raw episodic chatter. Matches the gotcha decay rate in the v14.0.0
 * audit hooks gate.
 */
export function lessonActivation(
  citationTimestamps: number[],
  nowSec: number,
  isRollup = false,
): number {
  const baseDecay = ACT_R_DEFAULT_DECAY * ROLLUP_DECAY_MULTIPLIER;  // 0.25
  const decay = isRollup ? baseDecay * ROLLUP_DECAY_MULTIPLIER : baseDecay;
  const raw = baseLevelActivation(citationTimestamps, nowSec, decay);
  return parameterizedSigmoid(raw);
}


// ── Per-phrase usage shape ───────────────────────────────────────

export interface PhraseUsage {
  /** Recent unix-timestamp citations. Bounded to last N to keep memory cheap. */
  timestamps: number[];
}

/** Hard cap on remembered timestamps per phrase. After this many, oldest
 *  drop. ACT-R activation saturates well before this — older citations
 *  contribute t^(-d) ≈ 0 anyway. */
const MAX_TIMESTAMPS_PER_PHRASE = 50;


// ── Ranking ──────────────────────────────────────────────────────

export interface RankedPhrase {
  phrase: Phrase;
  /** Normalized activation in [0, 1]. */
  activation: number;
  /** Final composite score the UI sorts by (descending). */
  score: number;
}

export interface RankPhraseOptions {
  /** Per-phrase usage map. Phrases not in the map default to no history. */
  usage: Record<string, PhraseUsage>;
  /** Current time, injected for testability. */
  nowSec?: number;
  /** Static-sort weight (anchors the original sortOrder). 0..1. Default 0.3. */
  staticWeight?: number;
  /** Activation weight. 0..1. Default 0.7. */
  activationWeight?: number;
  /** When true, drop phrases below the prune threshold. Default false
   *  (we never hide a phrase from a child — they may still need it). */
  hideStale?: boolean;
}

/**
 * Rank a category's phrases by usage-aware activation.
 *
 * Score formula (mirrors spreadingActivation.ts:128 hybrid blend):
 *   score = staticWeight × normalizedSortOrder + activationWeight × activation
 *
 * Where normalizedSortOrder = 1 - (sortOrder / N) so lower sortOrder ranks
 * higher (matches original behavior when usage is empty).
 *
 * No-history phrases get the static rank only — new phrases don't get
 * starved by older phrases with usage. Phrases below PRUNE_MIN_STRENGTH
 * activation can optionally be hidden, but default is to keep them
 * visible — child needs full vocabulary access.
 */
export function rankPhrases(
  phrases: Phrase[],
  options: RankPhraseOptions,
): RankedPhrase[] {
  const {
    usage,
    nowSec = Math.floor(Date.now() / 1000),
    staticWeight = 0.3,
    activationWeight = 0.7,
    hideStale = false,
  } = options;
  if (phrases.length === 0) return [];

  // Normalize sortOrder to [0, 1]: smallest sortOrder → 1, largest → 0
  const sorted = [...phrases].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortOrderRank = new Map<string, number>();
  sorted.forEach((p, i) => {
    sortOrderRank.set(p.id, 1 - i / Math.max(1, sorted.length - 1));
  });

  const ranked: RankedPhrase[] = phrases.map((phrase) => {
    const u = usage[phrase.id];
    const timestamps = u?.timestamps ?? [];
    const activation = lessonActivation(timestamps, nowSec);
    const normSort = sortOrderRank.get(phrase.id) ?? 0;
    const score = staticWeight * normSort + activationWeight * activation;
    return { phrase, activation, score };
  });

  if (hideStale) {
    return ranked
      .filter((r) => r.activation >= PRISM_GRAPH_PRUNE_MIN_STRENGTH)
      .sort((a, b) => b.score - a.score);
  }
  return ranked.sort((a, b) => b.score - a.score);
}


// ── Helper for tracking new usage ────────────────────────────────

export function recordPhraseUse(
  usage: Record<string, PhraseUsage>,
  phraseId: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Record<string, PhraseUsage> {
  const prev = usage[phraseId]?.timestamps ?? [];
  const next = [...prev, nowSec].slice(-MAX_TIMESTAMPS_PER_PHRASE);
  return { ...usage, [phraseId]: { timestamps: next } };
}
