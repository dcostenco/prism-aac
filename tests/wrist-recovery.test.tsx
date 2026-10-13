import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TrackingSetupWizard from '@/components/TrackingSetupWizard';
import { DEFAULT_CALIBRATION, hasPoseCalibrationForTarget, loadPoseCalibration, stopPoseTracker } from '@/services/bodyPoseService';
import { BaselineTracker } from '@/services/recalibration';
import { WristMotion } from '@/services/wristMotion';
import { useSettingsStore } from '@/store/settingsStore';

// Only camera/model/audio IO is replaced. Run the production wizard,
// frame loop, timer, normalized noise estimator, filters and save path.
const io = vi.hoisted(() => ({ poses: [] as Array<Array<{ x: number; y: number; visibility: number }>>, detect: vi.fn(), release: vi.fn(), acquire: vi.fn(),
  crops: new WeakMap<HTMLCanvasElement, { x: number; y: number; width: number; height: number }>(),
}));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: { createFromOptions: vi.fn(async () => ({ detectForVideo: io.detect })) },
  FaceLandmarker: { createFromOptions: vi.fn(async () => ({ close: vi.fn(), detect: (input: HTMLCanvasElement) => {
    const crop = io.crops.get(input)!;
    return { faceLandmarks: [Array.from({ length: 468 }, () => ({ x: (160 - crop.x) / crop.width, y: (72 - crop.y) / crop.height }))] };
  } })) },
  FaceDetector: { createFromOptions: vi.fn(async () => ({ close: vi.fn(), detectForVideo: (input: HTMLCanvasElement) => {
    const crop = io.crops.get(input);
    return { detections: io.poses[0]?.[0]?.visibility >= 0.3 ? [{ categories: [{ score: 0.9 }], boundingBox: {
      originX: crop ? (120 - crop.x) * input.width / crop.width : 120,
      originY: crop ? (48 - crop.y) * input.height / crop.height : 48,
      width: crop ? 80 * input.width / crop.width : 80,
      height: crop ? 48 * input.height / crop.height : 48,
    } }] : [] };
  } })) },
}));
vi.mock('@/services/cameraStream', () => ({ acquireCamera: io.acquire }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
const DRIFT_LEVELS = [0, 0.003, 0.015];
const WRISTS = [['right_wrist', 16], ['left_wrist', 15]] as const;
const JITTER_AMPLITUDE = 0.03;
const DRIFT_RAMP_MS = 20_000;
const CALIBRATION_KEYS = ['prism-pose-calibration-landscape', 'prism-pose-calibration-portrait', 'prism-pose-calibration', 'prism_pose_wizard_completed'];
const SKIP_PHASES = ['tracking-calibrate-skip', 'tracking-corners-skip'] as const;
const previousSettings = { ...useSettingsStore.getState() };
let frames: Map<number, FrameRequestCallback>, now: number, id: number, driftLevel: number;

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(10_000); localStorage.clear();
  frames = new Map(); now = 0; id = 0;
  io.poses = []; io.detect.mockReset().mockImplementation(() => ({ landmarks: io.poses }));
  io.release.mockClear();
  io.acquire.mockReset().mockImplementation(async () => {
    const video = document.createElement('video');
    const track = { readyState: 'live', getSettings: () => ({ facingMode: 'user' }) };
    Object.defineProperties(video, { readyState: { value: 4 }, videoWidth: { value: 320 }, videoHeight: { value: 240 },
      currentTime: { get: () => now / 1000 },
      srcObject: { value: { getTracks: () => [track], getVideoTracks: () => [track] } } });
    return { video, release: io.release };
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  Object.defineProperties(window, { innerWidth: { configurable: true, value: 975 }, innerHeight: { configurable: true, value: 611 } });
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => null) });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  io.crops = new WeakMap();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: (...args: unknown[]) => {
      if (args.length === 9) io.crops.set(this, { x: args[1] as number, y: args[2] as number, width: args[3] as number, height: args[4] as number });
    } } as never;
  });
});
afterEach(() => {
  cleanup(); stopPoseTracker(); useSettingsStore.setState(previousSettings); localStorage.clear();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
async function step(index: number, x: number, y: number) {
  const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  pose[0] = { x: 0.5, y: 0.3, visibility: 0.9 };
  const drift = driftLevel * Math.min(now / DRIFT_RAMP_MS, 1);
  pose[index] = { x: x + drift, y: y + drift / 2, visibility: 0.9 }; io.poses = [pose];
  await act(async () => {
    now += 100; vi.advanceTimersByTime(100);
    const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now));
  });
}
describe.each(DRIFT_LEVELS)('wrist setup recovery at drift=%s', drift => {
  beforeEach(() => { driftLevel = drift; });
  it.each(SKIP_PHASES)('%s preserves a saved wrist profile through Save & Done', async skip => {
    const profile = { ...DEFAULT_CALIBRATION, wizardCompleted: true, trackingTarget: 'right_wrist', orientation: 'landscape' };
    localStorage.setItem(CALIBRATION_KEYS[0], JSON.stringify(profile));
    localStorage.setItem(CALIBRATION_KEYS[1], JSON.stringify({ ...profile, orientation: 'portrait' }));
    localStorage.setItem(CALIBRATION_KEYS[2], JSON.stringify(DEFAULT_CALIBRATION));
    localStorage.setItem(CALIBRATION_KEYS[3], 'true');
    const original = CALIBRATION_KEYS.map(key => localStorage.getItem(key));
    useSettingsStore.setState({ ...previousSettings, cameraInputEnabled: false, cameraTrackingTarget: 'right_wrist' });
    const completed = vi.fn();
    const view = render(<TrackingSetupWizard onComplete={completed} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    for (let i = 0; i < 70; i++) await step(16, 0.5, 0.55);
    if (skip === 'tracking-corners-skip') fireEvent.click(screen.getByTestId('tracking-capture-center'));
    fireEvent.click(screen.getByTestId(skip));
    for (let i = 0; i < 80; i++) await step(16, 0.5, 0.55);
    expect(CALIBRATION_KEYS.map(key => localStorage.getItem(key))).toEqual(original);
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    expect(completed).toHaveBeenCalledOnce(); view.unmount();
    expect(CALIBRATION_KEYS.map(key => localStorage.getItem(key))).toEqual(original);
    expect(hasPoseCalibrationForTarget('right_wrist')).toBe(true);
    expect(useSettingsStore.getState().cameraInputEnabled).toBe(true);
  });
  it.each(SKIP_PHASES)('%s with no saved wrist profile preserves empty storage and keeps camera control off', async skip => {
    useSettingsStore.setState({ ...previousSettings, cameraInputEnabled: false, cameraTrackingTarget: 'right_wrist' });
    const completed = vi.fn();
    const view = render(<TrackingSetupWizard onComplete={completed} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    for (let i = 0; i < 70; i++) await step(16, 0.5, 0.55);
    if (skip === 'tracking-corners-skip') fireEvent.click(screen.getByTestId('tracking-capture-center'));
    fireEvent.click(screen.getByTestId(skip));
    for (let i = 0; i < 80; i++) await step(16, 0.5, 0.55);
    expect(CALIBRATION_KEYS.map(key => localStorage.getItem(key))).toEqual(CALIBRATION_KEYS.map(() => null));
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    expect(completed).toHaveBeenCalledOnce(); view.unmount();
    expect(CALIBRATION_KEYS.map(key => localStorage.getItem(key))).toEqual(CALIBRATION_KEYS.map(() => null));
    expect(hasPoseCalibrationForTarget('right_wrist')).toBe(false);
    expect(useSettingsStore.getState().cameraInputEnabled).toBe(false);
  });
  it('a small-motion pause still auto-captures neutral without repeated recentering', async () => {
    useSettingsStore.setState({ ...previousSettings, cameraInputEnabled: false, cameraTrackingTarget: 'right_wrist', headTrackingSensitivity: 3 });
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    for (let i = 0; i < 66; i++) await step(16, 0.5, 0.55);
    const reset = vi.spyOn(BaselineTracker.prototype, 'reset');
    for (let i = 0; i < 90; i++) {
      const smallMotion = i % 2 ? 0.001 : -0.001;
      await step(16, 0.5 + smallMotion, 0.55 + smallMotion);
    }
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-corners');
    expect(reset).not.toHaveBeenCalled();
    expect(loadPoseCalibration()).not.toMatchObject(DEFAULT_CALIBRATION);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(localStorage.getItem('prism-pose-calibration-landscape')).toBeNull();
  });
  it.each(WRISTS)('%s preserves measured noise and manual calibration while uncertain input cannot auto-capture', async (target, index) => {
    useSettingsStore.setState({ ...previousSettings, cameraInputEnabled: false, cameraTrackingTarget: target, headTrackingSensitivity: 3 });
    const completed = vi.fn();
    const view = render(<TrackingSetupWizard onComplete={completed} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    for (let i = 0; i < 66; i++) await step(index, 0.5, 0.55);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center');
    const reset = vi.spyOn(BaselineTracker.prototype, 'reset');
    const noise = vi.spyOn(WristMotion.prototype, 'update');
    for (let i = 0; i < 95; i++) {
      const jitter = i % 2 ? JITTER_AMPLITUDE : -JITTER_AMPLITUDE;
      await step(index, 0.5 + jitter, 0.55 + jitter);
    }
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center');
    expect(noise.mock.results.at(-1)?.value.selectionReady).toBe(false);
    expect(reset).not.toHaveBeenCalled();
    expect(noise.mock.results.at(-1)?.value.noise).toBeGreaterThan(0.005);
    fireEvent.click(screen.getByTestId('tracking-capture-center')); // Explicit touch capture remains available, not camera accuracy proof.
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-corners');
    expect(reset).not.toHaveBeenCalled();
    await step(index, 0.5, 0.55);
    expect(noise.mock.results.at(-1)?.value.noise).toBeGreaterThan(0.005);
    fireEvent.click(screen.getByTestId('tracking-save-center-only'));
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    expect(completed).toHaveBeenCalledOnce(); view.unmount();
    expect(hasPoseCalibrationForTarget(target)).toBe(true);
    expect(loadPoseCalibration()).toMatchObject({ trackingTarget: target, orientation: 'landscape', wizardCompleted: true });
  });
});
