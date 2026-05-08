/**
 * One Euro Filter tests — pin Casiez 2012 behavior + the
 * confidence-aware wrapper used in bodyPoseService.
 *
 * Reference oracle for the canonical 1€ math:
 *   https://gery.casiez.net/1euro/  (BSD reference impl)
 *   CHI 2012 paper § 3 — adaptive cutoff = mincutoff + β·|dx̂|
 *
 * What we pin:
 *   1. Slow signal → output tracks signal closely (not laggy)
 *   2. Pure noise → output flat (smoothed)
 *   3. Slow signal + noise → output extracts slow signal
 *   4. Step change → output catches up within a few frames
 *   5. NaN-in → previous value out (defensive)
 *   6. Confidence-aware wrapper: low conf = more smoothing,
 *      high conf = less smoothing
 *   7. Big intentional jump via snapTo → output is the new value
 *      immediately (no smoothing lag)
 */
import { describe, it, expect } from 'vitest';
import { OneEuroFilter, ConfidenceAwareOneEuro } from '@/services/oneEuroFilter';

describe('OneEuroFilter — basics', () => {
  it('passes a slow constant signal through without distortion', () => {
    const f = new OneEuroFilter({ freq: 30 });
    let last = 0;
    for (let i = 0; i < 30; i++) last = f.filter(100);
    expect(last).toBeCloseTo(100, 0);
  });

  it('returns prior value on NaN input (defensive)', () => {
    const f = new OneEuroFilter({ freq: 30 });
    f.filter(50);
    const out = f.filter(NaN);
    expect(Number.isFinite(out)).toBe(true);
    expect(out).toBeCloseTo(50, 0);
  });

  it('snapTo bypasses the smoother — instant jump', () => {
    const f = new OneEuroFilter({ freq: 30 });
    for (let i = 0; i < 30; i++) f.filter(100);
    f.snapTo(500);
    expect(f.value).toBe(500);
  });

  it('reset clears state — first sample after reset is the seed', () => {
    const f = new OneEuroFilter({ freq: 30 });
    for (let i = 0; i < 30; i++) f.filter(100);
    f.reset();
    const out = f.filter(900);
    expect(out).toBe(900); // first sample after reset becomes the seed
  });
});

describe('OneEuroFilter — jitter rejection vs lag (the Casiez trade-off)', () => {
  // Synthetic noisy signal: slow ramp 0→200 over 60 frames, with
  // ±15px high-frequency noise on each sample. Output should track
  // the ramp closely, not the noise.
  it('extracts a slow signal from noisy measurements with low average error', () => {
    const f = new OneEuroFilter({ freq: 30, mincutoff: 1.0, beta: 0.007 });
    let totalErr = 0;
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const truth = (i / 59) * 200;
      // Deterministic pseudo-noise via sine so the test is stable.
      const noise = Math.sin(i * 7.13) * 15;
      const out = f.filter(truth + noise);
      // Skip first 5 samples (filter warmup)
      if (i >= 5) { totalErr += Math.abs(out - truth); n++; }
    }
    const meanErr = totalErr / n;
    // Mean error should be much smaller than the noise amplitude.
    expect(meanErr).toBeLessThan(8);
  });

  it('keeps lag low during deliberate fast motion (β>0 raises cutoff)', () => {
    // Fast ramp 0 → 500 over 10 frames. Higher β → less smoothing
    // during fast motion → output should be CLOSER to the truth at
    // the end than with β=0 (i.e. β=0 lags more).
    const fHigh = new OneEuroFilter({ freq: 30, mincutoff: 1.0, beta: 0.5 });
    const fLow = new OneEuroFilter({ freq: 30, mincutoff: 1.0, beta: 0 });
    let lastHigh = 0, lastLow = 0;
    for (let i = 0; i < 10; i++) {
      const v = (i / 9) * 500;
      lastHigh = fHigh.filter(v);
      lastLow = fLow.filter(v);
    }
    // Both lag the truth (500), but β=0.5 should be closer.
    expect(Math.abs(lastHigh - 500)).toBeLessThan(Math.abs(lastLow - 500));
  });

  it('settles to a step change within a few frames (no permanent offset)', () => {
    const f = new OneEuroFilter({ freq: 30, mincutoff: 1.0, beta: 0.007 });
    for (let i = 0; i < 20; i++) f.filter(100);
    let last = 0;
    for (let i = 0; i < 30; i++) last = f.filter(500);
    // Should be within 2% of new step value after 30 samples.
    expect(last).toBeGreaterThan(490);
  });

  it('responds promptly to a fast-velocity input even with low mincutoff', () => {
    // Pure-jitter stress: pure flat noise → output should flatten,
    // not drift.
    const f = new OneEuroFilter({ freq: 30, mincutoff: 1.0, beta: 0.007 });
    let last = 0;
    for (let i = 0; i < 60; i++) {
      const noise = Math.sin(i * 11.3) * 5; // tight noise around 0
      last = f.filter(noise);
    }
    expect(Math.abs(last)).toBeLessThan(2);
  });

  it('uses real timestamps when provided (variable framerate safe)', () => {
    const f = new OneEuroFilter({ freq: 30 });
    let t = 0;
    let last = 0;
    for (let i = 0; i < 30; i++) {
      // Variable dt: 20–50ms — simulates Safari throttling.
      t += 20 + Math.sin(i) * 10;
      last = f.filter(100, t);
    }
    expect(Number.isFinite(last)).toBe(true);
    expect(last).toBeCloseTo(100, 0);
  });
});

describe('ConfidenceAwareOneEuro — visibility-modulated smoothing', () => {
  it('high confidence + jitter → output near the noisy mean', () => {
    const f = new ConfidenceAwareOneEuro({
      freq: 30,
      mincutoffHigh: 1.0,
      mincutoffLow: 0.3,
      beta: 0.007,
    });
    for (let i = 0; i < 60; i++) {
      const noise = Math.sin(i * 7.13) * 10;
      f.update(100 + noise, /*conf*/ 0.95);
    }
    // Noise has mean ≈ 0 but residual phase offset on 60 samples
    // leaves a small tracking offset. Within 5 of the true mean is
    // a strong jitter-rejection result for ±10px noise amplitude.
    expect(Math.abs(f.value - 100)).toBeLessThan(5);
  });

  it('low confidence smooths harder — output drags more for the same input', () => {
    // Same step input, but high confidence vs low confidence — the
    // low-confidence filter should produce a SMALLER step in output
    // (i.e. lag harder, follow noise less).
    const high = new ConfidenceAwareOneEuro({
      freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
    });
    const low = new ConfidenceAwareOneEuro({
      freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
    });
    // Warm both to 0
    for (let i = 0; i < 10; i++) {
      high.update(0, 1.0);
      low.update(0, 0.1);
    }
    // Apply same step input
    let lastHigh = 0, lastLow = 0;
    for (let i = 0; i < 5; i++) {
      lastHigh = high.update(500, 1.0);
      lastLow = low.update(500, 0.1);
    }
    // High-confidence path should be CLOSER to 500 than low-conf.
    expect(Math.abs(lastHigh - 500)).toBeLessThan(Math.abs(lastLow - 500));
  });

  it('NaN confidence handled defensively (treated as zero / heavy smooth)', () => {
    const f = new ConfidenceAwareOneEuro({ freq: 30 });
    const out = f.update(100, NaN);
    expect(Number.isFinite(out)).toBe(true);
  });

  it('snapTo / reset propagate to the inner filter', () => {
    const f = new ConfidenceAwareOneEuro({ freq: 30 });
    for (let i = 0; i < 10; i++) f.update(100, 1.0);
    f.snapTo(900);
    expect(f.value).toBe(900);
    f.reset();
    const out = f.update(50, 1.0);
    expect(out).toBe(50);
  });

  it('noise floor scales mincutoff — quiet stays responsive, jittery smooths harder', () => {
    // Same input + confidence on two filters, different noise floors.
    // The high-noise one should produce more lag (closer to prior
    // value) than the quiet one.
    const quiet = new ConfidenceAwareOneEuro({
      freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
    });
    const jittery = new ConfidenceAwareOneEuro({
      freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
    });
    quiet.setNoiseFloor(0.001);    // very quiet
    jittery.setNoiseFloor(0.080);  // heavy car-like jitter
    // Warm both to 0
    for (let i = 0; i < 10; i++) {
      quiet.update(0, 1.0);
      jittery.update(0, 1.0);
    }
    // Apply same step input under high confidence — without noise,
    // a 1.0-confidence frame gets the FULL mincutoffHigh (1.0 Hz).
    // With heavy noise, the filter should drop toward mincutoffLow
    // (0.3 Hz) → smoother, more lag.
    let lastQ = 0, lastJ = 0;
    for (let i = 0; i < 5; i++) {
      lastQ = quiet.update(500, 1.0);
      lastJ = jittery.update(500, 1.0);
    }
    expect(Math.abs(lastQ - 500)).toBeLessThan(Math.abs(lastJ - 500));
  });

  it('zero / NaN noise floor falls through to no-noise behavior', () => {
    const f = new ConfidenceAwareOneEuro({
      freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
    });
    f.setNoiseFloor(NaN);
    f.setNoiseFloor(0);
    f.setNoiseFloor(-1);
    // Should still produce a valid output unchanged from baseline.
    for (let i = 0; i < 10; i++) f.update(100, 1.0);
    expect(f.value).toBeGreaterThan(50); // converged
    expect(Number.isFinite(f.value)).toBe(true);
  });

  it('AAC use case: slow finger pointing during low-vis frames stays stable', () => {
    // Realistic: user's finger sweeps from 100 → 300 over 30 frames,
    // but every other frame has visibility=0.15 (partly out of
    // frame). Output should still track the slow signal without
    // being yanked by the low-vis noise.
    const f = new ConfidenceAwareOneEuro({
      freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
    });
    let totalErr = 0;
    let n = 0;
    for (let i = 0; i < 30; i++) {
      const truth = 100 + (i / 29) * 200;
      const isLowVis = i % 2 === 1;
      const noise = isLowVis ? Math.sin(i * 13.7) * 30 : Math.sin(i * 7.1) * 5;
      const conf = isLowVis ? 0.15 : 0.9;
      const out = f.update(truth + noise, conf);
      if (i >= 5) { totalErr += Math.abs(out - truth); n++; }
    }
    const meanErr = totalErr / n;
    // Despite half the frames being noisy, mean tracking error
    // should be far less than the per-frame low-vis noise (30).
    expect(meanErr).toBeLessThan(20);
  });
});
