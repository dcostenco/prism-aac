import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import type { PoseTrackerHandle, PoseTrackerOptions, TrackingTarget } from '@/services/bodyPoseService';

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
const UNBOUND_CONTROL_CALIBRATIONS = [
  { name: 'legacy', binding: {} },
  { name: 'other wrist', binding: { trackingTarget: 'left_wrist' as const, orientation: 'landscape' as const, wizardCompleted: true } },
  { name: 'other orientation', binding: { trackingTarget: 'right_wrist' as const, orientation: 'portrait' as const, wizardCompleted: true } },
  { name: 'unfinished setup', binding: { trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const, wizardCompleted: false } },
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
}));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: {
    createFromOptions: detector.create,
  },
  FaceLandmarker: { createFromOptions: detector.faceCreate },
}));

let handle: PoseTrackerHandle | undefined;
let frames: Map<number, FrameRequestCallback>;
let frameID: number;
let now: number;
let driftLevel: number;
const drift = () => driftLevel * Math.min(now / 5_000, 1);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  window.localStorage.clear();
  frames = new Map();
  frameID = 0;
  now = 0;
  detector.poses = [];
  detector.face = [];
  detector.faceDetect.mockReset().mockImplementation(() => ({ faceLandmarks: [detector.face.map(mark => ({
    x: mark.x + drift(), y: mark.y + drift() / 2,
  }))] }));
  detector.faceCreate.mockReset().mockResolvedValue({ detectForVideo: detector.faceDetect });
  detector.detect.mockReset().mockImplementation(() => ({ landmarks: detector.poses.map(p => p.map(mark => ({
    ...mark, x: mark.x + drift(), y: mark.y + drift() / 2,
  }))) }));
  detector.create.mockReset().mockResolvedValue({ detectForVideo: detector.detect });
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
    readyState: { value: 4 },
    videoWidth: { value: 640 },
    videoHeight: { value: 480 },
    srcObject: { value: {} },
  });
  const onMove = vi.fn();
  const onDwell = vi.fn();
  const onStatusChange = vi.fn();
  handle = service.startPoseTracker({
    dwellMs: 500, sensitivity: 5, smoothing: 0.15,
    trackingTarget: target, cursorSmoothing: 0.15,
    ...options,
    onMove, onDwell, onStatusChange,
  }, undefined, video);
  await vi.waitFor(() => expect(frames.size).toBe(1));
  expect(detector.create).toHaveBeenCalledTimes(1);
  return { ...service, onMove, onDwell, onStatusChange };
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

function step(count = 1) {
  for (let i = 0; i < count; i++) {
    now += 100;
    vi.advanceTimersByTime(100);
    const scheduled = [...frames.values()];
    frames.clear();
    scheduled.forEach(callback => callback(now));
  }
}

describe.each([0, 0.003, 0.015])('real pose tracker — detector replay, drift=%s frame units', level => {
  beforeEach(() => { driftLevel = level; });
  it('an explicit control recenter requires a fresh dwell even on the same button', async () => {
    const service = await import('@/services/bodyPoseService');
    const cal = { ...service.DEFAULT_CALIBRATION, wizardCompleted: true,
      trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const };
    service.savePoseCalibration(cal);
    const { onDwell } = await start('right_wrist', { calibrationMode: 'control', selectedTargetOnly: true, requireHeadPresence: true });
    const button = document.createElement('button'); document.body.append(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
    step(3);
    handle!.setCalibration({ ...cal, leftX: 0.66, rightX: 0.34 });
    step(3);
    expect(onDwell).not.toHaveBeenCalled();
    step(4);
    expect(onDwell).toHaveBeenCalledTimes(1);
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
    expect(service.loadPoseCalibration()).toEqual(saved);
  });
  it.each(['setup', 'control'] as const)('%s prevents both automatic mapping writers but preserves explicit calibration and noise learning', async calibrationMode => {
    const service = await import('@/services/bodyPoseService');
    const initialCal = { ...service.DEFAULT_CALIBRATION, wizardCompleted: true,
      trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const };
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
    expect(noise).toHaveBeenCalled();
    expect(captured.frames.some((frame: { noise: number }) => frame.noise > 0)).toBe(true);
    expect(service.loadPoseCalibration()).toEqual(initialCal);
    const explicit = { ...initialCal, leftX: 0.66, rightX: 0.34 };
    handle!.setCalibration(explicit);
    expect(service.loadPoseCalibration()).toEqual(explicit);
    expect(service.hasPoseCalibrationForTarget('right_wrist')).toBe(true);
    expect(service.hasPoseCalibrationForTarget('left_wrist')).toBe(false);
    expect(() => handle!.setCalibration({ ...explicit, trackingTarget: 'left_wrist' })).toThrow();
    expect(() => handle!.setCalibration({ ...explicit, leftX: NaN })).toThrow();
    expect(service.loadPoseCalibration()).toEqual(explicit);
    if (calibrationMode === 'setup') {
      const { computeCenterPreviewCalibration } = await import('@/services/wizardCalibration');
      const draft = service.beginPoseCalibrationDraft();
      const centered = { ...computeCenterPreviewCalibration({ normX: 0.5, normY: 0.55 }),
        wizardCompleted: true, trackingTarget: 'right_wrist' as const, orientation: 'landscape' as const };
      handle!.setCalibration(centered);
      // Center-only access must stay available without requiring four corners.
      expect(JSON.parse(localStorage.getItem('prism-pose-calibration-landscape')!)).toEqual(explicit);
      draft.commit('landscape');
      expect(service.loadPoseCalibration()).toEqual(centered);
      pose(16, 0.5 - drift(), 0.55 - drift() / 2);
      detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 };
      step();
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
    step(4);
    expect(onDwell).toHaveBeenCalledTimes(1);
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
      videoHeight: { value: 480 }, srcObject: { value: {} } });
    const realStart = service.startPoseTracker;
    const startSpy = vi.spyOn(service, 'startPoseTracker').mockImplementation(options => {
      handle = realStart(options, undefined, video); return handle;
    });
    vi.spyOn(service, 'isPoseTrackingSupported').mockReturnValue(true);
    const { useSettingsStore } = await import('@/store/settingsStore');
    useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: 'right_wrist', headTrackingDwellMs: 500 });
    service.savePoseCalibration({ ...service.DEFAULT_CALIBRATION, wizardCompleted: true,
      trackingTarget: 'right_wrist', orientation: 'landscape' });
    const { default: Overlay } = await import('@/components/CameraInputOverlay');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    const view = render(createElement(Overlay));
    expect(startSpy).toHaveBeenCalledTimes(1);
    await act(() => vi.waitFor(() => expect(frames.size).toBeGreaterThan(0)));
    pose(16, 0.5); detector.poses[0][0] = { x: 0.5, y: 0.3, visibility: 0.9 }; act(() => step(8));
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
    vi.mocked(document.elementFromPoint).mockReturnValue(null); act(() => step());
    vi.mocked(document.elementFromPoint).mockReturnValue(button); act(() => step(6));
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
