/**
 * phraseUsageStore — spreading-activation usage tracking
 *
 * Covers: initial state, recordUse adds timestamp, invalid phraseId ignored,
 * MAX_PHRASE_IDS (5000) evicts oldest entry, clearAll resets all usage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// recordPhraseUse is the actual impl — mock it to stay pure-store tests
vi.mock('@/services/aacPhraseRanking', () => ({
  recordPhraseUse: vi.fn((prev: Record<string, { timestamps: number[] }>, phraseId: string) => {
    const existing = prev[phraseId] ?? { timestamps: [] };
    return {
      ...prev,
      [phraseId]: { timestamps: [...existing.timestamps, Date.now()] },
    };
  }),
}));

// safeJSONStorage can just be identity for tests
vi.mock('@/lib/safeStorage', () => ({
  safeJSONStorage: vi.fn(() => ({
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })),
}));

const { usePhraseUsageStore } = await import('@/store/phraseUsageStore');

beforeEach(() => {
  usePhraseUsageStore.setState({ usage: {} });
  vi.clearAllMocks();
});

// ── initial state ──────────────────────────────────────────────────────────────

describe('phraseUsageStore — initial state', () => {
  it('usage is empty object', () => {
    expect(usePhraseUsageStore.getState().usage).toEqual({});
  });
});

// ── recordUse ─────────────────────────────────────────────────────────────────

describe('phraseUsageStore — recordUse', () => {
  it('adds a new phrase entry', () => {
    usePhraseUsageStore.getState().recordUse('phrase-1');
    expect(usePhraseUsageStore.getState().usage['phrase-1']).toBeDefined();
    expect(usePhraseUsageStore.getState().usage['phrase-1'].timestamps.length).toBe(1);
  });

  it('adds second timestamp on second call for same phraseId', () => {
    usePhraseUsageStore.getState().recordUse('phrase-2');
    usePhraseUsageStore.getState().recordUse('phrase-2');
    expect(usePhraseUsageStore.getState().usage['phrase-2'].timestamps.length).toBe(2);
  });

  it('ignores empty string phraseId', () => {
    usePhraseUsageStore.getState().recordUse('');
    expect(Object.keys(usePhraseUsageStore.getState().usage).length).toBe(0);
  });

  it('ignores null phraseId', () => {
    usePhraseUsageStore.getState().recordUse(null as unknown as string);
    expect(Object.keys(usePhraseUsageStore.getState().usage).length).toBe(0);
  });

  it('ignores numeric phraseId', () => {
    usePhraseUsageStore.getState().recordUse(42 as unknown as string);
    expect(Object.keys(usePhraseUsageStore.getState().usage).length).toBe(0);
  });

  it('multiple different phraseIds are stored independently', () => {
    usePhraseUsageStore.getState().recordUse('a');
    usePhraseUsageStore.getState().recordUse('b');
    usePhraseUsageStore.getState().recordUse('c');
    expect(Object.keys(usePhraseUsageStore.getState().usage).length).toBe(3);
  });
});

// ── MAX_PHRASE_IDS eviction ────────────────────────────────────────────────────

describe('phraseUsageStore — MAX_PHRASE_IDS cap (5000)', () => {
  it('evicts oldest entry when at capacity', () => {
    // Fill exactly 5000 entries with distinct fake oldest timestamps
    const bigUsage: Record<string, { timestamps: number[] }> = {};
    for (let i = 0; i < 5000; i++) {
      bigUsage[`old-${i}`] = { timestamps: [i + 1] }; // timestamps 1..5000
    }
    usePhraseUsageStore.setState({ usage: bigUsage });

    // Add 1 more — should evict the entry with oldest last timestamp (old-0, ts=1)
    usePhraseUsageStore.getState().recordUse('new-phrase');

    const updated = usePhraseUsageStore.getState().usage;
    // Total should still be 5000 (evicted one, added one)
    expect(Object.keys(updated).length).toBe(5000);
    // new-phrase must be present
    expect(updated['new-phrase']).toBeDefined();
    // old-0 (oldest) must be evicted
    expect(updated['old-0']).toBeUndefined();
  });
});

// ── clearAll ──────────────────────────────────────────────────────────────────

describe('phraseUsageStore — clearAll', () => {
  it('removes all entries', () => {
    usePhraseUsageStore.getState().recordUse('phrase-a');
    usePhraseUsageStore.getState().recordUse('phrase-b');
    usePhraseUsageStore.getState().clearAll();
    expect(usePhraseUsageStore.getState().usage).toEqual({});
  });
});
