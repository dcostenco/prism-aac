/** Deterministic measurement noise, not pixel recognition or user intent. */
const UINT_RANGE = 4294967296;
const RANDOM_MULTIPLIER = 1664525;
const RANDOM_INCREMENT = 1013904223;
const INTERVAL_JITTER = 0.2;
const DRIFT_RAMP_MS = 30_000;
export function wristNoise(seed: number, fps: number, sigma: number, correlation: number, drift: number) {
  let x = 0, y = 0, time = 0;
  const uniform = () => ((seed = (Math.imul(seed, RANDOM_MULTIPLIER) + RANDOM_INCREMENT) >>> 0) + 0.5) / UINT_RANGE;
  const gaussian = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  return () => {
    const innovation = Math.sqrt(1 - correlation * correlation) * sigma;
    x = correlation * x + innovation * gaussian();
    y = correlation * y + innovation * gaussian();
    time += 1000 / fps * (1 - INTERVAL_JITTER + 2 * INTERVAL_JITTER * uniform());
    return { point: { x: 0.5 + x + drift * time / DRIFT_RAMP_MS, y: 0.5 + y }, time };
  };
}
