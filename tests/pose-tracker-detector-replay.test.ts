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
  PoseTrackerOptions, 'sensitivity' | 'dwellMs' | 'useEyeGaze' | 'eyeGazeWeight'
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
    useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: 'nose', headTrackingDwellMs: 500 });
    const { default: Overlay } = await import('@/components/CameraInputOverlay');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    vi.mocked(document.elementFromPoint).mockReturnValue(button);
    const view = render(createElement(Overlay));
    expect(startSpy).toHaveBeenCalledTimes(1);
    await act(() => vi.waitFor(() => expect(frames.size).toBeGreaterThan(0)));
    pose(0, 0.5); act(() => step(8));
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
  const settings = readFileSync('components/InputModesSettings.tsx', 'utf8');
  const section = settings.slice(settings.indexOf('const TRACKING_TARGETS = ['), settings.indexOf('function Toggle('));
  const offered = [...section.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
  expect(offered.length).toBeGreaterThan(0);
  expect(offered.sort()).toEqual([...concreteTargets, ...aggregateTargets].map(([target]) => target).sort());
});
