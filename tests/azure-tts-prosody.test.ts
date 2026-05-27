/**
 * SSML prosody format — locks the client-side rate normalization formula
 * and the dead-code audit that ensures buildSSML is no longer on the live path.
 *
 * History:
 *   May 2026 #1: `rate="100%"` caused chipmunk in RO mode (Azure parses
 *     unsigned % as delta: "100%" = +100% = 2× speed). Fixed to multiplier.
 *   May 2026 #2: stored rate 0.5 (default) → SSML 0.5 = 2× slow for Azure
 *     voices (RO, RU). EN escaped because Inworld discards <prosody>.
 *     Fix: ssmlRate = storedRate × 2, capped at 1.4.
 *       stored 0.5 (default) → SSML 1.0 (normal)
 *       stored 1.0 (slider max users crank to) → SSML 1.4 (fast, not chipmunk)
 *     The 1.4 cap is enforced by tts-live-diag-rate.mjs (rate ≥ 1.5 = ❌).
 *   May 2026 portal-refactor: buildSSML is no longer on the live path.
 *     speakAzure now calls computeNormalizedRate (client) and sends the result
 *     to the portal, which calls buildAzureSSML (server-side source of truth).
 *     This file now tests computeNormalizedRate — the client half of the formula.
 *     The server half is tested in portal/src/app/api/v1/tts/public/_helpers.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { computeNormalizedRate } from '@/services/azureTTS';
// NOTE: buildSSML is intentionally NOT imported. It is dead code since SSML
// assembly moved server-side (portal buildAzureSSML). Server-side prosody
// coverage is in synalux-private/portal/src/app/api/v1/tts/public/_helpers.test.ts.

// ─────────────────────────────────────────────────────────────────────────────
// LIVE PATH: computeNormalizedRate — client-side half of the rate formula
//
// speakAzure sends normalizedRate = computeNormalizedRate(storedRate) to the
// portal. The portal's buildAzureSSML puts this value directly into SSML
// <prosody rate="N">. So every stored→SSML conversion is:
//   SSML rate = clamp(storedRate × 2, 0.5, 1.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeNormalizedRate — client-side rate formula (LIVE PATH)', () => {
  const cases: Array<{ stored: number; expected: number; label: string }> = [
    // The persisted default. MUST produce 1.00 (normal speed).
    // Regression: stored 0.50 direct (without × 2) → SSML 0.50 = 2× slow RO/RU.
    { stored: 0.50, expected: 1.00, label: 'default 0.5 → normalized 1.00 (normal speed)' },

    // Slowest slider position — normalized floor at 0.50.
    { stored: 0.25, expected: 0.50, label: 'slowest 0.25 → normalized 0.50 (floor)' },

    // Mid range.
    { stored: 0.40, expected: 0.80, label: '0.40 → 0.80' },

    // Fast, below chipmunk cap.
    { stored: 0.60, expected: 1.20, label: '0.60 → 1.20' },

    // Exactly at cap boundary.
    { stored: 0.70, expected: 1.40, label: '0.70 → 1.40 (cap boundary)' },

    // User who cranked slider to fight slow speech — must stay ≤ 1.40.
    { stored: 1.00, expected: 1.40, label: 'slider max 1.0 → 1.40 (chipmunk guard)' },

    // Absurd values — still capped.
    { stored: 4.00, expected: 1.40, label: 'absurd 4.0 → 1.40' },
    { stored: 10.0, expected: 1.40, label: 'absurd 10.0 → 1.40' },
  ];

  for (const { stored, expected, label } of cases) {
    it(label, () => {
      expect(computeNormalizedRate(stored)).toBeCloseTo(expected, 2);
    });
  }

  it('NaN → 1.00 (default, no silence)', () => {
    expect(computeNormalizedRate(NaN)).toBeCloseTo(1.0, 2);
  });

  it('zero → 1.00 (not > 0 guard prevents 0 × 2 = 0 silent audio)', () => {
    expect(computeNormalizedRate(0)).toBeCloseTo(1.0, 2);
  });

  it('negative → 1.00 (not > 0 guard)', () => {
    expect(computeNormalizedRate(-1)).toBeCloseTo(1.0, 2);
    expect(computeNormalizedRate(-0.5)).toBeCloseTo(1.0, 2);
  });

  it('Infinity → 1.00 (not finite guard)', () => {
    expect(computeNormalizedRate(Infinity)).toBeCloseTo(1.0, 2);
  });

  it('chipmunk gate: normalizedRate always < 1.5 (tts-live-diag-rate threshold)', () => {
    for (const stored of [0.7, 1.0, 2.0, 10.0, 100.0]) {
      expect(computeNormalizedRate(stored), `stored=${stored}`).toBeLessThan(1.5);
    }
  });

  it('result is always in [0.5, 1.4] for any positive finite input', () => {
    const inputs = [0.01, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 5.0];
    for (const stored of inputs) {
      const n = computeNormalizedRate(stored);
      expect(n, `stored=${stored}`).toBeGreaterThanOrEqual(0.5);
      expect(n, `stored=${stored}`).toBeLessThanOrEqual(1.4);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMULA INVARIANTS: explicit verification that computeNormalizedRate satisfies
// the key invariants that were previously verified via buildSSML's SSML output.
// These replace the "dead code audit" section that used buildSSML directly.
// ─────────────────────────────────────────────────────────────────────────────

describe('computeNormalizedRate — key invariants (RO/RU + chipmunk guard)', () => {
  it('slider default 0.5 → 1.00 (fixes RO/RU 2× slow)', () => {
    // The primary regression: stored 0.5 × 2 = 1.0 = normal speed.
    // Without × 2, SSML rate=0.5 was sent → Azure played RO/RU at half speed.
    expect(computeNormalizedRate(0.5)).toBeCloseTo(1.0, 2);
  });

  it('slider max 1.0 → 1.40 (chipmunk cap: 1.0 × 2 = 2.0, clamped to 1.4)', () => {
    // Without the cap, stored 1.0 × 2 = 2.0 → Azure chipmunk voice.
    expect(computeNormalizedRate(1.0)).toBeCloseTo(1.4, 2);
  });

  it('result is always a finite decimal float (never NaN, Infinity, or a percent integer)', () => {
    for (const stored of [0.25, 0.5, 0.7, 1.0, 2.0]) {
      const n = computeNormalizedRate(stored);
      expect(Number.isFinite(n), `stored=${stored} produced non-finite`).toBe(true);
      // Value in the float range [0.5, 1.4] — not accidentally 50 or 100 (percent ints)
      expect(n).toBeLessThanOrEqual(1.4);
      expect(n).toBeGreaterThanOrEqual(0.5);
    }
  });
});
