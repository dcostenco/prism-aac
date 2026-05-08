'use client';

/**
 * Hand Profile Service — Camera-based hand geometry scanning + auto-calibration
 *
 * Uses MediaPipe Hand Landmarks (21 keypoints) to:
 *   1. Scan the child's hand shape, finger length, finger width
 *   2. Learn per-finger touch offsets from approach angle
 *   3. Profile tremor frequency/amplitude from touch data
 *   4. Auto-tune EMA alpha and dead zone per-user
 *
 * Runs 100% on-device via WASM/WebGL. No network calls.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface HandProfile {
  id: string;
  name: string;
  handedness: 'left' | 'right' | 'unknown';
  fingerLengthsPx: number[];   // 5 fingers, index 0 = thumb
  fingerWidthsPx: number[];
  palmWidthPx: number;
  yOffset: number;             // learned px offset (replaces default -8)
  xOffset: number;
  tremorFreqHz: number;        // dominant tremor frequency
  tremorAmplPx: number;        // typical tremor amplitude in px
  emaAlpha: number;            // auto-tuned smoothing
  deadZonePx: number;          // auto-tuned hysteresis
  approachAngle: number;       // degrees from perpendicular (0 = straight down)
  touchSamples: number;        // total calibration touches collected
  created: string;
  lastCalibrated: string;
}

export interface HandLandmarks {
  x: number;
  y: number;
  z: number;
}

export interface TremorSample {
  x: number;
  y: number;
  t: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'prism-hand-profiles';
const ACTIVE_PROFILE_KEY = 'prism-hand-profile-active';
const TREMOR_WINDOW = 60; // samples for FFT analysis
const MIN_CALIBRATION_TOUCHES = 20;

const DEFAULT_PROFILE: HandProfile = {
  id: 'default',
  name: 'Default',
  handedness: 'unknown',
  fingerLengthsPx: [0, 0, 0, 0, 0],
  fingerWidthsPx: [0, 0, 0, 0, 0],
  palmWidthPx: 0,
  yOffset: -8,
  xOffset: 0,
  tremorFreqHz: 0,
  tremorAmplPx: 0,
  emaAlpha: 0.35,
  deadZonePx: 10,
  approachAngle: 0,
  touchSamples: 0,
  created: new Date().toISOString(),
  lastCalibrated: new Date().toISOString(),
};

// ── Profile Storage ────────────────────────────────────────────────────

export function loadProfiles(): HandProfile[] {
  if (typeof window === 'undefined') return [DEFAULT_PROFILE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as HandProfile[];
  } catch { /* use defaults */ }
  return [DEFAULT_PROFILE];
}

export function saveProfiles(profiles: HandProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch { /* quota */ }
}

export function getActiveProfile(): HandProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const id = localStorage.getItem(ACTIVE_PROFILE_KEY) || 'default';
    const profiles = loadProfiles();
    return profiles.find(p => p.id === id) || DEFAULT_PROFILE;
  } catch { return DEFAULT_PROFILE; }
}

export function setActiveProfile(id: string): void {
  try { localStorage.setItem(ACTIVE_PROFILE_KEY, id); } catch { /* */ }
}

export function saveProfile(profile: HandProfile): void {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  saveProfiles(profiles);
}

export function deleteProfile(id: string): void {
  const profiles = loadProfiles().filter(p => p.id !== id && p.id !== 'default');
  saveProfiles(profiles.length > 0 ? profiles : [DEFAULT_PROFILE]);
  if (localStorage.getItem(ACTIVE_PROFILE_KEY) === id) {
    setActiveProfile('default');
  }
}

// ── Tremor Analysis ────────────────────────────────────────────────────

const tremorBuffer: TremorSample[] = [];

export function recordTouchSample(x: number, y: number): void {
  tremorBuffer.push({ x, y, t: performance.now() });
  if (tremorBuffer.length > TREMOR_WINDOW * 2) {
    tremorBuffer.splice(0, tremorBuffer.length - TREMOR_WINDOW);
  }
}

export function analyzeTremor(): { freqHz: number; amplPx: number } {
  if (tremorBuffer.length < TREMOR_WINDOW) return { freqHz: 0, amplPx: 0 };

  const samples = tremorBuffer.slice(-TREMOR_WINDOW);
  const dt = (samples[samples.length - 1].t - samples[0].t) / 1000;
  if (dt < 0.1) return { freqHz: 0, amplPx: 0 };

  // Compute displacement deltas
  const dxArr: number[] = [];
  const dyArr: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    dxArr.push(samples[i].x - samples[i - 1].x);
    dyArr.push(samples[i].y - samples[i - 1].y);
  }

  // RMS amplitude (combined X+Y)
  let sumSq = 0;
  for (let i = 0; i < dxArr.length; i++) {
    sumSq += dxArr[i] * dxArr[i] + dyArr[i] * dyArr[i];
  }
  const amplPx = Math.sqrt(sumSq / dxArr.length);

  // Dominant frequency via zero-crossing count
  let crossings = 0;
  for (let i = 1; i < dxArr.length; i++) {
    if ((dxArr[i] > 0 && dxArr[i - 1] < 0) || (dxArr[i] < 0 && dxArr[i - 1] > 0)) {
      crossings++;
    }
  }
  const freqHz = crossings / (2 * dt);

  return { freqHz: Math.round(freqHz * 10) / 10, amplPx: Math.round(amplPx * 10) / 10 };
}

// ── Auto-Tune Parameters ───────────────────────────────────────────────

export function autoTuneFromTremor(profile: HandProfile): HandProfile {
  const { freqHz, amplPx } = analyzeTremor();
  if (amplPx === 0) return profile;

  // Higher tremor amplitude → lower alpha (heavier smoothing)
  // amplPx 0-2: mild tremor → alpha 0.35
  // amplPx 2-5: moderate → alpha 0.25
  // amplPx 5+: severe → alpha 0.15
  const alpha = amplPx < 2
    ? 0.35
    : amplPx < 5
      ? 0.35 - (amplPx - 2) * 0.033
      : 0.15;

  // Higher tremor → larger dead zone
  // amplPx 0-2: 10px
  // amplPx 2-5: 10-18px
  // amplPx 5+: 20px
  const deadZone = amplPx < 2
    ? 10
    : amplPx < 5
      ? 10 + (amplPx - 2) * 2.67
      : 20;

  return {
    ...profile,
    tremorFreqHz: freqHz,
    tremorAmplPx: amplPx,
    emaAlpha: Math.round(alpha * 100) / 100,
    deadZonePx: Math.round(deadZone),
    lastCalibrated: new Date().toISOString(),
  };
}

// ── Touch Offset Learning ──────────────────────────────────────────────

interface OffsetSample {
  intendedX: number;
  intendedY: number;
  actualX: number;
  actualY: number;
}

const offsetSamples: OffsetSample[] = [];

export function recordOffsetSample(
  intendedX: number, intendedY: number,
  actualX: number, actualY: number,
): void {
  offsetSamples.push({ intendedX, intendedY, actualX, actualY });
  if (offsetSamples.length > 200) offsetSamples.splice(0, 100);
}

export function learnOffsets(): { xOffset: number; yOffset: number } {
  if (offsetSamples.length < MIN_CALIBRATION_TOUCHES) {
    return { xOffset: 0, yOffset: -8 };
  }

  let sumDx = 0;
  let sumDy = 0;
  for (const s of offsetSamples) {
    sumDx += s.intendedX - s.actualX;
    sumDy += s.intendedY - s.actualY;
  }
  return {
    xOffset: Math.round(sumDx / offsetSamples.length),
    yOffset: Math.round(sumDy / offsetSamples.length),
  };
}

// ── Hand Geometry from MediaPipe Landmarks ─────────────────────────────

export function computeHandGeometry(
  landmarks: HandLandmarks[],
  imageWidth: number,
  imageHeight: number,
): Partial<HandProfile> {
  if (landmarks.length < 21) return {};

  // MediaPipe hand landmarks:
  // 0 = wrist
  // 1-4 = thumb (CMC, MCP, IP, TIP)
  // 5-8 = index (MCP, PIP, DIP, TIP)
  // 9-12 = middle (MCP, PIP, DIP, TIP)
  // 13-16 = ring (MCP, PIP, DIP, TIP)
  // 17-20 = pinky (MCP, PIP, DIP, TIP)

  const toPixel = (lm: HandLandmarks) => ({
    x: lm.x * imageWidth,
    y: lm.y * imageHeight,
  });

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const fingerBases = [1, 5, 9, 13, 17]; // MCP joints
  const fingerTips = [4, 8, 12, 16, 20]; // TIP landmarks

  const fingerLengthsPx = fingerBases.map((base, i) =>
    Math.round(dist(toPixel(landmarks[base]), toPixel(landmarks[fingerTips[i]])))
  );

  // Palm width: distance between index MCP (5) and pinky MCP (17)
  const palmWidthPx = Math.round(dist(toPixel(landmarks[5]), toPixel(landmarks[17])));

  // Finger widths: approximate from MCP joint spacing
  const fingerWidthsPx = [
    Math.round(dist(toPixel(landmarks[1]), toPixel(landmarks[2])) * 0.5),
    Math.round(dist(toPixel(landmarks[5]), toPixel(landmarks[6])) * 0.5),
    Math.round(dist(toPixel(landmarks[9]), toPixel(landmarks[10])) * 0.5),
    Math.round(dist(toPixel(landmarks[13]), toPixel(landmarks[14])) * 0.5),
    Math.round(dist(toPixel(landmarks[17]), toPixel(landmarks[18])) * 0.5),
  ];

  // Approach angle: angle of index finger relative to vertical
  const indexMCP = toPixel(landmarks[5]);
  const indexTIP = toPixel(landmarks[8]);
  const dx = indexTIP.x - indexMCP.x;
  const dy = indexTIP.y - indexMCP.y;
  const approachAngle = Math.round(Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI);

  // Handedness: if thumb is to the left of pinky → right hand (camera mirrored)
  const thumbTip = toPixel(landmarks[4]);
  const pinkyTip = toPixel(landmarks[20]);
  const handedness: 'left' | 'right' = thumbTip.x > pinkyTip.x ? 'right' : 'left';

  // Y-offset: derived from approach angle and finger length
  // More angled approach → larger offset needed
  const indexLength = fingerLengthsPx[1];
  const yOffsetDerived = -Math.round(Math.sin(approachAngle * Math.PI / 180) * indexLength * 0.12);
  const xOffsetDerived = handedness === 'right'
    ? -Math.round(Math.sin(approachAngle * Math.PI / 180) * indexLength * 0.05)
    : Math.round(Math.sin(approachAngle * Math.PI / 180) * indexLength * 0.05);

  return {
    handedness,
    fingerLengthsPx,
    fingerWidthsPx,
    palmWidthPx,
    yOffset: Math.max(-20, Math.min(-4, yOffsetDerived)),
    xOffset: Math.max(-10, Math.min(10, xOffsetDerived)),
    approachAngle,
  };
}

// ── MediaPipe Hand Detector ────────────────────────────────────────────

let handLandmarkerInstance: unknown = null;
let loadingPromise: Promise<void> | null = null;

export async function initHandDetector(): Promise<boolean> {
  if (handLandmarkerInstance) return true;
  if (typeof window === 'undefined') return false;

  if (loadingPromise) { await loadingPromise; return !!handLandmarkerInstance; }

  loadingPromise = (async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { HandLandmarker, FilesetResolver } = vision;
      const { MEDIAPIPE_WASM_URL, HAND_LANDMARKER_URL } = await import('./mediapipeRuntime');

      const filesetResolver = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

      handLandmarkerInstance = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: HAND_LANDMARKER_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch {
      handLandmarkerInstance = null;
    }
  })();

  await loadingPromise;
  loadingPromise = null;
  return !!handLandmarkerInstance;
}

export function detectHand(
  video: HTMLVideoElement,
  timestampMs: number,
): HandLandmarks[] | null {
  if (!handLandmarkerInstance) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = handLandmarkerInstance as any;
    const results = detector.detectForVideo(video, timestampMs);
    if (results?.landmarks?.length > 0) {
      return results.landmarks[0] as HandLandmarks[];
    }
  } catch { /* detection failed */ }
  return null;
}

// Singleton: keep the WASM module alive for the app's lifespan.
// Mobile Safari has known GC bugs with WebAssembly — repeatedly
// creating and destroying the WASM context causes OOM crashes.
// destroyHandDetector only pauses processing, never tears down WASM.
export function destroyHandDetector(): void {
  // Intentionally keep handLandmarkerInstance alive (singleton).
  // The WASM memory footprint (~30MB) stays allocated but idle.
  // This prevents OOM crashes from repeated init/destroy cycles
  // when the caregiver opens and closes the calibration modal.
}

// ── Calibration Session Runner ─────────────────────────────────────────

export interface CalibrationState {
  phase: 'idle' | 'scanning' | 'touch-calibration' | 'complete';
  handDetected: boolean;
  scanFrames: number;
  touchCount: number;
  targetTouches: number;
  currentTarget: { x: number; y: number; key: string } | null;
  profile: HandProfile;
}

const SCAN_FRAMES_NEEDED = 30; // ~2 seconds at 15fps
const TARGET_TOUCHES = 30;

export function createCalibrationState(): CalibrationState {
  return {
    phase: 'idle',
    handDetected: false,
    scanFrames: 0,
    touchCount: 0,
    targetTouches: TARGET_TOUCHES,
    currentTarget: null,
    profile: { ...DEFAULT_PROFILE, id: `profile-${Date.now()}`, name: '' },
  };
}

// Accumulate hand scan data from multiple frames
const scanAccumulator: Partial<HandProfile>[] = [];

export function resetScanAccumulator(): void {
  scanAccumulator.length = 0;
}

export function accumulateHandScan(landmarks: HandLandmarks[], w: number, h: number): void {
  const geo = computeHandGeometry(landmarks, w, h);
  if (geo.fingerLengthsPx) scanAccumulator.push(geo);
}

export function finalizeScan(): Partial<HandProfile> {
  if (scanAccumulator.length === 0) return {};

  // Average all scan frames
  const avg: Partial<HandProfile> = {
    fingerLengthsPx: [0, 0, 0, 0, 0],
    fingerWidthsPx: [0, 0, 0, 0, 0],
    palmWidthPx: 0,
    yOffset: 0,
    xOffset: 0,
    approachAngle: 0,
  };

  const n = scanAccumulator.length;
  for (const s of scanAccumulator) {
    for (let i = 0; i < 5; i++) {
      avg.fingerLengthsPx![i] += (s.fingerLengthsPx?.[i] ?? 0) / n;
      avg.fingerWidthsPx![i] += (s.fingerWidthsPx?.[i] ?? 0) / n;
    }
    avg.palmWidthPx! += (s.palmWidthPx ?? 0) / n;
    avg.yOffset! += (s.yOffset ?? 0) / n;
    avg.xOffset! += (s.xOffset ?? 0) / n;
    avg.approachAngle! += (s.approachAngle ?? 0) / n;
  }

  // Round values
  avg.fingerLengthsPx = avg.fingerLengthsPx!.map(v => Math.round(v));
  avg.fingerWidthsPx = avg.fingerWidthsPx!.map(v => Math.round(v));
  avg.palmWidthPx = Math.round(avg.palmWidthPx!);
  avg.yOffset = Math.round(avg.yOffset!);
  avg.xOffset = Math.round(avg.xOffset!);
  avg.approachAngle = Math.round(avg.approachAngle!);
  avg.handedness = scanAccumulator[Math.floor(n / 2)].handedness;

  scanAccumulator.length = 0;
  return avg;
}

// ── Continuous Learning (Auto-Train) ───────────────────────────────────

let continuousLearningEnabled = false;
const recentTouches: Array<{ rawX: number; rawY: number; keyX: number; keyY: number }> = [];
let rejectedCount = 0;
let totalCount = 0;
let profileDriftDetected = false;

export function isProfileDrifting(): boolean { return profileDriftDetected; }
export function clearDriftFlag(): void { profileDriftDetected = false; rejectedCount = 0; totalCount = 0; }

export function enableContinuousLearning(): void {
  continuousLearningEnabled = true;
}

export function disableContinuousLearning(): void {
  continuousLearningEnabled = false;
}

export function isContinuousLearningActive(): boolean {
  return continuousLearningEnabled;
}

export function recordContinuousTouch(rawX: number, rawY: number, keyRect: DOMRect): void {
  if (!continuousLearningEnabled) return;

  const keyCenterX = keyRect.left + keyRect.width / 2;
  const keyCenterY = keyRect.top + keyRect.height / 2;

  // Outlier rejection: during therapist/parent modeling (aided language
  // stimulation), an adult's touch geometry differs drastically from the
  // child's calibrated profile. Reject touches whose offset deviates
  // > 3x the child's established baseline to prevent profile corruption.
  const profile = getActiveProfile();
  if (profile.touchSamples > 30) {
    const dx = keyCenterX - rawX;
    const dy = keyCenterY - rawY;
    const deviation = Math.sqrt(
      (dx - profile.xOffset) ** 2 + (dy - profile.yOffset) ** 2
    );
    const baselineAmpl = Math.max(5, profile.tremorAmplPx * 3, profile.deadZonePx * 2);
    if (deviation > baselineAmpl) {
      // Track rejection rate — if > 50% rejected over 100 touches,
      // the child's motor baseline has genuinely drifted (progressive
      // condition: SMA, ALS, changing spasticity). Flag for re-calibration.
      rejectedCount++;
      totalCount++;
      if (totalCount >= 100) {
        if (rejectedCount / totalCount > 0.5) {
          profileDriftDetected = true;
        }
        rejectedCount = 0;
        totalCount = 0;
      }
      return;
    }
    totalCount++;
  }

  recentTouches.push({ rawX, rawY, keyX: keyCenterX, keyY: keyCenterY });
  if (recentTouches.length > 500) recentTouches.splice(0, 250);

  if (recentTouches.length % 50 === 0) {
    const updated = autoRefineProfile(profile);
    saveProfile(updated);
  }
}

function autoRefineProfile(profile: HandProfile): HandProfile {
  if (recentTouches.length < 30) return profile;

  const recent = recentTouches.slice(-100);
  let sumDx = 0;
  let sumDy = 0;
  for (const t of recent) {
    sumDx += t.keyX - t.rawX;
    sumDy += t.keyY - t.rawY;
  }
  const avgDx = sumDx / recent.length;
  const avgDy = sumDy / recent.length;

  const newXOffset = Math.round(profile.xOffset * 0.8 + avgDx * 0.2);
  const newYOffset = Math.round(profile.yOffset * 0.8 + avgDy * 0.2);

  return {
    ...profile,
    xOffset: Math.max(-15, Math.min(15, newXOffset)),
    yOffset: Math.max(-20, Math.min(-2, newYOffset)),
    touchSamples: profile.touchSamples + recent.length,
    lastCalibrated: new Date().toISOString(),
  };
}
