import { describe, expect, it } from 'vitest';
import { WRIST_SELECTION_NOISE_CEILING, WristMotion, limitWristCursorStep, wristCursorSettled, wristSelectionDwellMs } from '@/services/wristMotion';
import { wristNoise } from './helpers/wrist-noise';

const DRIFTS = [0, 0.003, 0.015];
const FRAME_MS = 1000 / 15;
const CAMERA_WIDTH = 320;
const TREMOR = 0.015;
const DRIFT_DURATION = 30_000;
const SEEDS = [19423, 729, 59331];
const NOISE_CASES = SEEDS.flatMap(seed => [4.5, 6, 15].flatMap(fps => [0.003, 0.01].flatMap(sigma =>
  [0, 0.6].map(correlation => ({ seed, fps, sigma, correlation })))));
const DEFAULT_DWELL_MS = 1200;
const OBSERVATION_MS = 20_000;
const RECOVERY_JUMP = 0.12;
const RECOVERY_INTERRUPTS = ['explicit loss', 'stale gap'] as const;
const SCREEN_GAINS = [1280 / 0.7, 1280 / 0.1, 1280 / 0.02];
const SCREEN_TOLERANCE_PX = Math.hypot(1280, 720) * 0.004;
const SLOW_SCREEN_SPEED_PX_PER_SECOND = 8;
const SCREEN_TEST_FPS = [4.5, 15];
const REAL_PROFILE_GAINS = [0.05, 0.1, 0.7].flatMap(range => [0.2, 2].map(scale => 1280 * scale / range));
const NOISY_TRAVEL_CASES = REAL_PROFILE_GAINS.flatMap(gain => SCREEN_TEST_FPS.flatMap(fps =>
  [0, 0.6].flatMap(correlation => SEEDS.map(seed => ({ gain, fps, correlation, seed })))));
const NOISE_BOUNDARY_FRACTIONS = [0.3, 0.5, 0.6, 0.7, 0.9];
function point(i: number, drift: number, jitter = 0) {
  return { x: 0.5 + drift * i * FRAME_MS / DRIFT_DURATION + (i % 2 ? jitter : -jitter),
    y: 0.5 + (i % 2 ? jitter : -jitter) };
}
describe.each(DRIFTS)('wrist motion at drift=%s', drift => {
  it.each(NOISY_TRAVEL_CASES)('cannot complete a selectable pause during noisy slow screen travel: %j', ({ gain, fps, correlation, seed }) => {
    // Include modest noise and the formerly unsafe near-limit boundary.
    for (const fraction of NOISE_BOUNDARY_FRACTIONS) {
      const gate = new WristMotion(); let readyStart: number | null = null, longest = 0;
      const sigma = fraction * Math.min(WRIST_SELECTION_NOISE_CEILING, SCREEN_TOLERANCE_PX / gain);
      const travel = SLOW_SCREEN_SPEED_PX_PER_SECOND * DRIFT_DURATION / 1000 / gain;
      const next = wristNoise(seed, fps, sigma, correlation, travel);
      for (let sample = next(); sample.time < OBSERVATION_MS; sample = next()) {
        const result = gate.update({ x: sample.point.x + drift, y: sample.point.y }, sample.time, CAMERA_WIDTH,
          { gain: { x: gain, y: gain }, tolerancePx: SCREEN_TOLERANCE_PX });
        if (result.selectionReady) { readyStart ??= sample.time; longest = Math.max(longest, sample.time - readyStart); }
        else readyStart = null;
      }
      expect(longest, `noise budget fraction ${fraction}`).toBeLessThan(DEFAULT_DWELL_MS);
    }
  });
  it.each(SCREEN_GAINS.flatMap(gain => SCREEN_TEST_FPS.map(fps => ({ gain, fps }))))('does not call continuing slow screen travel a selectable pause: %j', ({ gain, fps }) => {
    const gate = new WristMotion(); let readyStart: number | null = null, longest = 0;
    for (let i = 0; i < fps * 10; i++) {
      const time = (i + 1) * 1000 / fps;
      const result = gate.update({ x: 0.5 + drift + SLOW_SCREEN_SPEED_PX_PER_SECOND * time / 1000 / gain, y: 0.5 }, time, CAMERA_WIDTH,
        { gain: { x: gain, y: gain }, tolerancePx: SCREEN_TOLERANCE_PX });
      if (result.selectionReady) { readyStart ??= time; longest = Math.max(longest, time - readyStart); }
      else readyStart = null;
    }
    expect(longest).toBeLessThan(DEFAULT_DWELL_MS); // Cannot finish an automatic selection while deliberately moving.
  });
  it.each(SCREEN_GAINS)('allows selection when projected camera noise is within the pixel budget, gain=%s', gain => {
    const sigma = Math.min(0.003, 1 / gain);
    const gate = new WristMotion(), next = wristNoise(SEEDS[0], 15, sigma, 0.6, 0);
    let selected = 0;
    for (let sample = next(); sample.time < OBSERVATION_MS; sample = next()) {
      const result = gate.update({ x: sample.point.x + drift, y: sample.point.y }, sample.time, CAMERA_WIDTH,
        { gain: { x: gain, y: gain }, tolerancePx: SCREEN_TOLERANCE_PX });
      if (result.selectionReady) selected++;
    }
    expect(selected).toBeGreaterThan(0); // Precision-qualified input remains selectable at every mapping.
  });
  it.each(SCREEN_GAINS)('withholds automatic selection across the above-budget noise band, gain=%s', gain => {
    for (const factor of [1.1, 1.5, 3]) {
      const gate = new WristMotion(), next = wristNoise(SEEDS[0], 15, factor * SCREEN_TOLERANCE_PX / gain, 0.6, 0);
      let aboveBudgetFrames = 0;
      const noiseLimit = Math.min(WRIST_SELECTION_NOISE_CEILING, SCREEN_TOLERANCE_PX / gain);
      const observed: Array<{ time: number; noise: number }> = [];
      for (let sample = next(); sample.time < OBSERVATION_MS; sample = next()) {
        const result = gate.update({ x: sample.point.x + drift, y: sample.point.y }, sample.time, CAMERA_WIDTH,
          { gain: { x: gain, y: gain }, tolerancePx: SCREEN_TOLERANCE_PX });
        observed.push({ time: sample.time, noise: result.noise });
        const recentNoise = observed.filter(p => sample.time - p.time <= 2000).slice(-40);
        // Seeded distribution sigma is not an oracle for every finite window.
        // The contract concerns the noise actually measured in that window.
        if (recentNoise.some(p => p.noise > noiseLimit)) {
          aboveBudgetFrames++;
          expect(result.selectionReady).toBe(false);
        }
      }
      expect(aboveBudgetFrames).toBeGreaterThan(20);
    }
  });
  it.each(NOISE_CASES)('withholds automatic selection during departure from an established rested cursor: %j', ({ seed, fps, sigma, correlation }) => {
    const gate = new WristMotion(), next = wristNoise(seed, fps, sigma, correlation, drift);
    let latchAt: number | null = null, released = false;
    for (let sample = next(); sample.time < OBSERVATION_MS; sample = next()) {
      const travel = latchAt !== null ? Math.max(0, sample.time - latchAt - 100) * 0.02 / 1000 : 0;
      const result = gate.update({ x: sample.point.x + travel, y: sample.point.y }, sample.time, CAMERA_WIDTH);
      if (latchAt === null && sample.time >= 5000 && (result.selectionReady || sigma === 0.01 && result.paused)) { latchAt = sample.time; continue; }
      if (!result.selectionReady && latchAt !== null && sample.time > latchAt + 100) { released = true; break; }
      if (latchAt !== null && sample.time - latchAt >= DEFAULT_DWELL_MS) break;
    }
    expect(latchAt).not.toBeNull(); expect(released).toBe(true);
  });
  it.each(NOISE_CASES)('keeps noisy automatic selection off without losing stabilized cursor feedback: %j', ({ seed, fps, sigma, correlation }) => {
    const gate = new WristMotion(), next = wristNoise(seed, fps, sigma, correlation, drift);
    let readyStart: number | null = null, longest = 0, updates = 0;
    for (let sample = next(); sample.time < OBSERVATION_MS; sample = next()) {
      const result = gate.update(sample.point, sample.time, CAMERA_WIDTH);
      if (!result.rejected) updates++;
      if (sigma === 0.01) expect(result.selectionReady).toBe(false); // Approved fail-closed envelope, not tremor/intent accuracy.
      if (result.selectionReady) {
        if (readyStart === null) readyStart = sample.time;
        longest = Math.max(longest, sample.time - readyStart);
      } else readyStart = null;
    }
    expect(updates).toBeGreaterThan(20);
    if (sigma === 0.003) expect(longest).toBeGreaterThanOrEqual(DEFAULT_DWELL_MS);
  });
  it('cannot bypass the camera target-hold minimum with a short legacy setting', () => {
    expect(wristSelectionDwellMs(200)).toBe(DEFAULT_DWELL_MS);
    expect(wristSelectionDwellMs(1800)).toBe(1800);
  });
  it('releases an intermediate noisy-motion anchor when fresh low-noise readings settle elsewhere', () => {
    const gate = new WristMotion(); let time = 0, result;
    const update = (x: number) => { time += 100; result = gate.update({ x: x + drift, y: 0.5 }, time, CAMERA_WIDTH); };
    for (let i = 0; i < 80; i++) update(0.5);
    for (let i = 1; i <= 8; i++) update(0.5 + i * 0.01);
    for (let i = 7; i >= 0; i--) update(0.5 + i * 0.01);
    for (let i = 0; i < 60; i++) update(0.5);
    expect(result!.point.x).toBeCloseTo(0.5 + drift, 3);
    expect(result!.selectionReady).toBe(true);
  });
  it('keeps a very slow feed available for cursor movement but not automatic selection', () => {
    const gate = new WristMotion(); let last;
    for (let i = 0; i < 30; i++) last = gate.update(point(i, drift), i * 1000 / 3, CAMERA_WIDTH);
    expect(last!.rejected).toBe(false); expect(last!.paused).toBe(true); expect(last!.selectionReady).toBe(false);
  });
  it.each(NOISE_CASES)('stabilizes the cursor for a dwell-length pause with random/correlated noise: %j', ({ seed, fps, sigma, correlation }) => {
    const gate = new WristMotion(), next = wristNoise(seed, fps, sigma, correlation, drift);
    let pauseStart: number | null = null, longest = 0, held: { x: number; y: number } | null = null;
    for (let sample = next(); sample.time < OBSERVATION_MS; sample = next()) {
      const result = gate.update(sample.point, sample.time, CAMERA_WIDTH);
      if (!result.paused) { pauseStart = null; held = null; continue; }
      if (pauseStart === null) { pauseStart = sample.time; held = result.point; }
      expect(result.point).toEqual(held); // No chasing noise during the continuous hold.
      longest = Math.max(longest, sample.time - pauseStart);
    }
    expect(longest).toBeGreaterThanOrEqual(DEFAULT_DWELL_MS);
  });
  it('breaks the pause after an unobserved gap without erasing measured noise', () => {
    const gate = new WristMotion(); let result;
    for (let i = 0; i < 45; i++) result = gate.update(point(i, drift, TREMOR), i * FRAME_MS, CAMERA_WIDTH);
    expect(result!.paused).toBe(true);
    const after = gate.update(point(45, drift, TREMOR), 45 * FRAME_MS + 600, CAMERA_WIDTH);
    expect(after.paused).toBe(false); expect(after.noise).toBeGreaterThan(0);
  });
  it.each([6, 10, 15])('qualifies a stationary camera stream at %s fps without requiring impossible sample density', fps => {
    const gate = new WristMotion(); let last;
    for (let i = 0; i < 30; i++) last = gate.update({ x: 0.5 + drift * i * (1000 / fps) / DRIFT_DURATION, y: 0.5 }, i * 1000 / fps, CAMERA_WIDTH);
    expect(last!.paused).toBe(true);
  });
  it('latches a pause with tremor instead of chasing positional drift', () => {
    const gate = new WristMotion(); let held: number[] = [];
    for (let i = 0; i < 150; i++) {
      const value = gate.update(point(i, drift, TREMOR), i * FRAME_MS, CAMERA_WIDTH);
      if (i > 45) { expect(value.paused).toBe(true); held.push(value.point.x); }
    }
    expect(Math.max(...held) - Math.min(...held)).toBeLessThan(0.00001);
  });
  it('does not learn a steady deliberate trajectory as tremor or count it as a pause', () => {
    const gate = new WristMotion(); let last;
    for (let i = 0; i < 90; i++) last = gate.update({ x: 0.3 + i * 0.002 + drift * i / 90, y: 0.5 }, i * FRAME_MS, CAMERA_WIDTH);
    expect(last!.noise).toBeLessThan(0.00001); expect(last!.paused).toBe(false);
    expect(last!.point.x).toBeGreaterThan(0.46);
  });
  it.each([6, 10, 15])('recognizes directed travel beneath tremor at %s fps', fps => {
    const gate = new WristMotion(); let last;
    for (let i = 0; i < 60; i++) {
      const time = i * 1000 / fps;
      const p = { x: 0.5 + drift * time / DRIFT_DURATION + (i % 2 ? TREMOR : -TREMOR) + 0.02 * time / 1000,
        y: 0.5 + (i % 2 ? TREMOR : -TREMOR) };
      last = gate.update(p, time, CAMERA_WIDTH);
      if (i > 20) expect(last.paused).toBe(false);
    }
    expect(last!.point.x).toBeGreaterThan(0.55);
  });
  it('rejects an isolated jump even without a low-confidence excuse', () => {
    const gate = new WristMotion(); let last;
    for (let i = 0; i < 20; i++) last = gate.update(point(i, drift), i * FRAME_MS, CAMERA_WIDTH);
    const jump = gate.update({ x: 0.8, y: 0.85 }, 20 * FRAME_MS, CAMERA_WIDTH);
    expect(jump.rejected).toBe(true); expect(jump.paused).toBe(false);
    expect(Math.hypot(jump.point.x - last!.point.x, jump.point.y - last!.point.y)).toBeLessThan(0.001);
    const next = gate.update(point(21, drift), 21 * FRAME_MS, CAMERA_WIDTH);
    expect(next.rejected).toBe(false); expect(next.noise).toBeLessThan(0.001);
  });
  it.each(RECOVERY_INTERRUPTS)('does not promote an isolated recovery outlier to the trusted position after %s', interruption => {
    const gate = new WristMotion(); let last;
    const resting = { x: 0.5 + drift, y: 0.5 };
    for (let i = 0; i < 30; i++) last = gate.update(resting, i * FRAME_MS, CAMERA_WIDTH);
    if (interruption === 'explicit loss') gate.interrupt();
    const recoveryTime = 30 * FRAME_MS + (interruption === 'stale gap' ? 600 : 0);
    const outlier = gate.update({ x: resting.x + RECOVERY_JUMP, y: resting.y }, recoveryTime, CAMERA_WIDTH);
    expect(outlier.rejected).toBe(true);
    expect(outlier.point.x).toBeCloseTo(last!.point.x);
    const recovered = gate.update(resting, recoveryTime + FRAME_MS, CAMERA_WIDTH);
    expect(recovered.rejected).toBe(false);
    expect(recovered.point.x).toBeCloseTo(resting.x);
    expect(recovered.selectionReady).toBe(false); // Lost time never counts toward a new selection.
  });
  it('can reacquire a genuinely moved wrist after loss once two fresh observations agree', () => {
    const gate = new WristMotion();
    for (let i = 0; i < 30; i++) gate.update({ x: 0.5 + drift, y: 0.5 }, i * FRAME_MS, CAMERA_WIDTH);
    gate.interrupt();
    const moved = { x: 0.5 + drift + RECOVERY_JUMP, y: 0.5 };
    expect(gate.update(moved, 30 * FRAME_MS, CAMERA_WIDTH).rejected).toBe(true);
    const confirmed = gate.update(moved, 31 * FRAME_MS, CAMERA_WIDTH);
    expect(confirmed.rejected).toBe(false);
    expect(confirmed.point.x).toBeCloseTo(moved.x);
    expect(confirmed.selectionReady).toBe(false);
  });
  it('lets a confirmed large deliberate step through within two frames', () => {
    const gate = new WristMotion();
    for (let i = 0; i < 20; i++) gate.update(point(i, drift), i * FRAME_MS, CAMERA_WIDTH);
    expect(gate.update({ x: 0.7, y: 0.5 }, 20 * FRAME_MS, CAMERA_WIDTH).rejected).toBe(true);
    const confirmed = gate.update({ x: 0.702, y: 0.5 }, 21 * FRAME_MS, CAMERA_WIDTH);
    expect(confirmed.rejected).toBe(false); expect(confirmed.paused).toBe(false);
    expect(confirmed.point.x).toBeGreaterThan(0.69);
  });
  it('retains noise but breaks pause continuity after tracking loss', () => {
    const gate = new WristMotion(); let last;
    for (let i = 0; i < 45; i++) last = gate.update(point(i, drift, TREMOR), i * FRAME_MS, CAMERA_WIDTH);
    expect(last!.paused).toBe(true); const noise = last!.noise;
    gate.interrupt();
    const first = gate.update(point(46, drift, TREMOR), 46 * FRAME_MS, CAMERA_WIDTH);
    expect(first.paused).toBe(false); expect(first.noise).toBeGreaterThan(noise * 0.8);
  });
  it.each([false, true])('withholds selection while a noisy estimate is inside the quality window (interrupted=%s)', interrupted => {
    const gate = new WristMotion(); let lastNoisy = -Infinity, firstReady: number | null = null, pending = interrupted;
    for (let time = 0; time <= 8000; time += 100) {
      const jitter = time <= 4000 ? TREMOR : 0;
      // Lose tracking on the first frame after the estimate settles, while the noisy one is still in the window.
      if (pending && lastNoisy > 0 && time - lastNoisy === 200) { gate.interrupt(); pending = false; }
      const x = 0.5 + drift * time / DRIFT_DURATION + ((time / 100) % 2 ? jitter : -jitter);
      const result = gate.update({ x, y: 0.5 }, time, CAMERA_WIDTH);
      if (result.noise > WRIST_SELECTION_NOISE_CEILING) lastNoisy = time;
      if (result.selectionReady && firstReady === null) firstReady = time;
    }
    expect(lastNoisy).toBeGreaterThan(4000); expect(pending).toBe(false);
    expect(firstReady).not.toBeNull();
    expect(firstReady! - lastNoisy).toBeGreaterThan(2000);
  });
  it('neither hides nor indefinitely holds a noisy estimate across a camera clock reset', () => {
    const gate = new WristMotion(); let lastNoisy = -Infinity, time = 0;
    const update = (t: number, jitter: number) => gate.update({ x: 0.5 + drift * t / DRIFT_DURATION + ((t / 100) % 2 ? jitter : -jitter), y: 0.5 }, t, CAMERA_WIDTH);
    for (; time <= 4000 || time - lastNoisy < 200; time += 100) if (update(time, time <= 4000 ? TREMOR : 0).noise > WRIST_SELECTION_NOISE_CEILING) lastNoisy = time;
    expect(update(100, 0).rejected).toBe(true); // The clock went backwards.
    let firstReady: number | null = null;
    for (let t = 200; t <= 4000 && firstReady === null; t += 100) if (update(t, 0).selectionReady) firstReady = t;
    expect(firstReady).not.toBeNull();
    expect(firstReady! - 200).toBeGreaterThan(2000);
  });
  it('bounds even a confirmed cursor discontinuity and does not call that in-flight cursor settled', () => {
    const target = { x: 700, y: 400 }, start = { x: 300, y: 400 };
    let current = start;
    for (let i = 0; i < 8; i++) {
      const next = limitWristCursorStep(current, target, FRAME_MS, 975, 611);
      expect(Math.hypot(next.x - current.x, next.y - current.y)).toBeLessThan(54);
      if (next.limited) expect(wristCursorSettled(next, target, 975, 611)).toBe(false);
      current = next;
    }
    expect(current.x).toBeCloseTo(target.x);
  });
});
