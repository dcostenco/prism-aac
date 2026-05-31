/**
 * Model registry and cascade logic tests.
 *
 * Verifies the ground-truth MODEL_REGISTRY (synced from HuggingFace),
 * SIDELOAD_ORDER (largest-first cascade), RAM gating thresholds, and
 * the model-selection algorithm that picks the best model for a given
 * amount of free RAM.
 *
 * The selection function is defined here because aiService inlines the
 * logic rather than exporting a pure function.  The algorithm matches
 * production behavior: walk SIDELOAD_ORDER (32b -> 1b7), skip entries
 * with minFreeMB === 0 (server-only tiers like 32b), return the first
 * model whose minFreeMB <= availableFreeMB.
 */
import { describe, it, expect } from 'vitest';
import {
  MODEL_REGISTRY,
  SIDELOAD_ORDER,
  type ModelId,
  type ModelSpec,
} from '@/constants/modelRegistry';

// ── helper: model selection by available RAM ─────────────────────────────────

/**
 * Pick the best model that fits in the available free RAM on an iOS device.
 *
 * Rules:
 *   1. Walk SIDELOAD_ORDER (largest first).
 *   2. Skip models with minFreeMB === 0 (not meant for on-device use, e.g. 32b).
 *   3. Return the first model whose minFreeMB <= freeMB.
 *   4. Return null if nothing fits.
 */
function pickModelForRAM(freeMB: number): ModelId | null {
  for (const id of SIDELOAD_ORDER) {
    const spec = MODEL_REGISTRY[id];
    if (spec.minFreeMB === 0) continue; // server-only tier
    if (freeMB >= spec.minFreeMB) return id;
  }
  return null;
}

// ── 1. MODEL_REGISTRY completeness ──────────────────────────────────────────

describe('MODEL_REGISTRY completeness', () => {
  const EXPECTED_TIERS: ModelId[] = ['1b7', '4b', '8b', '14b', '32b'];
  const allIds = Object.keys(MODEL_REGISTRY) as ModelId[];

  it('contains exactly the 5 expected tiers', () => {
    expect(allIds.sort()).toEqual([...EXPECTED_TIERS].sort());
  });

  for (const tier of EXPECTED_TIERS) {
    describe(`tier "${tier}"`, () => {
      const spec: ModelSpec = MODEL_REGISTRY[tier];

      it('has a non-empty ollamaTag', () => {
        expect(spec.ollamaTag).toBeTruthy();
        expect(typeof spec.ollamaTag).toBe('string');
      });

      it('has a non-empty hfRepo', () => {
        expect(spec.hfRepo).toBeTruthy();
        expect(spec.hfRepo).toContain('dcostenco/prism-coder');
      });

      it('has a non-empty version string', () => {
        expect(spec.version).toBeTruthy();
        expect(spec.version).toMatch(/^v\d+$/);
      });

      it('has accuracy between 0 and 100 (inclusive)', () => {
        expect(spec.accuracy).toBeGreaterThanOrEqual(0);
        expect(spec.accuracy).toBeLessThanOrEqual(100);
      });

      it('has a positive sizeGB', () => {
        expect(spec.sizeGB).toBeGreaterThan(0);
      });

      it('has minFreeMB as a non-negative number', () => {
        expect(spec.minFreeMB).toBeGreaterThanOrEqual(0);
        expect(typeof spec.minFreeMB).toBe('number');
      });

      it('has a non-empty role description', () => {
        expect(spec.role).toBeTruthy();
        expect(typeof spec.role).toBe('string');
      });
    });
  }
});

// ── 2. SIDELOAD_ORDER ───────────────────────────────────────────────────────

describe('SIDELOAD_ORDER', () => {
  it('is ordered largest first: 32b -> 14b -> 8b -> 4b -> 1b7', () => {
    expect(SIDELOAD_ORDER).toEqual(['32b', '14b', '8b', '4b', '1b7']);
  });

  it('every entry exists in MODEL_REGISTRY', () => {
    for (const id of SIDELOAD_ORDER) {
      expect(MODEL_REGISTRY).toHaveProperty(id);
    }
  });

  it('covers all registry entries (no orphaned models)', () => {
    const registryIds = Object.keys(MODEL_REGISTRY).sort();
    const sideloadIds = [...SIDELOAD_ORDER].sort();
    expect(sideloadIds).toEqual(registryIds);
  });

  it('sizeGB values decrease along the order', () => {
    for (let i = 0; i < SIDELOAD_ORDER.length - 1; i++) {
      const current = MODEL_REGISTRY[SIDELOAD_ORDER[i]].sizeGB;
      const next = MODEL_REGISTRY[SIDELOAD_ORDER[i + 1]].sizeGB;
      expect(current).toBeGreaterThan(next);
    }
  });
});

// ── 3. RAM gating thresholds ────────────────────────────────────────────────

describe('RAM gating thresholds', () => {
  // Only consider iOS-eligible models (minFreeMB > 0)
  const iosEligible = SIDELOAD_ORDER.filter(
    id => MODEL_REGISTRY[id].minFreeMB > 0,
  );

  it('iOS-eligible tiers have minFreeMB > 0', () => {
    for (const id of iosEligible) {
      expect(MODEL_REGISTRY[id].minFreeMB).toBeGreaterThan(0);
    }
  });

  it('minFreeMB thresholds decrease monotonically among iOS tiers (larger model = higher threshold)', () => {
    // iosEligible is in SIDELOAD_ORDER (largest first), so minFreeMB should decrease
    for (let i = 0; i < iosEligible.length - 1; i++) {
      const current = MODEL_REGISTRY[iosEligible[i]].minFreeMB;
      const next = MODEL_REGISTRY[iosEligible[i + 1]].minFreeMB;
      expect(current).toBeGreaterThan(next);
    }
  });

  it('1b7 has the lowest minFreeMB threshold (fits on any device)', () => {
    const thresholds = iosEligible.map(id => MODEL_REGISTRY[id].minFreeMB);
    const min = Math.min(...thresholds);
    expect(MODEL_REGISTRY['1b7'].minFreeMB).toBe(min);
  });

  it('14b has the highest iOS-eligible minFreeMB threshold', () => {
    const thresholds = iosEligible.map(id => MODEL_REGISTRY[id].minFreeMB);
    const max = Math.max(...thresholds);
    expect(MODEL_REGISTRY['14b'].minFreeMB).toBe(max);
  });

  it('32b has minFreeMB === 0 (server-only, no iOS GGUF)', () => {
    expect(MODEL_REGISTRY['32b'].minFreeMB).toBe(0);
    expect(MODEL_REGISTRY['32b'].iosFile).toBe('');
  });

  it('every iOS-eligible model has a non-empty iosFile', () => {
    for (const id of iosEligible) {
      expect(MODEL_REGISTRY[id].iosFile).toBeTruthy();
    }
  });
});

// ── 4. Model selection logic (pickModelForRAM) ──────────────────────────────

describe('pickModelForRAM — model selection by available RAM', () => {
  it('16 GB free -> picks 14b (highest iOS-eligible tier)', () => {
    expect(pickModelForRAM(16_000)).toBe('14b');
  });

  it('10 GB free -> picks 14b (exactly at threshold)', () => {
    expect(pickModelForRAM(10_000)).toBe('14b');
  });

  it('9.9 GB free -> picks 8b (just below 14b threshold)', () => {
    expect(pickModelForRAM(9_999)).toBe('8b');
  });

  it('5 GB free -> picks 8b', () => {
    expect(pickModelForRAM(5_000)).toBe('8b');
  });

  it('4.5 GB free -> picks 8b (exactly at threshold)', () => {
    expect(pickModelForRAM(4_500)).toBe('8b');
  });

  it('4.4 GB free -> picks 4b (just below 8b threshold)', () => {
    expect(pickModelForRAM(4_499)).toBe('4b');
  });

  it('3 GB free -> picks 4b', () => {
    expect(pickModelForRAM(3_000)).toBe('4b');
  });

  it('2.8 GB free -> picks 4b (exactly at threshold)', () => {
    expect(pickModelForRAM(2_800)).toBe('4b');
  });

  it('2 GB free -> picks 1b7', () => {
    expect(pickModelForRAM(2_000)).toBe('1b7');
  });

  it('1.2 GB free -> picks 1b7 (exactly at threshold)', () => {
    expect(pickModelForRAM(1_200)).toBe('1b7');
  });

  it('1 GB free -> returns null (below 1b7 threshold)', () => {
    expect(pickModelForRAM(1_000)).toBeNull();
  });

  it('0.5 GB free -> returns null (no model fits)', () => {
    expect(pickModelForRAM(500)).toBeNull();
  });

  it('0 MB free -> returns null', () => {
    expect(pickModelForRAM(0)).toBeNull();
  });

  it('never selects 32b (server-only tier with minFreeMB === 0)', () => {
    // Even with 100 GB free, 32b is skipped because minFreeMB === 0
    // means it has no iOS GGUF and is not intended for on-device use
    const result = pickModelForRAM(100_000);
    expect(result).toBe('14b');
    expect(result).not.toBe('32b');
  });

  it('selected model accuracy is always >= 96%', () => {
    // Every selectable model in the registry has high accuracy
    const testCases = [16_000, 10_000, 5_000, 3_000, 1_200];
    for (const freeMB of testCases) {
      const id = pickModelForRAM(freeMB);
      expect(id).not.toBeNull();
      expect(MODEL_REGISTRY[id!].accuracy).toBeGreaterThanOrEqual(96);
    }
  });
});
