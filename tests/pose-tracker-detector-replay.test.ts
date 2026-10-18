import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import type { PoseTrackerHandle, PoseTrackerOptions, TrackingTarget } from '@/services/bodyPoseService';
import { wristNoise } from './helpers/wrist-noise';
import { MIN_WRIST_SELECTION_MS } from '@/services/wristMotion';
import { CAMERA_WRIST_SOURCE } from '@/services/cameraTrackingTargets';

// MediaPipe's documented pose indices: synthetic detector output, not
// pixel-level recognition evidence. Keep every Settings target in coverage.
const concreteTargets = [
  ['nose', 0], ['left_shoulder', 11], ['right_shoulder', 12],
  ['left_elbow', 13], ['right_elbow', 14], ['left_wrist', 15],
  ['right_wrist', 16], ['left_index', 19], ['right_index', 20],
] as const;
const aggregateTargets = [
  ['any_wrist', 15, 16, 'left_wrist', 'right_wrist'],
  ['any_index', 19, 20, 'left_index', 'right_index'],
  ['any_hand', 15, 20, 'left_wrist', 'right_index'],
] as const;
const INVALID_CAMERA_COORDINATES = [
  { name: 'left of frame', x: -0.1, y: 0.5 },
  { name: 'right of frame', x: 1.1, y: 0.5 },
  { name: 'above frame', x: 0.5, y: -0.1 },
  { name: 'non-finite X', x: NaN, y: 0.5 },
  { name: 'non-finite Y', x: 0.5, y: Infinity },
];
const NOISE_FPS = [4.5, 6, 15];
const NOISE_SIGMA = 0.01;
const NOISE_CORRELATION = 0.6;
const NOISE_SEED = 59331;
const NOISE_OBSERVATION_MS = 20_000;
const DEFAULT_DWELL_MS = 1200;
const DECODE_POLL_MS = 1000 / 15;
const SHORT_DWELL_MS = 200;
const SLOW_TRAVEL_PER_SECOND = 0.02;
const FRAME_STEP_MS = 100;
const DRIFT_RAMP_MS = 5000;
const SETTLED_SELECTION_LIMIT_MS = DRIFT_RAMP_MS + 2 * MIN_WRIST_SELECTION_MS + 2000;
const FRESH_SELECTION_FRAMES = Math.ceil(2 * MIN_WRIST_SELECTION_MS / FRAME_STEP_MS);
const VERIFIED_WRIST_HEAD = { x: 0.5, y: 0.3, visibility: 0.9 };
const RECOVERY_WRIST_X = 0.62;
// The pure mapper's 0.02 floor is stress-tested separately; saved profiles
// must pass the existing 0.05 usability guard before the control path starts.
const PROJECTED_STABILITY_CASES = [0.05, 0.1, 0.7].flatMap(range => [1, 10].flatMap(sensitivity =>
  [4.5, 15].map(fps => ({ range, sensitivity, fps }))));
const PROJECTED_SCREEN = { width: 1280, height: 720 };
const PROJECTED_STABILITY_BUDGET_PX = Math.hypot(PROJECTED_SCREEN.width, PROJECTED_SCREEN.height) * 0.004;
const PROJECTED_OBSERVATION_MS = 8000;
const PROJECTED_WARMUP_MS = 3000;
const PROJECTED_NOISE_PX = 1;
const PROJECTED_TRAVEL_PX_PER_SECOND = 8;
const PROJECTED_NOISY_TRAVEL_CASES = PROJECTED_STABILITY_CASES.flatMap(profile =>
  [0, 0.6].flatMap(correlation => [19423, 729, 59331].flatMap(seed =>
    [0.3, 0.5, 0.6, 0.7, 0.9].map(fraction => ({ ...profile, correlation, seed, fraction })))));
const NOISE_DRIFT_DURATION_MS = 30_000;
const UNBOUND_CONTROL_CALIBRATIONS = [
  { name: 'legacy', binding: {} },
  { name: 'unversioned completed pose', binding: { trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const, wizardCompleted: true } },
  { name: 'other wrist', binding: { trackingTarget: 'left_wrist' as const, orientation: 'landscape' as const, wizardCompleted: true, coordinateSource: CAMERA_WRIST_SOURCE } },
  { name: 'other orientation', binding: { trackingTarget: 'right_wrist' as const, orientation: 'portrait' as const, wizardCompleted: true, coordinateSource: CAMERA_WRIST_SOURCE } },
  { name: 'unfinished setup', binding: { trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const, wizardCompleted: false, coordinateSource: CAMERA_WRIST_SOURCE } },
];

// Mock only the detector boundary. Calibration, target resolution, real
// filters, the frame loop and dwell selection must remain production code.
const detector = vi.hoisted(() => ({
  poses: [] as Array<Array<{ x: number; y: number; visibility: number }>>,
  detect: vi.fn(),
  create: vi.fn(),
  face: [] as Array<{ x: number; y: number }>,
  faceDetect: vi.fn(),
  faceCreate: vi.fn(),
  presenceDetect: vi.fn(), presenceCreate: vi.fn(),
  verify: vi.fn(),
  verificationCrop: { x: 0, y: 0, side: 1 },
  wristConfirm: vi.fn(), wristMeasure: vi.fn(), wristStart: vi.fn(), wristClose: vi.fn(),
}));
vi.mock('@/services/wristPresence', () => ({ startWristPresence: detector.wristStart }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: {
    createFromOptions: detector.create,
  },
  FaceLandmarker: { createFromOptions: detector.faceCreate },
  FaceDetector: { createFromOptions: detector.presenceCreate },
}));

let handle: PoseTrackerHandle | undefined;
let frames: Map<number, FrameRequestCallback>;
let frameID: number;
let now: number;
let driftLevel: number;
const drift = () => driftLevel * Math.min(now / DRIFT_RAMP_MS, 1);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  window.localStorage.clear();
  frames = new Map();
  frameID = 0;
  now = 0;
  detector.poses = [];
  detector.wristConfirm.mockReset().mockReturnValue(true);
  detector.wristMeasure.mockReset().mockImplementation((frame, point, time) => detector.wristConfirm(frame, point, time) ? { ...point } : null);
  detector.wristClose.mockReset();
  detector.wristStart.mockReset().mockResolvedValue({ confirm: detector.wristConfirm, measure: detector.wristMeasure, close: detector.wristClose });
  detector.face = [];
  detector.faceDetect.mockReset().mockImplementation(() => ({ faceLandmarks: [detector.face.map(mark => ({
    x: mark.x + drift(), y: mark.y + drift() / 2,
  }))] }));
  detector.verify.mockReset().mockImplementation(() => {
      const nose = detector.poses[0]?.[0] ?? { x: 0.5, y: 0.3 };
      const crop = detector.verificationCrop;
      return { faceLandmarks: [Array.from({ length: 468 }, () => ({
        x: (nose.x * 320 - crop.x) / crop.side, y: (nose.y * 240 - crop.y) / crop.side,
      }))] };
  });
  detector.faceCreate.mockReset().mockImplementation(async (_fileset, options) => options.runningMode === 'IMAGE'
    ? { detect: detector.verify, close: vi.fn() }
    : { detectForVideo: detector.faceDetect });
  detector.detect.mockReset().mockImplementation(() => ({ landmarks: detector.poses.map(p => p.map(mark => ({
    ...mark, x: mark.x + drift(), y: mark.y + drift() / 2,
  }))) }));
  detector.create.mockReset().mockResolvedValue({ detectForVideo: detector.detect });
  detector.presenceDetect.mockReset().mockImplementation((video: HTMLCanvasElement) => {
    const nose = detector.poses[0]?.[0];
    return { detections: nose && nose.visibility >= 0.3 ? [{ categories: [{ score: 0.9 }], boundingBox: {
      originX: (nose.x - 0.15) * video.width, originY: (nose.y - 0.15) * video.height,
      width: video.width * 0.3, height: video.height * 0.3,
    } }] : [] };
  });
  detector.presenceCreate.mockReset().mockResolvedValue({ detectForVideo: detector.presenceDetect, close: vi.fn() });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameID, callback);
    return frameID;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: 1280 },
    innerHeight: { configurable: true, value: 720 },
  });
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true, value: vi.fn(() => null),
  });
  // Detector-boundary suite: ROI pixels are exercised by the real-model E2E.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: (...args: unknown[]) => {
      if (this.width === 256 && args.length === 9) detector.verificationCrop = { x: args[1] as number, y: args[2] as number, side: args[3] as number };
    } } as never;
  });
});

afterEach(() => {
  cleanup();
  handle?.stop();
  handle = undefined;
  document.body.replaceChildren();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function start(target: TrackingTarget = 'right_index', options: Partial<Pick<
  PoseTrackerOptions, 'sensitivity' | 'dwellMs' | 'useEyeGaze' | 'eyeGazeWeight' | 'selectedTargetOnly' | 'requireHeadPresence' | 'calibrationMode'
>> = {}) {
  const service = await import('@/services/bodyPoseService');
  if (options.useEyeGaze) {
    // Match a cached/warmed detector without concurrent mocked module loads.
    // The pixel E2E still covers real asynchronous model loading.
    service.initFaceLandmarkerForGazeEager();
    await vi.waitFor(() => expect(detector.faceCreate).toHaveBeenCalledTimes(1));
  }
  const video = document.createElement('video');
  Object.defineProperties(video, {
    readyState: { configurable: true, value: 4 },
    videoWidth: { value: 640 },
    videoHeight: { value: 480 },
    srcObject: { value: {} },
    currentTime: { configurable: true, get: () => now / 1000 },
  });
  const onMove = vi.fn();
  const onDwell = vi.fn();
  const onStatusChange = vi.fn();
  const onTrackingLoss = vi.fn();
  const onMotionStateChange = vi.fn();
  const onDwellLockChange = vi.fn();
  handle = service.startPoseTracker({
    dwellMs: 500, sensitivity: 5, smoothing: 0.15,
    trackingTarget: target, cursorSmoothing: 0.15,
    ...options,
    onMove, onDwell, onStatusChange, onTrackingLoss, onMotionStateChange, onDwellLockChange,
  }, undefined, video);
  await vi.waitFor(() => expect(frames.size).toBe(1));
  expect(detector.create).toHaveBeenCalledTimes(1);
  return { ...service, onMove, onDwell, onStatusChange, onTrackingLoss, onMotionStateChange, onDwellLockChange };
}

it('records the production pose input and exact emitted cursor, not a separate mocked trace', async () => {
  driftLevel = 0.003;
  const recorder = await import('@/services/trackingDiagnostics');
  expect(recorder.startTrackingDiagnostics()).toBe(true);
  const { onMove } = await start('nose');
  pose(0, 0.51, 0.5); step(4);
  recorder.stopTrackingDiagnostics();
  const report = JSON.parse(recorder.trackingDiagnosticReport());
  expect(report.frames.length).toBeGreaterThan(0);
  expect(report.frames.length).toBe(onMove.mock.calls.length);
  report.frames.forEach((frame: { pipeline: string; target: string; filtered: number[]; rawNorm: number[]; calibration: number[] }, i: number) => {
    expect(frame.pipeline).toBe('pose'); expect(frame.target).toBe('nose');
    expect(frame.filtered).toEqual(onMove.mock.calls[i]);
    expect(frame.rawNorm[0]).toBeGreaterThanOrEqual(0.51);
    expect(frame.calibration).toHaveLength(4);
  });
});

function pose(index: number, x: number, y = 0.5) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  landmarks[index] = { x, y, visibility: 0.9 };
  detector.poses = [landmarks];
}

function visibleWrist(x: number, y = 0.55) {
  pose(16, x, y);
  detector.poses[0][0] = { ...VERIFIED_WRIST_HEAD };
}

function step(count = 1) {
  for (let i = 0; i < count; i++) {
    now += 100;
    vi.advanceTimersByTime(100);
    const scheduled = [...frames.values()];
    frames.clear();
    scheduled.forEach(callback => callback(now));
  }
}
/** The camera needs fresh measurement qualification AND a fresh target hold.
 * Assert the pre-deadline state, not merely a later eventual click. */
function finishFreshWristDwell(callback: ReturnType<typeof vi.fn>, observedFrames = 3) {
  step(FRESH_SELECTION_FRAMES - observedFrames);
  expect(callback).not.toHaveBeenCalled();
  while (callback.mock.calls.length === 0 && now < SETTLED_SELECTION_LIMIT_MS) step();
  expect(callback).toHaveBeenCalledOnce(); // Recovery after the finite drift ramp, not permission to select through it.
}
async function startControlledWrist(dwellMs = DEFAULT_DWELL_MS) {
  const service = await import('@/services/bodyPoseService');
  service.savePoseCalibration({ ...service.DEFAULT_CALIBRATION, wizardCompleted: true,
    trackingTarget: 'right_wrist', orientation: 'landscape', coordinateSource: CAMERA_WRIST_SOURCE });
  return start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true, calibrationMode: 'control', dwellMs });
}

async function startProjectedWrist(range: number, sensitivity: number) {
  const service = await import('@/services/bodyPoseService');
  // The existing finite camera bias is present when the profile is captured;
  // no automatic calibration writer may later erase the selected range.
  now = DRIFT_RAMP_MS; vi.advanceTimersByTime(DRIFT_RAMP_MS);
  const centerX = 0.5 + driftLevel, centerY = 0.55 + driftLevel / 2;
  const calibration = { leftX: 1 - centerX + range / 2, rightX: 1 - centerX - range / 2,
    topY: centerY - range / 2, bottomY: centerY + range / 2,
    wizardCompleted: true, trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const, coordinateSource: CAMERA_WRIST_SOURCE };
  service.savePoseCalibration(calibration);
  return { ...await start('right_wrist', { sensitivity, selectedTargetOnly: true, requireHeadPresence: true,
    calibrationMode: 'control', dwellMs: DEFAULT_DWELL_MS }), calibration };
}

describe.each([0, 0.003, 0.015])('real pose tracker — detector replay, drift=%s frame units', level => {
  beforeEach(() => { driftLevel = level; });
  it('calibrates and maps the confirmed hand coordinate, not its coarse pose seed', async () => {
    const { subscribePoseSamples } = await startControlledWrist();
    const samples = vi.fn(); const unsubscribe = subscribePoseSamples(samples);
    detector.wristMeasure.mockImplementation(() => ({ x: 0.52 + drift(), y: 0.56 + drift() / 2 }));
    visibleWrist(0.5); step(5);
    expect(samples).toHaveBeenLastCalledWith(expect.objectContaining({ normX: 0.52 + drift(), normY: 0.56 + drift() / 2 }));
    unsubscribe();
  });
  it('cannot move, collect calibration samples or select from an inferred hidden wrist', async () => {
    const { onMove, onDwell, onTrackingLoss, subscribePoseSamples } = await startControlledWrist();
    const samples = vi.fn(); const unsubscribe = subscribePoseSamples(samples);
    const button = document.createElement('button'); document.body.append(button);
    const click = vi.fn(); button.addEventListener('click', click);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    visibleWrist(0.5); detector.wristConfirm.mockReturnValue(false);
    step(80);
    expect(onMove).not.toHaveBeenCalled(); expect(samples).not.toHaveBeenCalled();
    expect(onDwell).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
    expect(onTrackingLoss).toHaveBeenLastCalledWith('wrist-missing');
    button.click(); expect(click).toHaveBeenCalledOnce();
    unsubscribe();
  });
  it('a missed hand frame cancels unfinished selection and visible-hand recovery needs a fresh hold', async () => {
    const { onMove, onDwell } = await startControlledWrist();
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    visibleWrist(0.5); step(10); expect(onDwell).not.toHaveBeenCalled();
    const beforeLoss = onMove.mock.calls.length;
    detector.wristConfirm.mockReturnValue(false); step(20);
    expect(onMove).toHaveBeenCalledTimes(beforeLoss); expect(onDwell).not.toHaveBeenCalled();
    detector.wristConfirm.mockReturnValue(true); step(7);
    expect(onDwell).not.toHaveBeenCalled();
    finishFreshWristDwell(onDwell, 7);
    step(30); expect(onDwell).toHaveBeenCalledOnce();
  });
  it('confirms hand pixels from the head-qualified pose snapshot, never an independent video frame', async () => {
    const { onMove } = await startControlledWrist();
    visibleWrist(0.5); step();
    expect(onMove).toHaveBeenCalledOnce();
    expect(detector.wristConfirm.mock.calls[0][0]).toBe(detector.detect.mock.calls[0][0]);
    expect(detector.wristConfirm.mock.calls[0][0]).toBeInstanceOf(HTMLCanvasElement);
    detector.poses[0][0].visibility = 0; step();
    expect(detector.wristConfirm).toHaveBeenCalledOnce();
  });
  it('refuses hand evidence when combined local inference outlives the existing frame-freshness bound', async () => {
    const { onMove, onDwell, onTrackingLoss } = await startControlledWrist();
    visibleWrist(0.5);
    detector.wristConfirm.mockImplementationOnce(() => { vi.advanceTimersByTime(500); return true; });
    step();
    expect(onMove).not.toHaveBeenCalled(); expect(onDwell).not.toHaveBeenCalled();
    expect(onTrackingLoss).toHaveBeenLastCalledWith('camera-frame-stale');
    step(); expect(onMove).toHaveBeenCalledOnce();
  });
  it.each(PROJECTED_STABILITY_CASES)('keeps actual screen-space rest stable when projected input noise is within budget: %j', async ({ range, sensitivity, fps }) => {
    const { onMove, onMotionStateChange } = await startProjectedWrist(range, sensitivity);
    const gain = Math.max(PROJECTED_SCREEN.width, PROJECTED_SCREEN.height) * (sensitivity / 5) / range;
    const next = wristNoise(NOISE_SEED, fps, PROJECTED_NOISE_PX / gain, NOISE_CORRELATION, 0);
    let sample = next(), frameTime = 0;
    Object.defineProperty(handle!.videoElement!, 'currentTime', { get: () => frameTime / 1000 });
    const points: number[][] = [];
    for (let elapsed = 0; elapsed < PROJECTED_OBSERVATION_MS; elapsed += DECODE_POLL_MS) {
      if (elapsed >= sample.time) {
        frameTime = sample.time; visibleWrist(sample.point.x, sample.point.y + 0.05); sample = next();
      }
      now += DECODE_POLL_MS; vi.advanceTimersByTime(DECODE_POLL_MS);
      const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now));
      if (elapsed >= PROJECTED_WARMUP_MS && onMove.mock.calls.length) points.push(onMove.mock.calls.at(-1)!);
    }
    expect(points.length).toBeGreaterThan(20);
    for (const [x, y] of points) expect(Math.hypot(x - PROJECTED_SCREEN.width / 2, y - PROJECTED_SCREEN.height / 2)).toBeLessThan(PROJECTED_STABILITY_BUDGET_PX);
    expect(onMotionStateChange.mock.calls.some(call => call[0].selectionReady)).toBe(true);
  });
  it.each(PROJECTED_STABILITY_CASES)('does not select a broad target during slow calibrated screen travel: %j', async ({ range, sensitivity, fps }) => {
    const { onMove, onDwell } = await startProjectedWrist(range, sensitivity);
    const gain = PROJECTED_SCREEN.width * (sensitivity / 5) / range;
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    const clicked = vi.fn(); button.addEventListener('click', clicked);
    let frameTime = 0;
    Object.defineProperty(handle!.videoElement!, 'currentTime', { get: () => frameTime / 1000 });
    for (let elapsed = 0; elapsed < PROJECTED_OBSERVATION_MS; elapsed += DECODE_POLL_MS) {
      if (elapsed - frameTime >= 1000 / fps) {
        frameTime = elapsed;
        visibleWrist(0.5 + PROJECTED_TRAVEL_PX_PER_SECOND * elapsed / 1000 / gain);
      }
      now += DECODE_POLL_MS; vi.advanceTimersByTime(DECODE_POLL_MS);
      const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now));
    }
    expect(onDwell).not.toHaveBeenCalled(); expect(clicked).not.toHaveBeenCalled();
    expect(onMove.mock.calls.length).toBeGreaterThan(20);
    const end = onMove.mock.calls.at(-1)!;
    const truthX = PROJECTED_SCREEN.width / 2 - PROJECTED_TRAVEL_PX_PER_SECOND * frameTime / 1000;
    expect(Math.abs(end[0] - truthX)).toBeLessThan(PROJECTED_STABILITY_BUDGET_PX);
    button.click(); expect(clicked).toHaveBeenCalledOnce();
  });
  it.each(PROJECTED_NOISY_TRAVEL_CASES)('does not select a broad target during noisy slow calibrated screen travel: %j', async ({ range, sensitivity, fps, correlation, seed, fraction }) => {
    const { onMove, onDwell } = await startProjectedWrist(range, sensitivity);
    const gain = PROJECTED_SCREEN.width * (sensitivity / 5) / range;
    const sigma = fraction * PROJECTED_STABILITY_BUDGET_PX / gain;
    const travel = PROJECTED_TRAVEL_PX_PER_SECOND * NOISE_DRIFT_DURATION_MS / 1000 / gain;
    const next = wristNoise(seed, fps, sigma, correlation, travel);
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    const clicked = vi.fn(); button.addEventListener('click', clicked);
    let frameTime = 0, sample = next();
    Object.defineProperty(handle!.videoElement!, 'currentTime', { get: () => frameTime / 1000 });
    for (let elapsed = 0; elapsed < PROJECTED_OBSERVATION_MS; elapsed += DECODE_POLL_MS) {
      if (elapsed >= sample.time) {
        frameTime = sample.time; visibleWrist(sample.point.x, sample.point.y + 0.05); sample = next();
      }
      now += DECODE_POLL_MS; vi.advanceTimersByTime(DECODE_POLL_MS);
      const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now));
    }
    expect(onMove.mock.calls.length).toBeGreaterThan(20);
    expect(onDwell).not.toHaveBeenCalled(); expect(clicked).not.toHaveBeenCalled();
    button.click(); expect(clicked).toHaveBeenCalledOnce();
  });
  it('holds the actual emitted cursor through an isolated wrist outlier immediately after head loss', async () => {
    const { onMove, onTrackingLoss, onMotionStateChange, onDwell, mapPoseToScreen, DEFAULT_CALIBRATION } = await startControlledWrist();
    visibleWrist(0.5); step(80); // The finite fixture drift has settled before the loss.
    const before = onMove.mock.calls.at(-1)!;
    const moves = onMove.mock.calls.length;
    detector.poses = []; step();
    visibleWrist(RECOVERY_WRIST_X); step();
    expect(onTrackingLoss).toHaveBeenLastCalledWith('wrist-unstable');
    expect(onMove).toHaveBeenCalledTimes(moves); // No filter/slew excursion toward the bad recovery sample.
    visibleWrist(0.5); step();
    const after = onMove.mock.calls.at(-1)!;
    const truth = mapPoseToScreen(0.5 + level, 0.55 + level / 2, DEFAULT_CALIBRATION, 1, 1280, 720);
    // The old rest latch can be slightly behind this fixture's finite drift.
    // Recovery may converge toward the real point, never away toward the outlier.
    const error = (point: number[]) => Math.hypot(point[0] - truth.x, point[1] - truth.y);
    expect(error(after)).toBeLessThanOrEqual(error(before) + 1e-6);
    expect(onMotionStateChange.mock.calls.at(-1)![0].selectionReady).toBe(false);
    expect(onDwell).not.toHaveBeenCalled();
  });
  it('conditions wrist observations using captured media time, not variable inference completion time', async () => {
    const { WristMotion } = await import('@/services/wristMotion');
    const update = vi.spyOn(WristMotion.prototype, 'update');
    const recorder = await import('@/services/trackingDiagnostics'); recorder.startTrackingDiagnostics();
    await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    detector.detect.mockImplementation(() => { vi.advanceTimersByTime(40); return { landmarks: detector.poses }; });
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
    step(3);
    expect(update.mock.calls.map(call => call[1])).toEqual([100, 200, 300]);
    recorder.stopTrackingDiagnostics();
    expect(JSON.parse(recorder.trackingDiagnosticReport()).frames.map((f: { motionTimeMs: number }) => f.motionTimeMs)).toEqual([100, 200, 300]);
  });
  it('a media-time discontinuity at normal poll cadence cancels unfinished dwell', async () => {
    const { onDwell } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true, dwellMs: DEFAULT_DWELL_MS });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
    step(10); expect(onDwell).not.toHaveBeenCalled();
    Object.defineProperty(handle!.videoElement!, 'currentTime', { get: () => now / 1000 + 0.52 });
    step(7); // The old hold would have expired; a new qualified hold has not.
    expect(onDwell).not.toHaveBeenCalled();
    finishFreshWristDwell(onDwell, 7);
  });
  it.each(NOISE_FPS)('keeps cursor and manual selection usable while correlated jitter at %s fps blocks automatic selection', async fps => {
    const { onDwell, onTrackingLoss } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true, dwellMs: DEFAULT_DWELL_MS });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    const click = vi.fn(); button.addEventListener('click', click);
    const next = wristNoise(NOISE_SEED, fps, NOISE_SIGMA, NOISE_CORRELATION, level);
    let sample = next(), frameTime = 0;
    Object.defineProperty(handle!.videoElement!, 'currentTime', { get: () => frameTime / 1000 });
    for (let elapsed = 0; elapsed < NOISE_OBSERVATION_MS && onDwell.mock.calls.length === 0; elapsed += DECODE_POLL_MS) {
      if (elapsed >= sample.time) {
        frameTime = sample.time;
        pose(16, sample.point.x, sample.point.y);
        detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
        sample = next();
      }
      now += DECODE_POLL_MS; vi.advanceTimersByTime(DECODE_POLL_MS);
      const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now));
    }
    expect(onTrackingLoss.mock.calls.some(call => call[0] === 'camera-frame-stale')).toBe(false);
    expect(onDwell).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
    button.click(); expect(click).toHaveBeenCalledOnce(); // Manual AAC is not withdrawn with uncertain camera selection.
  });
  it.each([SHORT_DWELL_MS, DEFAULT_DWELL_MS])('does not select a broad target during correlated noisy travel with dwell=%s', async dwellMs => {
    const { onDwell } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true, dwellMs });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    const next = wristNoise(NOISE_SEED, 6, NOISE_SIGMA, NOISE_CORRELATION, level);
    let sample = next(), frameTime = 0;
    Object.defineProperty(handle!.videoElement!, 'currentTime', { get: () => frameTime / 1000 });
    for (let elapsed = 0; elapsed < 10_000; elapsed += DECODE_POLL_MS) {
      if (elapsed >= sample.time) {
        frameTime = sample.time;
        pose(16, sample.point.x - 0.2 + SLOW_TRAVEL_PER_SECOND * sample.time / 1000, sample.point.y);
        detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
        sample = next();
      }
      now += DECODE_POLL_MS; vi.advanceTimersByTime(DECODE_POLL_MS);
      const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now));
    }
    expect(onDwell).not.toHaveBeenCalled();
  });
  it.each([SHORT_DWELL_MS, DEFAULT_DWELL_MS])('departure from a mature low-noise pause cannot select a newly encountered target, dwell=%s', async dwellMs => {
    const { onDwell, onMotionStateChange } = await startControlledWrist(dwellMs);
    pose(16, 0.4, 0.55); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(60);
    expect(onMotionStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ selectionReady: true }));
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    for (let i = 1; i <= 20; i++) {
      pose(16, 0.4 + i * 0.002, 0.55); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step();
    }
    expect(onDwell).not.toHaveBeenCalled();
  });
  it('a short legacy dwell can still select a quiet target, but not before the fresh camera minimum', async () => {
    now = DRIFT_RAMP_MS; vi.advanceTimersByTime(DRIFT_RAMP_MS); // The same drift offset is present, now stationary.
    const { onDwell } = await startControlledWrist(SHORT_DWELL_MS);
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
    step(FRESH_SELECTION_FRAMES); expect(onDwell).not.toHaveBeenCalled();
    step(); expect(onDwell).toHaveBeenCalledOnce();
  });
  it('observed cursor departure during non-ready motion rearms the same symbol after a fresh hold', async () => {
    const { onMove, onDwell, onMotionStateChange, onDwellLockChange } = await startControlledWrist();
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(80);
    const [x, y] = onMove.mock.calls.at(-1)!;
    const button = document.createElement('button'); document.body.append(button);
    const rect = new DOMRect(x - 48, y - 48, 96, 96);
    vi.mocked(document.elementFromPoint).mockImplementation((cx, cy) =>
      cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom ? button : null);
    step(16); expect(onDwell).toHaveBeenCalledOnce();
    const firstDeparture = onMove.mock.calls.length;
    for (let i = 1; i <= 8; i++) {
      pose(16, 0.5 + i * 0.01); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step();
    }
    expect(onMove.mock.calls.slice(firstDeparture).some(([cx, cy]) => !document.elementFromPoint(cx, cy))).toBe(true);
    expect(onMotionStateChange.mock.calls.slice(firstDeparture).some(([motion]) => motion.selectionReady === false)).toBe(true);
    for (let i = 7; i >= 0; i--) {
      pose(16, 0.5 + i * 0.01); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step();
    }
    expect(onDwell).toHaveBeenCalledOnce(); step(60);
    expect(onDwellLockChange.mock.calls.map(([el]) => el ? 'target' : 'reset')).toEqual(['target', 'reset', 'target']);
    expect(onDwell).toHaveBeenCalledTimes(2);
  });
  // A lost frame is not an observed departure: a completed selection must stay locked through head loss, wrist loss or a
  // detector error, so a cursor that never left the symbol cannot select it a second time when tracking recovers.
  it.each(['head', 'wrist', 'hand confirmation', 'detector error'] as const)('keeps a completed selection locked through %s loss without departure', async (loss) => {
    const { onMove, onDwellLockChange } = await startControlledWrist();
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(80);
    const [x, y] = onMove.mock.calls.at(-1)!;
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    const rect = new DOMRect(x - 48, y - 48, 96, 96);
    vi.mocked(document.elementFromPoint).mockImplementation((cx, cy) =>
      cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom ? button : null);
    step(16); expect(clicks).toHaveBeenCalledOnce();
    const afterSelection = onMove.mock.calls.length;
    if (loss === 'head') detector.poses[0][0].visibility = 0;
    if (loss === 'wrist') detector.poses[0][16].visibility = 0;
    if (loss === 'hand confirmation') detector.wristConfirm.mockReturnValueOnce(false);
    if (loss === 'detector error') detector.detect.mockImplementationOnce(() => { throw new Error('transient model failure'); });
    step();
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(60);
    // The cursor stayed on the symbol the whole time, so nothing may count as a departure.
    expect(onMove.mock.calls.slice(afterSelection).every(([cx, cy]) => document.elementFromPoint(cx, cy) === button)).toBe(true);
    expect(clicks).toHaveBeenCalledOnce();
    expect(onDwellLockChange.mock.calls.map(([el]) => el ? 'target' : 'reset')).toEqual(['target']);
  });
  it('does not select a large button while the wrist keeps travelling through tremor', async () => {
    const { onDwell } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    for (let i = 0; i < 35; i++) {
      const jitter = i % 2 ? 0.015 : -0.015;
      pose(16, 0.4 + i * 0.002 + jitter, 0.55 + jitter);
      detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step();
    }
    expect(onDwell).not.toHaveBeenCalled();
  });
  it('a low-noise measured pause can select exactly once without requiring perfect stillness', async () => {
    // Exercise the actual overlay contract: a confirmed, fixed wrist profile.
    // The legacy bootstrap path changes gain while learning and may correctly
    // withhold selection when its projected noise exceeds the pixel budget.
    const { onDwell } = await startControlledWrist();
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    for (let i = 0; i < Math.ceil(SETTLED_SELECTION_LIMIT_MS / FRAME_STEP_MS); i++) {
      const jitter = i % 2 ? 0.001 : -0.001;
      pose(16, 0.5 + jitter, 0.55 + jitter);
      detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step();
    }
    expect(onDwell).toHaveBeenCalledOnce();
  });
  it('an explicit control recenter requires a fresh dwell even on the same button', async () => {
    const service = await import('@/services/bodyPoseService');
    const cal = { ...service.DEFAULT_CALIBRATION, wizardCompleted: true,
      trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const, coordinateSource: CAMERA_WRIST_SOURCE };
    service.savePoseCalibration(cal);
    const { onDwell } = await start('right_wrist', { calibrationMode: 'control', selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
    step(3);
    handle!.setCalibration({ ...cal, leftX: 0.66, rightX: 0.34 });
    step(3);
    expect(onDwell).not.toHaveBeenCalled();
    finishFreshWristDwell(onDwell);
  });
  it.each(UNBOUND_CONTROL_CALIBRATIONS)('control rejects $name calibration before detector/camera startup', async ({ binding }) => {
    const service = await import('@/services/bodyPoseService');
    const saved = { ...service.DEFAULT_CALIBRATION, ...binding };
    service.savePoseCalibration(saved);
    const onMove = vi.fn(), onStatusChange = vi.fn();
    handle = service.startPoseTracker({ dwellMs: 500, sensitivity: 5, smoothing: 0.15,
      trackingTarget: 'right_wrist', cursorSmoothing: 0.15, calibrationMode: 'control',
      selectedTargetOnly: true, requireHeadPresence: true, onMove, onDwell: vi.fn(), onStatusChange });
    step(10);
    expect(onStatusChange).toHaveBeenLastCalledWith('stopped');
    expect(detector.create).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    expect(service.loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(saved);
  });
  it.each(['setup', 'control'] as const)('%s prevents both automatic mapping writers but preserves explicit calibration and noise learning', async calibrationMode => {
    const service = await import('@/services/bodyPoseService');
    const initialCal = { ...service.DEFAULT_CALIBRATION, wizardCompleted: true,
      trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const, coordinateSource: CAMERA_WRIST_SOURCE };
    service.savePoseCalibration(initialCal);
    const { BaselineTracker } = await import('@/services/recalibration');
    const correction = vi.spyOn(BaselineTracker.prototype, 'suggestCorrection').mockReturnValue({
      kind: 'offset', deltaNormX: 0.1, deltaNormY: 0.1,
    });
    const noise = vi.spyOn(BaselineTracker.prototype, 'getNoiseFloor');
    const acceptedCorrection = vi.spyOn(BaselineTracker.prototype, 'acceptCorrection');
    const diagnostics = await import('@/services/trackingDiagnostics');
    diagnostics.startTrackingDiagnostics();
    const { onMove } = await start('right_wrist', { calibrationMode, selectedTargetOnly: true, requireHeadPresence: true });
    for (let i = 0; i < 180; i++) {
      pose(16, 0.45 + Math.sin(i / 9) * 0.12, 0.55);
      detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
      step();
    }
    diagnostics.stopTrackingDiagnostics();
    const captured = JSON.parse(diagnostics.trackingDiagnosticReport());
    expect(captured.frames).toHaveLength(180);
    expect(captured.frames.every((frame: { calibration: number[] }) => JSON.stringify(frame.calibration) === JSON.stringify([
      initialCal.leftX, initialCal.rightX, initialCal.topY, initialCal.bottomY,
    ]))).toBe(true);
    expect(correction).toHaveBeenCalled();
    expect(acceptedCorrection).not.toHaveBeenCalled();
    // Selected wrists estimate short-window jitter, not whole-position variance.
    expect(captured.frames.some((frame: { noise: number }) => Number.isFinite(frame.noise))).toBe(true);
    expect(captured.frames.some((frame: { noise: number }) => frame.noise > 0)).toBe(true);
    expect(service.loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(initialCal);
    const explicit = { ...initialCal, leftX: 0.66, rightX: 0.34 };
    handle!.setCalibration(explicit);
    expect(service.loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(explicit);
    expect(service.hasPoseCalibrationForTarget('right_wrist')).toBe(true);
    expect(service.hasPoseCalibrationForTarget('left_wrist')).toBe(false);
    expect(() => handle!.setCalibration({ ...explicit, trackingTarget: 'left_wrist' })).toThrow();
    expect(() => handle!.setCalibration({ ...explicit, leftX: NaN })).toThrow();
    expect(service.loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(explicit);
    if (calibrationMode === 'setup') {
      const { computeCenterPreviewCalibration } = await import('@/services/wizardCalibration');
      const draft = service.beginPoseCalibrationDraft(CAMERA_WRIST_SOURCE);
      const centered = { ...computeCenterPreviewCalibration({ normX: 0.5, normY: 0.55 }),
        wizardCompleted: true, trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const, coordinateSource: CAMERA_WRIST_SOURCE };
      handle!.setCalibration(centered);
      // Center-only access must stay available without requiring four corners.
      expect(JSON.parse(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`)!)).toEqual(explicit);
      draft.commit('landscape');
      expect(service.loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(centered);
      pose(16, 0.5 - drift(), 0.55 - drift() / 2);
      detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
      step(2); // A far new physical observation must confirm, even after an explicit map change.
      expect(onMove.mock.calls.at(-1)![0]).toBeCloseTo(window.innerWidth / 2);
      expect(onMove.mock.calls.at(-1)![1]).toBeCloseTo(window.innerHeight / 2);
    } else {
      const moves = onMove.mock.calls.length;
      Object.defineProperties(window, { innerWidth: { configurable: true, value: 720 },
        innerHeight: { configurable: true, value: 1280 } });
      step(5);
      expect(onMove).toHaveBeenCalledTimes(moves);
      expect(service.hasPoseCalibrationForTarget('right_wrist')).toBe(false);
    }
  });
  it.each([['left_wrist', 15, 16], ['right_wrist', 16, 15]] as const)('strict %s never switches to the opposite wrist or visible head', async (target, selected, other) => {
    const { onMove, onStatusChange } = await start(target, { selectedTargetOnly: true, requireHeadPresence: true });
    pose(selected, 0.5);
    detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.99 };
    for (let frame = 0; frame < 20; frame++) {
      detector.poses[0][0].x = frame % 2 ? 0.3 : 0.7;
      detector.poses[0][other] = { x: frame % 2 ? 0.2 : 0.8, y: 0.8, visibility: 0.99 };
      step();
    }
    expect(onMove).toHaveBeenCalledTimes(20);
    expect(onStatusChange.mock.calls.filter(call => call[0] === 'tracking').every(call => call[1] === target)).toBe(true);
    detector.poses[0][selected].visibility = 0.2;
    const moves = onMove.mock.calls.length;
    step(5);
    expect(onMove).toHaveBeenCalledTimes(moves);
    expect(onStatusChange).toHaveBeenLastCalledWith('lost');
  });

  it('strict wrist stops movement and cancels pending selection when head presence is lost', async () => {
    const { onMove, onDwell, onStatusChange } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5);
    detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
    step(3);
    const moves = onMove.mock.calls.length;
    detector.poses[0][0].visibility = 0;
    step(8);
    expect(onStatusChange).toHaveBeenLastCalledWith('lost');
    expect(onMove).toHaveBeenCalledTimes(moves);
    expect(onDwell).not.toHaveBeenCalled();
    detector.poses[0][0].visibility = 0.9;
    step(3);
    expect(onDwell).not.toHaveBeenCalled();
    finishFreshWristDwell(onDwell);
  });
  it('a pose-model phantom nose cannot unlock wrist inference without a fresh detected face', async () => {
    detector.presenceDetect.mockReturnValue({ detections: [] });
    const { onMove, onDwell, onStatusChange } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.999 };
    step(8);
    expect(detector.detect).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled(); expect(onDwell).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith('lost');
  });
  it('an unverified coarse face pauses wrist inference and resets the pending selection', async () => {
    const recorder = await import('@/services/trackingDiagnostics'); recorder.startTrackingDiagnostics();
    const { onMove, onDwell } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(3);
    const verification = detector.verify.getMockImplementation()!;
    const moves = onMove.mock.calls.length, poses = detector.detect.mock.calls.length;
    detector.verify.mockReturnValue({ faceLandmarks: [] }); step(8);
    expect(onMove).toHaveBeenCalledTimes(moves); expect(detector.detect).toHaveBeenCalledTimes(poses);
    expect(onDwell).not.toHaveBeenCalled();
    expect(JSON.parse(recorder.trackingDiagnosticReport()).states).toContainEqual(expect.objectContaining({ status: 'lost', reason: 'head-unverified' }));
    detector.verify.mockImplementation(verification); step(3); expect(onDwell).not.toHaveBeenCalled();
    finishFreshWristDwell(onDwell);
    recorder.stopTrackingDiagnostics();
  });
  it('a stopped camera clock cannot finish a dwell from previously confirmed head pixels', async () => {
    const { onMove, onDwell } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(3);
    const v = handle!.videoElement!;
    Object.defineProperty(v, 'currentTime', { configurable: true, value: now / 1000 });
    const moves = onMove.mock.calls.length, poses = detector.detect.mock.calls.length;
    step(8);
    expect(onMove).toHaveBeenCalledTimes(moves); expect(detector.detect).toHaveBeenCalledTimes(poses);
    expect(onDwell).not.toHaveBeenCalled();
    Object.defineProperty(v, 'currentTime', { get: () => now / 1000 });
    step(3); expect(onDwell).not.toHaveBeenCalled(); finishFreshWristDwell(onDwell);
  });
  it('a camera with no decoded frame reports loss and cannot retain a partial hold', async () => {
    const { onMove, onDwell, onStatusChange, onTrackingLoss } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(7);
    const moves = onMove.mock.calls.length;
    Object.defineProperty(handle!.videoElement!, 'readyState', { configurable: true, value: 1 });
    step(8);
    expect(onStatusChange).toHaveBeenLastCalledWith('lost');
    expect(onTrackingLoss).toHaveBeenLastCalledWith('camera-frame-stale');
    expect(onMove).toHaveBeenCalledTimes(moves); expect(onDwell).not.toHaveBeenCalled();
    Object.defineProperty(handle!.videoElement!, 'readyState', { value: 4 });
    step(3); expect(onDwell).not.toHaveBeenCalled();
    finishFreshWristDwell(onDwell);
  });
  it('fresh face presence does not depend on pose nose visibility', async () => {
    const { onMove } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    detector.presenceDetect.mockReturnValue({ detections: [{ categories: [{ score: 0.9 }],
      boundingBox: { originX: 120, originY: 48, width: 80, height: 48 } }] });
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.01 }; step(4);
    expect(onMove).toHaveBeenCalledTimes(4);
    const snapshot = detector.detect.mock.calls[0][0];
    expect(snapshot).toBeInstanceOf(HTMLCanvasElement);
    expect(snapshot.width).toBe(640); expect(snapshot.height).toBe(480);
  });
  it('a detector error cancels pending dwell instead of counting unobserved time', async () => {
    const { onDwell } = await start('right_wrist', { selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; step(3);
    detector.presenceDetect.mockImplementation(() => { throw new Error('test detector failure'); }); step(8);
    detector.presenceDetect.mockReturnValue({ detections: [{ categories: [{ score: 0.9 }],
      boundingBox: { originX: 120, originY: 48, width: 80, height: 48 } }] });
    step(3); expect(onDwell).not.toHaveBeenCalled(); finishFreshWristDwell(onDwell);
  });
  it.each(INVALID_CAMERA_COORDINATES)('rejects $name even with high visibility', async ({ x, y }) => {
    const { onMove, onStatusChange } = await start('right_index');
    pose(20, x, y); step(6);
    expect(onMove).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith('lost');
  });
  it('retains a valid head fallback when the requested finger is outside the camera frame', async () => {
    const { onStatusChange } = await start('right_index');
    pose(20, 0.243, 1.767);
    detector.poses[0][0] = { x: 0.5, y: 0.5, visibility: 0.9 };
    step(5);
    expect(onStatusChange).toHaveBeenLastCalledWith('tracking', 'nose');
  });
  it.each(concreteTargets)('rejects off-frame %s rather than moving or dwelling on an extrapolated landmark', async (target, index) => {
    const { onMove, onDwell, onStatusChange } = await start(target);
    pose(index, 0.243, 1.767); step(6);
    expect(onMove).not.toHaveBeenCalled();
    expect(onDwell).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith('lost');
    pose(index, 0.5, 0.5); step(3);
    expect(onStatusChange).toHaveBeenLastCalledWith('tracking', target);
    expect(onMove).toHaveBeenCalled();
  });
  it.each(aggregateTargets)('%s ignores a high-visibility off-frame side and retains the in-frame side', async (target, first, second, firstTarget, secondTarget) => {
    const { onStatusChange } = await start(target);
    pose(first, 0.243, 1.767);
    detector.poses[0][second] = { x: 0.5, y: 0.5, visibility: 0.4 };
    step(5);
    expect(onStatusChange).toHaveBeenLastCalledWith('tracking', secondTarget);
    expect(onStatusChange).not.toHaveBeenCalledWith('tracking', firstTarget);
  });
  it('keeps a completed native selection locked through overlay → scanner → overlay until observed departure', async () => {
    await start('nose');
    const service = await import('@/services/bodyPoseService');
    handle!.stop(); frames.clear();
    const video = document.createElement('video');
    Object.defineProperties(video, { readyState: { value: 4 }, videoWidth: { value: 640 },
      videoHeight: { value: 480 }, srcObject: { value: {} }, currentTime: { get: () => now / 1000 } });
    const realStart = service.startPoseTracker;
    const startSpy = vi.spyOn(service, 'startPoseTracker').mockImplementation(options => {
      handle = realStart(options, undefined, video); return handle;
    });
    vi.spyOn(service, 'isPoseTrackingSupported').mockReturnValue(true);
    const { useSettingsStore } = await import('@/store/settingsStore');
    useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: 'right_wrist', headTrackingDwellMs: 500 });
    service.savePoseCalibration({ ...service.DEFAULT_CALIBRATION, wizardCompleted: true,
      trackingTarget: 'right_wrist', orientation: 'landscape', coordinateSource: CAMERA_WRIST_SOURCE });
    const { default: Overlay } = await import('@/components/CameraInputOverlay');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    const view = render(createElement(Overlay));
    expect(startSpy).toHaveBeenCalledTimes(1);
    await act(() => vi.waitFor(() => expect(frames.size).toBeGreaterThan(0)));
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; act(() => step(FRESH_SELECTION_FRAMES));
    expect(clicks).not.toHaveBeenCalled();
    while (clicks.mock.calls.length === 0 && now < SETTLED_SELECTION_LIMIT_MS) act(() => step());
    expect(clicks).toHaveBeenCalledTimes(1);
    const { suspendCameraSelection } = await import('@/services/cameraSelection');
    let release!: () => void;
    act(() => { release = suspendCameraSelection(); });
    try {
      act(() => step(20));
      expect(clicks).toHaveBeenCalledTimes(1);
    } finally { act(() => release()); }
    act(() => step(15));
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(clicks).toHaveBeenCalledTimes(1);
    pose(16, 0.85); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; act(() => step());
    expect(view.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'lost');
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; act(() => step(40));
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(view.container.querySelectorAll('circle[stroke-dasharray]')).toHaveLength(0); // A held/rejected frame didn't release the service lock.
    vi.mocked(document.elementFromPoint).mockReturnValue(null); act(() => step());
    vi.mocked(document.elementFromPoint).mockReturnValue(button); act(() => step(14));
    expect(clicks).toHaveBeenCalledTimes(2);
    view.unmount(); vi.restoreAllMocks();
  });
  it('camera ownership cancels pending body dwell but preserves manual access and fresh rearming', async () => {
    const { onMove, onDwell } = await start('nose');
    const { suspendCameraSelection } = await import('@/services/cameraSelection');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(0, 0.5); step(4);
    const release = suspendCameraSelection();
    try {
      step(20); expect(clicks).not.toHaveBeenCalled(); expect(onDwell).not.toHaveBeenCalled();
      expect(onMove).toHaveBeenCalled();
      button.click(); expect(clicks).toHaveBeenCalledTimes(1); clicks.mockClear();
    } finally { release(); }
    step(5); expect(clicks).not.toHaveBeenCalled();
    step(); expect(clicks).toHaveBeenCalledTimes(1);
    step(20); expect(clicks).toHaveBeenCalledTimes(1);
  });
  it('does not deliver body native clicks across a completion callback ownership cycle', async () => {
    const { onDwell } = await start('nose');
    const { suspendCameraSelection } = await import('@/services/cameraSelection');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    onDwell.mockImplementationOnce(() => { const release = suspendCameraSelection(); release(); });
    pose(0, 0.5); step(6);
    expect(onDwell).toHaveBeenCalledTimes(1); expect(clicks).not.toHaveBeenCalled();
    step(5); expect(clicks).not.toHaveBeenCalled();
    step(); expect(clicks).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])('neutral gaze stays centered and deliberate eye movement is retained, eye gaze=%s', async useEyeGaze => {
    detector.face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    detector.face[468] = { x: 0.54, y: 0.4 };
    detector.face[473] = { x: 0.54, y: 0.4 };
    const { onMove } = await start('nose', { useEyeGaze, eyeGazeWeight: 0.8 });
    handle!.setCalibration({ leftX: 0.85, rightX: 0.15, topY: 0.2, bottomY: 0.8, wizardCompleted: true });
    pose(0, 0.5, 0.5); step(10);
    const [neutralX, neutralY] = onMove.mock.calls.at(-1)!;
    expect(Math.abs(neutralX - 640)).toBeLessThan(25);
    expect(Math.abs(neutralY - 360)).toBeLessThan(25);
    // Anatomical iris/nose offset is not eye movement. Only an actual
    // change relative to the initial gaze should add a cursor offset.
    detector.face[468] = { x: 0.56, y: 0.42 };
    detector.face[473] = { x: 0.56, y: 0.42 };
    step(15);
    const [movedX, movedY] = onMove.mock.calls.at(-1)!;
    if (useEyeGaze) {
      expect(detector.faceDetect).toHaveBeenCalled();
      expect(movedX).toBeLessThan(neutralX - 100);
      expect(movedY).toBeGreaterThan(neutralY + 100);
    } else {
      expect(detector.faceDetect).not.toHaveBeenCalled();
      expect(Math.abs(movedX - neutralX)).toBeLessThan(25);
      expect(Math.abs(movedY - neutralY)).toBeLessThan(25);
    }
  });
  it.each(concreteTargets)('follows independent %s movement without requiring the whole body to move', async (target, index) => {
      const { onMove, onStatusChange } = await start(target);
      pose(index, 0.6, 0.5);
      step();
      const [centerX, centerY] = onMove.mock.calls.at(-1)!;
      expect(Math.abs(centerX - 640)).toBeLessThan(20);
      // Continuous limited-range motion, not a teleporting cursor callback.
      for (let frame = 1; frame <= 15; frame++) {
        pose(index, 0.6 - 0.1 * frame / 15, 0.5 - 0.1 * frame / 15); step();
      }
      const [rightX, upY] = onMove.mock.calls.at(-1)!;
      expect(rightX).toBeGreaterThan(centerX + 100);
      expect(upY).toBeLessThan(centerY - 70);
      for (let frame = 1; frame <= 20; frame++) {
        pose(index, 0.5 + 0.2 * frame / 20, 0.4 + 0.2 * frame / 20); step();
      }
      expect(onMove.mock.calls.at(-1)![0]).toBeLessThan(centerX - 70);
      expect(onMove.mock.calls.at(-1)![1]).toBeGreaterThan(centerY + 70);
      expect(onStatusChange).toHaveBeenCalledWith('tracking', target);
      handle!.stop();
      onMove.mockClear();
      step();
      expect(onMove).not.toHaveBeenCalled();
  });

  it.each(aggregateTargets)('%s switches to the visible side when the other hand leaves the camera', async (target, first, second, firstTarget, secondTarget) => {
    const { onMove, onStatusChange } = await start(target);
    pose(first, 0.6); step(5);
    expect(onStatusChange).toHaveBeenLastCalledWith('tracking', firstTarget);
    pose(second, 0.4); step(10);
    expect(onStatusChange).toHaveBeenLastCalledWith('tracking', secondTarget);
    expect(onMove.mock.calls.at(-1)![0]).toBeGreaterThan(850);
    detector.poses = []; step(8);
    expect(onStatusChange).toHaveBeenLastCalledWith('lost');
  });

  it.each([1, 5, 10])('keeps motion responsive at sensitivity %s from Settings', async sensitivity => {
    const { onMove } = await start('right_index', { sensitivity });
    pose(20, 0.6); step();
    const center = onMove.mock.calls.at(-1)![0];
    pose(20, 0.55); step(15);
    const delta = onMove.mock.calls.at(-1)![0] - center;
    expect(delta).toBeGreaterThan(8 * sensitivity);
    expect(delta).toBeLessThan(25 * sensitivity);
  });

  it.each([800, 1800, 3000])('requires the configured %sms dwell before activating a real button', async dwellMs => {
    const { onDwell } = await start('right_index', { dwellMs });
    const button = document.createElement('button'); document.body.appendChild(button);
    const click = vi.fn(); button.addEventListener('click', click);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(20, 0.6); step();
    step(dwellMs / 100 - 1);
    expect(click).not.toHaveBeenCalled();
    step(2);
    expect(click).toHaveBeenCalledTimes(1);
    expect(onDwell).toHaveBeenCalledTimes(1);
  });

  it('applies live calibration with real filters while retaining valid limited motion', async () => {
    const { onMove } = await start();
    handle!.setCalibration({ leftX: 0.55, rightX: 0.45, topY: 0.45, bottomY: 0.55 });
    pose(20, 0.5);
    step();
    expect(Math.abs(onMove.mock.calls.at(-1)![0] - 640)).toBeLessThan(20);
    pose(20, 0.46);
    step(10);
    expect(onMove.mock.calls.at(-1)![0]).toBeGreaterThan(1000);
  });

  it('uses only the new mapping on the first valid frame after a warmed tracker is recalibrated', async () => {
    const { onMove, mapPoseToScreen } = await start();
    pose(20, 0.5, 0.5); step(20);
    // Warm the real filters under the factory mapping before changing it.
    // Testing setCalibration before any frame cannot catch old-pixel history.
    const neutralX = 0.5 + drift();
    const neutralY = 0.5 + drift() / 2;
    const calibration = { leftX: 1 - neutralX + 0.15, rightX: 1 - neutralX - 0.15,
      topY: neutralY - 0.12, bottomY: neutralY + 0.12, wizardCompleted: true };
    handle!.setCalibration(calibration);
    const expectedDrift = driftLevel * Math.min((now + 100) / 5_000, 1);
    const expected = mapPoseToScreen(0.5 + expectedDrift, 0.5 + expectedDrift / 2,
      calibration, 1, 1280, 720);
    step();
    expect(onMove.mock.calls.at(-1)![0]).toBeCloseTo(expected.x);
    expect(onMove.mock.calls.at(-1)![1]).toBeCloseTo(expected.y);
  });

  it('retains smoothing for an unchanged mapping and completion metadata update', async () => {
    const { DEFAULT_CALIBRATION } = await start();
    pose(20, 0.5); step(20);
    const { ConfidenceAwareOneEuro } = await import('@/services/oneEuroFilter');
    const reset = vi.spyOn(ConfidenceAwareOneEuro.prototype, 'reset');
    handle!.setCalibration({ ...DEFAULT_CALIBRATION, wizardCompleted: true });
    expect(reset).not.toHaveBeenCalled();
  });

  it('never manufactures a centered cursor when a new calibration is applied without a usable frame', async () => {
    const { onMove } = await start();
    pose(20, 0.5); step(20);
    const moves = onMove.mock.calls.length;
    detector.poses = [];
    handle!.setCalibration({ leftX: 0.65, rightX: 0.35, topY: 0.38, bottomY: 0.62 });
    step(3);
    expect(onMove).toHaveBeenCalledTimes(moves);
  });

  it('uses the tested safe mapping for a degenerate live calibration rather than pinning the cursor', async () => {
    const { onMove, mapPoseToScreen } = await start();
    const calibration = { leftX: 0.505, rightX: 0.5, topY: 0.3, bottomY: 0.8 };
    // Capture the oracle before setCalibration: the old implementation also
    // mutated DEFAULT_CALIBRATION, which made an after-the-fact oracle lie.
    const firstDrift = driftLevel * (now + 100) / 5_000;
    const expected = mapPoseToScreen(0.5 + firstDrift, 0.55 + firstDrift / 2, calibration, 1, 1280, 720);
    handle!.setCalibration(calibration);
    pose(20, 0.5, 0.55);
    step();
    expect(expected.rangeOK).toBe(false);
    expect(detector.detect).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toBeCloseTo(expected.x);
    expect(onMove.mock.calls[0][1]).toBeCloseTo(expected.y);
  });

  it('live calibration never overwrites factory defaults used by the next tracker', async () => {
    const { DEFAULT_CALIBRATION } = await start();
    const originalDefaults = { ...DEFAULT_CALIBRATION };
    handle!.setCalibration({ leftX: 0.55, rightX: 0.45, topY: 0.45, bottomY: 0.55 });
    pose(20, 0.5); step(5);
    expect(DEFAULT_CALIBRATION).toEqual(originalDefaults);
  });

  it('does not click while detection is lost and requires a fresh dwell after recovery', async () => {
    const { onDwell, onMove, onStatusChange } = await start();
    const button = document.createElement('button');
    document.body.appendChild(button);
    const click = vi.fn();
    button.addEventListener('click', click);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(20, 0.6);
    step(3);
    detector.poses = [];
    const movesBeforeLoss = onMove.mock.calls.length;
    step(8);
    expect(onMove).toHaveBeenCalledTimes(movesBeforeLoss);
    expect(onStatusChange).toHaveBeenCalledWith('lost');
    expect(click).not.toHaveBeenCalled();
    expect(onDwell).not.toHaveBeenCalled();
    pose(20, 0.6);
    step(3);
    expect(click).not.toHaveBeenCalled();
    step(4);
    expect(click).toHaveBeenCalledTimes(1);
    expect(onDwell).toHaveBeenCalledTimes(1);
    step(3);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('acknowledges slow posture drift rather than repeatedly applying the same baseline offset', async () => {
    const service = await import('@/services/bodyPoseService');
    service.savePoseCalibration({ leftX: 0.8, rightX: 0.2, topY: 0.2, bottomY: 0.8, wizardCompleted: true });
    await start();
    pose(20, 0.5); step(610); // Real baseline warmup; no shortened thresholds.
    const before = service.loadPoseCalibration();
    for (let n = 1; n <= 600; n++) {
      pose(20, 0.5 + 0.15 * n / 600); step();
    }
    step(1000); // Hold the shifted posture through several correction intervals.
    const after = service.loadPoseCalibration();
    const shift = (after.leftX + after.rightX - before.leftX - before.rightX) / 2;
    expect(Math.abs(shift)).toBeGreaterThan(0.05); // Correction must actually run.
    expect(Math.abs(shift)).toBeLessThan(0.17); // Never integrate one offset repeatedly.
    expect(after.leftX - after.rightX).toBeCloseTo(before.leftX - before.rightX, 2);
  });
});

it('covers every camera target offered by Settings, so a new option cannot silently escape the replay matrix', () => {
  const section = readFileSync('services/cameraTrackingTargets.ts', 'utf8');
  const offered = [...section.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
  expect(offered.length).toBeGreaterThan(0);
  expect(offered.sort()).toEqual([...concreteTargets, ...aggregateTargets].map(([target]) => target).sort());
});
