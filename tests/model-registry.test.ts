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
 * production behavior: walk SIDELOAD_ORDER (27b -> 2b), return the
 * first model whose minFreeMB <= availableFreeMB.
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
 * Pick the best model that fits in the available free RAM.
 *
 * Rules:
 *   1. Walk SIDELOAD_ORDER (largest first).
 *   2. Return the first model whose minFreeMB <= freeMB.
 *   3. Return null if nothing fits.
 */
function pickModelForRAM(freeMB: number): ModelId | null {
  for (const id of SIDELOAD_ORDER) {
    const spec = MODEL_REGISTRY[id];
    if (freeMB >= spec.minFreeMB) return id;
  }
  return null;
}

// ── 1. MODEL_REGISTRY completeness ──────────────────────────────────────────

describe('MODEL_REGISTRY completeness', () => {
  const EXPECTED_TIERS: ModelId[] = ['2b', '4b', '9b', '27b'];
  const allIds = Object.keys(MODEL_REGISTRY) as ModelId[];

  it('contains exactly the 4 expected tiers', () => {
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

      it('has minFreeMB as a positive number', () => {
        expect(spec.minFreeMB).toBeGreaterThan(0);
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
  it('is ordered largest first: 27b -> 9b -> 4b -> 2b', () => {
    expect(SIDELOAD_ORDER).toEqual(['27b', '9b', '4b', '2b']);
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
  // iOS-eligible models have a non-empty iosFile
  const iosEligible = SIDELOAD_ORDER.filter(
    id => MODEL_REGISTRY[id].iosFile !== '',
  );

  // Server-only models have an empty iosFile (9b, 27b)
  const serverOnly = SIDELOAD_ORDER.filter(
    id => MODEL_REGISTRY[id].iosFile === '',
  );

  it('all tiers have minFreeMB > 0', () => {
    for (const id of SIDELOAD_ORDER) {
      expect(MODEL_REGISTRY[id].minFreeMB).toBeGreaterThan(0);
    }
  });

  it('minFreeMB thresholds decrease monotonically along SIDELOAD_ORDER (larger model = higher threshold)', () => {
    for (let i = 0; i < SIDELOAD_ORDER.length - 1; i++) {
      const current = MODEL_REGISTRY[SIDELOAD_ORDER[i]].minFreeMB;
      const next = MODEL_REGISTRY[SIDELOAD_ORDER[i + 1]].minFreeMB;
      expect(current).toBeGreaterThan(next);
    }
  });

  it('2b has the lowest minFreeMB threshold (fits on any device)', () => {
    const thresholds = SIDELOAD_ORDER.map(id => MODEL_REGISTRY[id].minFreeMB);
    const min = Math.min(...thresholds);
    expect(MODEL_REGISTRY['2b'].minFreeMB).toBe(min);
  });

  it('27b has the highest minFreeMB threshold', () => {
    const thresholds = SIDELOAD_ORDER.map(id => MODEL_REGISTRY[id].minFreeMB);
    const max = Math.max(...thresholds);
    expect(MODEL_REGISTRY['27b'].minFreeMB).toBe(max);
  });

  it('9b and 27b are server-only (empty iosFile)', () => {
    expect(MODEL_REGISTRY['9b'].iosFile).toBe('');
    expect(MODEL_REGISTRY['27b'].iosFile).toBe('');
  });

  it('iOS-eligible models (2b, 4b) have a non-empty iosFile', () => {
    expect(iosEligible.sort()).toEqual(['2b', '4b']);
    for (const id of iosEligible) {
      expect(MODEL_REGISTRY[id].iosFile).toBeTruthy();
    }
  });

  it('server-only models are 9b and 27b', () => {
    expect(serverOnly.sort()).toEqual(['27b', '9b']);
  });
});

// ── 4. Model selection logic (pickModelForRAM) ──────────────────────────────

describe('pickModelForRAM — model selection by available RAM', () => {
  // Thresholds: 27b=20000, 9b=8000, 4b=5000, 2b=3000

  it('25 GB free -> picks 27b (highest tier)', () => {
    expect(pickModelForRAM(25_000)).toBe('27b');
  });

  it('20 GB free -> picks 27b (exactly at threshold)', () => {
    expect(pickModelForRAM(20_000)).toBe('27b');
  });

  it('19.9 GB free -> picks 9b (just below 27b threshold)', () => {
    expect(pickModelForRAM(19_999)).toBe('9b');
  });

  it('8 GB free -> picks 9b (exactly at threshold)', () => {
    expect(pickModelForRAM(8_000)).toBe('9b');
  });

  it('7.9 GB free -> picks 4b (just below 9b threshold)', () => {
    expect(pickModelForRAM(7_999)).toBe('4b');
  });

  it('5 GB free -> picks 4b (exactly at threshold)', () => {
    expect(pickModelForRAM(5_000)).toBe('4b');
  });

  it('4.9 GB free -> picks 2b (just below 4b threshold)', () => {
    expect(pickModelForRAM(4_999)).toBe('2b');
  });

  it('3 GB free -> picks 2b (exactly at threshold)', () => {
    expect(pickModelForRAM(3_000)).toBe('2b');
  });

  it('2.9 GB free -> returns null (below 2b threshold)', () => {
    expect(pickModelForRAM(2_999)).toBeNull();
  });

  it('1 GB free -> returns null (no model fits)', () => {
    expect(pickModelForRAM(1_000)).toBeNull();
  });

  it('0 MB free -> returns null', () => {
    expect(pickModelForRAM(0)).toBeNull();
  });

  it('100 GB free -> picks 27b (always picks largest that fits)', () => {
    const result = pickModelForRAM(100_000);
    expect(result).toBe('27b');
  });

  it('selected model accuracy is always >= 99%', () => {
    // Every model in the Qwen3.5 fleet has accuracy >= 99.1%
    const testCases = [25_000, 20_000, 8_000, 5_000, 3_000];
    for (const freeMB of testCases) {
      const id = pickModelForRAM(freeMB);
      expect(id).not.toBeNull();
      expect(MODEL_REGISTRY[id!].accuracy).toBeGreaterThanOrEqual(99);
    }
  });
});
