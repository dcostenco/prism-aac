import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TrackingSetupWizard from '@/components/TrackingSetupWizard';
import CameraInputOverlay from '@/components/CameraInputOverlay';
import { DEFAULT_CALIBRATION, loadPoseCalibration as readCalibration, stopPoseTracker } from '@/services/bodyPoseService';
import { CAMERA_WRIST_SOURCE } from '@/services/cameraTrackingTargets';
import { handForPose } from './helpers/hand-landmark-boundary';
const loadPoseCalibration = () => readCalibration(CAMERA_WRIST_SOURCE);
import { useSettingsStore } from '@/store/settingsStore';
import { readCameraSelectionState } from '@/services/cameraSelection';
import { aacSpeak } from '@/services/aacSpeak';
import english from '../i18n/en.json';

// Real wizard, settings, calibration, tracker and filters. Only camera,
// detector and audio IO are replaced; no synthetic pose events/callbacks.
const io = vi.hoisted(() => ({
  poses: [] as Array<Array<{ x: number; y: number; visibility: number }>>,
  detect: vi.fn(), release: vi.fn(), acquire: vi.fn(),
  presenceDetect: vi.fn(), verify: vi.fn(),
  verificationCrop: { x: 0, y: 0, side: 1 },
  cameraDelay: 0,
}));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: { createFromOptions: vi.fn(async () => ({ detectForVideo: io.detect })) },
  HandLandmarker: { createFromOptions: vi.fn(async () => ({ detectForVideo: () =>
    handForPose(io.poses[0], 640, 480, io.verificationCrop, drift(), drift() / 2) })) },
  // Head presence and verification: the same detector boundary the runtime
  // requires before any wrist sample may calibrate or select.
  FaceDetector: { createFromOptions: vi.fn(async () => ({ detectForVideo: io.presenceDetect, close: vi.fn() })) },
  FaceLandmarker: { createFromOptions: vi.fn(async () => ({ detect: io.verify, close: vi.fn() })) },
}));
vi.mock('@/services/cameraStream', () => ({ acquireCamera: io.acquire }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

let frames: Map<number, FrameRequestCallback>;
let id: number;
let now: number;
let driftLevel: number;
const CAMERA_DRIFT_RAMP_MS = 20_000;
const drift = () => driftLevel * Math.min(now / CAMERA_DRIFT_RAMP_MS, 1);
const originalSettings = { ...useSettingsStore.getState() };
const ORIGINAL_PROFILE_VALUES = {
  'prism-pose-calibration-landscape': JSON.stringify({ leftX: 0.7, rightX: 0.38,
    topY: 0.35, bottomY: 0.65, wizardCompleted: true, metadata: 'keep-landscape' }),
  'prism-pose-calibration-portrait': JSON.stringify({ leftX: 0.67, rightX: 0.31,
    topY: 0.27, bottomY: 0.59, wizardCompleted: true, metadata: 'keep-portrait' }),
  prism_pose_wizard_completed: 'false',
};

function seedPreviousProfiles() {
  for (const [key, raw] of Object.entries(ORIGINAL_PROFILE_VALUES)) localStorage.setItem(key, raw);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  localStorage.clear();
  useSettingsStore.setState({ ...originalSettings, cameraInputEnabled: false,
    cameraTrackingTarget: 'right_wrist',
    headTrackingEyeGaze: false, headTrackingSensitivity: 5 });
  frames = new Map(); id = 0; now = 0;
  io.poses = [];
  io.cameraDelay = 0;
  io.detect.mockReset().mockImplementation(() => ({ landmarks: io.poses.map(p => p.map(mark => ({
    ...mark, x: mark.x + drift(), y: mark.y + drift() / 2,
  }))) }));
  io.presenceDetect.mockReset().mockImplementation((video: HTMLCanvasElement) => {
    const nose = io.poses[0]?.[0];
    return { detections: nose && nose.visibility >= 0.3 ? [{ categories: [{ score: 0.9 }], boundingBox: {
      originX: (nose.x + drift() - 0.15) * video.width, originY: (nose.y + drift() / 2 - 0.15) * video.height,
      width: video.width * 0.3, height: video.height * 0.3,
    } }] : [] };
  });
  io.verify.mockReset().mockImplementation(() => {
    const nose = io.poses[0]?.[0] ?? { x: 0.5, y: 0.3 };
    const crop = io.verificationCrop;
    return { faceLandmarks: [Array.from({ length: 468 }, () => ({
      x: ((nose.x + drift()) * 320 - crop.x) / crop.side, y: ((nose.y + drift() / 2) * 240 - crop.y) / crop.side,
    }))] };
  });
  io.release.mockClear();
  io.acquire.mockReset().mockImplementation(async () => {
    if (io.cameraDelay) await new Promise(resolve => setTimeout(resolve, io.cameraDelay));
    const video = document.createElement('video');
    const track = { readyState: 'live', getSettings: () => ({ facingMode: 'user' }) };
    Object.defineProperties(video, {
      readyState: { value: 4 }, videoWidth: { value: 640 }, videoHeight: { value: 480 },
      currentTime: { get: () => now / 1000 }, // Advancing media clock: every frame is a new observation.
      srcObject: { value: { getTracks: () => [track], getVideoTracks: () => [track] } },
    });
    return { video, release: io.release };
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback); return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: 1280 },
    innerHeight: { configurable: true, value: 720 },
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn() },
  });
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true, value: vi.fn(() => null),
  });
  // Detector-boundary suite: verification-crop pixels are covered by the real-model browser test.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: (...args: unknown[]) => {
      if (this.width === 256 && args.length === 9) io.verificationCrop = { x: args[1] as number, y: args[2] as number, side: args[3] as number };
    } } as never;
  });
});

afterEach(() => {
  cleanup(); stopPoseTracker();
  useSettingsStore.setState(originalSettings);
  localStorage.clear();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

const RIGHT_WRIST = 16;
// Rest where the factory preview maps to the screen center (the front camera
// image is mirrored), so Step 1 shows the preview, not a stale profile, drives the cursor.
const NEUTRAL_X = 1 - (DEFAULT_CALIBRATION.leftX + DEFAULT_CALIBRATION.rightX) / 2;
const CORNER_REACH = 0.3; // Inside the calibration's frame-edge clamp at every drift level.
function pose(x: number, y: number) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  landmarks[0] = { x: 0.5, y: 0.3, visibility: 0.9 }; // A verified head must accompany the wrist.
  landmarks[RIGHT_WRIST] = { x, y, visibility: 0.9 };
  io.poses = [landmarks];
}

async function step(count = 1) {
  for (let n = 0; n < count; n++) {
    await act(async () => {
      now += 100;
      vi.advanceTimersByTime(100);
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(now));
    });
  }
}

async function calibratedWizard() {
  const view = render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByTestId('tracking-setup-start'));
  await act(async () => { await Promise.resolve(); });
  pose(NEUTRAL_X, 0.5);
  await step(66);
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center');
  expect(useSettingsStore.getState().cameraTrackingTarget).toBe('right_wrist');
  await step(40);
  const cursor = screen.getByTestId('tracking-wizard-cursor');
  expect(Math.hypot(parseFloat(cursor.style.left) + 18 - 640,
    parseFloat(cursor.style.top) + 18 - 360)).toBeLessThan(55);
  expect(screen.getByTestId('tracking-capture-center')).not.toBeDisabled();
  fireEvent.click(screen.getByTestId('tracking-capture-center'));
  for (const [dx, y] of [[CORNER_REACH, 0.2], [-CORNER_REACH, 0.2], [-CORNER_REACH, 0.8], [CORNER_REACH, 0.8]]) {
    const x = NEUTRAL_X + dx;
    pose(x, y); await step(3);
    fireEvent.click(screen.getByTestId('tracking-capture-corner'));
  }
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'accuracy-test');
  return view;
}

async function centerOnlyWizard() {
  const view = render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByTestId('tracking-setup-start'));
  await act(async () => { await Promise.resolve(); });
  pose(0.5, 0.5); await step(66); await step(40);
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center');
  fireEvent.click(screen.getByTestId('tracking-capture-center'));
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-corners');
  const preview = loadPoseCalibration();
  fireEvent.click(screen.getByTestId('tracking-save-center-only'));
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'accuracy-test');
  return { view, preview };
}

async function cornersWizard() {
  const view = render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByTestId('tracking-setup-start'));
  await act(async () => { await Promise.resolve(); });
  pose(NEUTRAL_X, 0.5); await step(66); await step(16);
  fireEvent.click(screen.getByTestId('tracking-capture-center'));
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-corners');
  return view;
}

/** Camera callbacks stop (background tab, stalled stream) while the wizard's own timers keep running. */
async function suspendCamera(ms: number) {
  await act(async () => { vi.advanceTimersByTime(ms); });
}

function rotateTo(orientation: 'portrait' | 'landscape') {
  Object.defineProperties(window, orientation === 'portrait'
    ? { innerWidth: { configurable: true, value: 390 }, innerHeight: { configurable: true, value: 844 } }
    : { innerWidth: { configurable: true, value: 1280 }, innerHeight: { configurable: true, value: 720 } });
}

const heading = () => screen.getByRole('heading', { level: 1 });
/** Every stored Settings value. The real tracker reports only the wrist the
 *  wizard requested, so its draft target always equals the saved one; check
 *  that nothing else in Settings moved either. */
const settingsValues = () => Object.fromEntries(Object.entries(useSettingsStore.getState()).filter(([, value]) => typeof value !== 'function'));
const wizardPhase = () => screen.getByTestId('tracking-setup-wizard').getAttribute('data-phase');

describe.each([0, 0.003, 0.015])('wizard → production tracker replay, drift=%s frame units', level => {
  beforeEach(() => { driftLevel = level; });
  it('shows and speaks the missing wrist, not a missing person, then recovers without stale guidance', async () => {
    vi.mocked(aacSpeak).mockClear();
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5);
    io.poses[0][RIGHT_WRIST].visibility = 0;
    await step(55);
    expect(screen.getByTestId('tracking-wizard-status')).toHaveTextContent(english.camera_loss_wrist);
    expect(screen.getByTestId('tracking-detection-status')).toHaveTextContent(english.camera_loss_wrist);
    expect(screen.queryByText('No body parts detected. Try moving closer.')).not.toBeInTheDocument();
    expect(vi.mocked(aacSpeak).mock.calls.filter(([text]) => text === english.camera_loss_wrist)).toHaveLength(1);
    expect(vi.mocked(aacSpeak).mock.calls.some(([text]) => text === 'I cannot see you. Please move closer to the camera.')).toBe(false);
    await step(10); // Repeated missing frames must not repeat the spoken instruction.
    expect(vi.mocked(aacSpeak).mock.calls.filter(([text]) => text === english.camera_loss_wrist)).toHaveLength(1);
    pose(NEUTRAL_X, 0.5); await step(10);
    expect(screen.getByTestId('tracking-detection-status')).not.toHaveTextContent(english.camera_loss_wrist);
    await step(30);
    expect(wizardPhase()).toBe('calibrate-center');
    expect(screen.getByTestId('tracking-capture-center')).toBeEnabled();
  });
  it.each(['head', 'camera'] as const)('reports the %s failure without inventing wrist samples and keeps Cancel available', async failure => {
    vi.mocked(aacSpeak).mockClear();
    const cancel = vi.fn();
    if (failure === 'camera') io.acquire.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={cancel} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    await step(55);
    const message = failure === 'head' ? english.camera_loss_head : english.camera_loss_unavailable;
    expect(screen.getByTestId('tracking-detection-status')).toHaveTextContent(message);
    expect(screen.getByTestId('tracking-wizard-status')).toHaveTextContent(message);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-pose-sample-count', '0');
    expect(screen.queryByTestId('tracking-capture-center')).not.toBeInTheDocument();
    expect(vi.mocked(aacSpeak).mock.calls.filter(([text]) => text === message)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('does not announce or advance from old wrist detections after current tracking is lost', async () => {
    vi.mocked(aacSpeak).mockClear();
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5); await step(20);
    io.poses[0][RIGHT_WRIST].visibility = 0;
    await step(50);
    expect(wizardPhase()).toBe('detecting');
    expect(screen.getByTestId('tracking-detection-status')).toHaveTextContent(english.camera_loss_wrist);
    expect(vi.mocked(aacSpeak).mock.calls.some(([text]) => text.startsWith('I can see your'))).toBe(false);
    pose(NEUTRAL_X, 0.5); await step(35);
    expect(wizardPhase()).toBe('calibrate-center');
    expect(screen.getByTestId('tracking-capture-center')).toBeEnabled();
  });
  it('rechecks current tracking before the delayed detection advance executes', async () => {
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5); await step(55); // Matched, but the 1.5s advance is pending.
    expect(wizardPhase()).toBe('detecting');
    io.poses[0][RIGHT_WRIST].visibility = 0;
    await step(20);
    expect(wizardPhase()).toBe('detecting');
    expect(screen.getByTestId('tracking-detection-status')).toHaveTextContent(english.camera_loss_wrist);
    pose(NEUTRAL_X, 0.5); await step(35);
    expect(wizardPhase()).toBe('calibrate-center');
  });
  it.each([20, 55])('does not advance when camera callbacks stop after %s frames, even without a loss callback', async sampleCount => {
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5); await step(sampleCount);
    await suspendCamera(5000);
    expect(wizardPhase()).toBe('detecting');
    await step(35);
    expect(wizardPhase()).toBe('calibrate-center');
  });
  it('keeps rendered capture state aligned with the live buffer on capture, refill and loss', async () => {
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5); await step(106);
    const wizard = screen.getByTestId('tracking-setup-wizard');
    expect(Number(wizard.getAttribute('data-pose-sample-count'))).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('tracking-capture-center'));
    expect(wizard).toHaveAttribute('data-pose-sample-count', '0');
    expect(screen.getByTestId('tracking-capture-corner')).toBeDisabled();
    expect(screen.getByTestId('tracking-save-center-only')).toBeVisible();
    await step(5);
    expect(Number(wizard.getAttribute('data-pose-sample-count'))).toBeGreaterThan(0);
    expect(screen.getByTestId('tracking-capture-corner')).toBeEnabled();
    io.poses[0][RIGHT_WRIST].visibility = 0; await step(3);
    expect(wizard).toHaveAttribute('data-pose-sample-count', '0');
    expect(wizard).toHaveAttribute('data-physical-pause', 'false');
    expect(wizard).toHaveAttribute('data-selection-ready', 'false');
    expect(screen.getByTestId('tracking-capture-corner')).toBeDisabled();
  });
  it('Cancel restores both orientation profiles and the original target after a manual wrist choice', async () => {
    seedPreviousProfiles();
    useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: 'right_wrist' });
    const before = settingsValues();
    const cancel = vi.fn();
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={cancel} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(0.5, 0.5); await step(51);
    fireEvent.click(screen.getByRole('button', { name: /Right Wrist\s*\d+%/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Calibrate Right Wrist/ }));
    await step(10);
    Object.defineProperties(window, { innerWidth: { configurable: true, value: 390 },
      innerHeight: { configurable: true, value: 844 } });
    fireEvent.click(screen.getByTestId('tracking-capture-center'));
    // Preview is live, but durable originals remain intact until confirmation.
    expect(loadPoseCalibration()).not.toEqual(JSON.parse(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-portrait']));
    expect(localStorage.getItem('prism-pose-calibration-landscape')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-landscape']);
    expect(localStorage.getItem('prism-pose-calibration-portrait')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-portrait']);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(cancel).toHaveBeenCalledOnce();
    for (const [key, raw] of Object.entries(ORIGINAL_PROFILE_VALUES)) expect(localStorage.getItem(key)).toBe(raw);
    expect(settingsValues()).toEqual({ ...before, cameraInputEnabled: false }); // Cancel turns the camera off and changes nothing else.
  });

  it('unmount rolls back an unfinished calibration and its legacy completion flag', async () => {
    seedPreviousProfiles();
    const view = await calibratedWizard();
    expect(loadPoseCalibration().wizardCompleted).toBe(true);
    expect(localStorage.getItem('prism_pose_wizard_completed')).toBe('false');
    view.unmount();
    for (const [key, raw] of Object.entries(ORIGINAL_PROFILE_VALUES)) expect(localStorage.getItem(key)).toBe(raw);
  });

  it('Cancel preserves a different calibration written concurrently', async () => {
    seedPreviousProfiles();
    const view = render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    // Simulate another tab, not a write through this wizard's draft writer.
    localStorage.setItem('prism-pose-calibration-landscape', ORIGINAL_PROFILE_VALUES['prism-pose-calibration-portrait']);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(localStorage.getItem('prism-pose-calibration-landscape')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-portrait']);
    view.unmount();
  });

  it('refuses confirmation after a concurrent profile change and visibly preserves the other saved profile', async () => {
    seedPreviousProfiles();
    const view = await calibratedWizard();
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    const concurrent = ORIGINAL_PROFILE_VALUES['prism-pose-calibration-portrait'];
    localStorage.setItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`, concurrent);
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    expect(screen.getByRole('alert')).toHaveTextContent('Saved calibration changed during setup');
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'complete');
    expect(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`)).toBe(concurrent);
    expect(localStorage.getItem('prism_pose_wizard_completed')).toBe('false');
    view.unmount();
    expect(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`)).toBe(concurrent);
  });

  it('only explicit Save and Done replaces the durable calibration and survives unmount', async () => {
    seedPreviousProfiles();
    const { view } = await centerOnlyWizard();
    const preview = loadPoseCalibration();
    expect(localStorage.getItem('prism-pose-calibration-landscape')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-landscape']);
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    expect(screen.getByTestId('tracking-confirm')).toHaveTextContent('Save & Done');
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    view.unmount();
    expect(JSON.parse(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`)!)).toEqual(preview);
    expect(localStorage.getItem('prism-pose-calibration-landscape')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-landscape']);
    expect(loadPoseCalibration()).toEqual(preview);
    expect(localStorage.getItem('prism-pose-calibration-portrait')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-portrait']);
  });

  it('does not silently confirm a completed calibration after rotating to another orientation', async () => {
    seedPreviousProfiles();
    const complete = vi.fn();
    const view = render(<TrackingSetupWizard onComplete={complete} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(0.5, 0.5); await step(66); await step(40);
    fireEvent.click(screen.getByTestId('tracking-capture-center'));
    fireEvent.click(screen.getByTestId('tracking-save-center-only'));
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    Object.defineProperties(window, { innerWidth: { configurable: true, value: 390 },
      innerHeight: { configurable: true, value: 844 } });
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Screen orientation changed');
    for (const [key, raw] of Object.entries(ORIGINAL_PROFILE_VALUES)) expect(localStorage.getItem(key)).toBe(raw);
    // Turning back allows the same reviewed calibration to be saved without
    // forcing extra motion or overwriting the other orientation.
    Object.defineProperties(window, { innerWidth: { configurable: true, value: 1280 },
      innerHeight: { configurable: true, value: 720 } });
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    expect(complete).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`)!).wizardCompleted).toBe(true);
    expect(localStorage.getItem('prism-pose-calibration-portrait')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-portrait']);
    view.unmount();
  });

  it('confirming after rotation does not replace the inactive orientation with an earlier preview', async () => {
    seedPreviousProfiles();
    const view = render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(0.5, 0.5); await step(66); await step(10);
    Object.defineProperties(window, { innerWidth: { configurable: true, value: 390 },
      innerHeight: { configurable: true, value: 844 } });
    fireEvent.click(screen.getByTestId('tracking-capture-center'));
    fireEvent.click(screen.getByTestId('tracking-save-center-only'));
    const preview = loadPoseCalibration();
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    view.unmount();
    expect(JSON.parse(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-portrait`)!)).toEqual(preview);
    expect(localStorage.getItem('prism-pose-calibration-landscape')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-landscape']);
  });
  it('retains wizard tracker ownership when a manual mode change rerenders the live overlay', async () => {
    useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: 'right_wrist' });
    const before = settingsValues();
    const view = render(<><CameraInputOverlay /><TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} /></>);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(0.5, 0.5); await step(51);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'detecting');
    fireEvent.click(screen.getByRole('button', { name: /Right Wrist\s*\d+%/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Calibrate Right Wrist/ }));
    // A live Settings change still must not let the overlay steal the
    // wizard's tracker; target choice itself stays a draft until confirmation.
    act(() => useSettingsStore.getState().update({ headTrackingSensitivity: 6 }));
    await step(20);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-tracker-status', 'tracking');
    expect(screen.getByTestId('tracking-capture-center')).toBeEnabled();
    expect(settingsValues()).toEqual({ ...before, headTrackingSensitivity: 6 }); // Target and the rest stay drafts until confirmation.
    expect(readCameraSelectionState().blocked).toBe(true);
    view.unmount();
    expect(readCameraSelectionState().blocked).toBe(false);
  });
  it('finalizes the limited-mobility center-only save without discarding its captured mapping', async () => {
    const { preview } = await centerOnlyWizard();
    const saved = loadPoseCalibration();
    expect(saved.wizardCompleted).toBe(true);
    expect(saved).toMatchObject({ leftX: preview.leftX, rightX: preview.rightX, topY: preview.topY, bottomY: preview.bottomY });
    // Completion belongs to this saved orientation, not a new global signal
    // that could suppress bootstrap for a different, uncalibrated orientation.
    expect(localStorage.getItem('prism_pose_wizard_completed')).toBeNull();
  });

  it('keeps center-only ranges intact in the live accuracy tracker instead of bootstrap shrinking them', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const { preview } = await centerOnlyWizard();
    pose(0.5, 0.5); await step(530);
    const saved = loadPoseCalibration();
    expect(saved.leftX - saved.rightX).toBeCloseTo(preview.leftX - preview.rightX, 5);
    expect(saved.bottomY - saved.topY).toBeCloseTo(preview.bottomY - preview.topY, 5);
    expect(saved.wizardCompleted).toBe(true);
  });

  it('saves selected-wrist calibration and restores its real cursor mapping in the application overlay', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const wizard = await calibratedWizard();
    const saved = loadPoseCalibration();
    expect(saved.wizardCompleted).toBe(true);
    expect(saved.leftX - saved.rightX).toBeCloseTo(2 * CORNER_REACH, 2);
    // The tracker stays alive throughout accuracy testing. Neutral frames
    // must not bootstrap-shrink the user's just-captured reachable range.
    pose(0.5, 0.5); await step(530);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'complete');
    expect(loadPoseCalibration().leftX - loadPoseCalibration().rightX).toBeCloseTo(2 * CORNER_REACH, 2);
    expect(loadPoseCalibration().bottomY - loadPoseCalibration().topY).toBeCloseTo(0.6, 2);
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    wizard.unmount();
    const overlay = render(<CameraInputOverlay />);
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5); await step(3);
    const root = screen.getByTestId('camera-input-overlay');
    expect(root).toHaveAttribute('data-status', 'tracking');
    expect(root).toHaveAttribute('data-target', 'right_wrist');
    const dot = () => root.querySelector<HTMLElement>('div[style*="border-radius"]')!;
    expect(Math.abs(parseFloat(dot().style.left) - 626)).toBeLessThan(30);
    // The isolated jump is withheld for a frame, which remounts the dot: read the current one.
    pose(NEUTRAL_X - 0.25, 0.5); await step(10);
    expect(parseFloat(dot().style.left)).toBeGreaterThan(900);
    expect(loadPoseCalibration()).toEqual(saved);
    overlay.unmount();
    const calls = io.detect.mock.calls.length;
    await step(5);
    expect(io.detect).toHaveBeenCalledTimes(calls);
    expect(io.release).toHaveBeenCalledTimes(io.acquire.mock.calls.length);
  });

  it('never awards an accuracy hit from a stale cursor after detector loss', async () => {
    // Put accuracy targets at center to isolate loss gating from reachability.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await calibratedWizard();
    pose(NEUTRAL_X, 0.5); await step(3);
    io.poses = [];
    await step(9);
    expect(screen.getByTestId('tracking-wizard-status')).toHaveTextContent('Face not verified'); // Head gate first.
    expect(screen.getByTestId('tracking-test-hits')).toHaveTextContent('0/5');
    await step(110); // Automatic escape must skip, not manufacture an accuracy hit.
    expect(screen.getByTestId('tracking-test-hits')).toHaveTextContent('0/5');
  });

  it('recovers when first camera/model results arrive after the initial detection deadline', async () => {
    io.cameraDelay = 6500;
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(0.5, 0.5);
    await step(55);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'detecting');
    await step(45);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center');
    expect(useSettingsStore.getState().cameraTrackingTarget).toBe('right_wrist');
  });

  it('releases a late camera lease without processing frames after cancel/unmount', async () => {
    io.cameraDelay = 6500;
    const wizard = render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(0.5, 0.5); await step(55);
    wizard.unmount();
    await step(45);
    expect(io.detect).not.toHaveBeenCalled();
    expect(io.release).toHaveBeenCalledTimes(io.acquire.mock.calls.length);
    expect(screen.queryByTestId('tracking-setup-wizard')).toBeNull();
  });
  it('never auto-captures a corner from readiness that went stale while camera callbacks stopped', async () => {
    // This test needs a genuine qualified rest before freezing callbacks.
    // Keep the chosen bias present, but let its finite motion finish before
    // setup; continuous mapped movement is not permission to assume readiness.
    now = CAMERA_DRIFT_RAMP_MS; vi.advanceTimersByTime(CAMERA_DRIFT_RAMP_MS);
    await cornersWizard();
    await step(28);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-selection-ready', 'true');
    expect(heading()).toHaveTextContent('Step 2: Corners (1/4)');
    await suspendCamera(6000); // Past the 5 s comfortable-range timeout, with no new observation.
    expect(heading()).toHaveTextContent('Step 2: Corners (1/4)');
    // Fresh frames requalify after the gap (a new measurement window), then the same timeout path captures.
    for (let i = 0; i < 40 && /\(1\/4\)/.test(heading().textContent ?? ''); i++) await step();
    expect(heading()).toHaveTextContent('Step 2: Corners (2/4)');
  });

  it('never auto-captures the center from readiness that went stale while camera callbacks stopped', async () => {
    render(<TrackingSetupWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5); await step(66); await step(30);
    expect(wizardPhase()).toBe('calibrate-center');
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-selection-ready', 'true');
    await suspendCamera(25_000); // Past the 20 s fallback, with no new observation.
    expect(wizardPhase()).toBe('calibrate-center');
  });

  it('awards no accuracy hit from a cursor pause that went stale while camera callbacks stopped', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // Every target at the same spot under the resting cursor.
    await calibratedWizard();
    const active = () => document.querySelector(`[data-testid="tracking-test-target-${Number(/Test \((\d+)\//.exec(heading().textContent ?? '')?.[1]) - 1}"]`);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid?.startsWith('tracking-test-target-') ? new DOMRect(640 - 70, 360 - 70, 140, 140) : new DOMRect(0, 0, 0, 0);
    });
    vi.mocked(document.elementFromPoint).mockImplementation(() => active());
    pose(NEUTRAL_X, 0.5);
    for (let i = 0; i < 60 && !/\b1\/5/.test(screen.getByTestId('tracking-test-hits').textContent ?? ''); i++) await step();
    expect(screen.getByTestId('tracking-test-hits')).toHaveTextContent('1/5'); // A fresh camera hit lands.
    await suspendCamera(600); // A hold begun on fresh evidence may finish inside the freshness limit.
    const settled = screen.getByTestId('tracking-test-hits').textContent;
    await suspendCamera(12_000);
    expect(screen.getByTestId('tracking-test-hits').textContent).toBe(settled);
    expect(settled).toMatch(/\b[12]\/5/);
  });

  it('requires a fresh center after rotation instead of saving a landscape center as portrait', async () => {
    seedPreviousProfiles();
    const complete = vi.fn();
    const view = render(<TrackingSetupWizard onComplete={complete} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    await act(async () => { await Promise.resolve(); });
    pose(NEUTRAL_X, 0.5); await step(66); await step(16);
    fireEvent.click(screen.getByTestId('tracking-capture-center'));
    rotateTo('portrait');
    fireEvent.click(screen.getByTestId('tracking-save-center-only'));
    expect(wizardPhase()).toBe('calibrate-center');
    expect(screen.getByTestId('tracking-wizard-guide')).toHaveTextContent('Orientation changed');
    for (const [key, raw] of Object.entries(ORIGINAL_PROFILE_VALUES)) expect(localStorage.getItem(key)).toBe(raw);
    // A center captured in this orientation completes setup for it, and only for it.
    await step(16);
    fireEvent.click(screen.getByTestId('tracking-capture-center'));
    fireEvent.click(screen.getByTestId('tracking-save-center-only'));
    fireEvent.click(screen.getByTestId('tracking-test-skip'));
    fireEvent.click(screen.getByTestId('tracking-confirm'));
    expect(complete).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-portrait`)!)).toMatchObject({ orientation: 'portrait', trackingTarget: 'right_wrist', wizardCompleted: true, coordinateSource: CAMERA_WRIST_SOURCE });
    expect(localStorage.getItem('prism-pose-calibration-landscape')).toBe(ORIGINAL_PROFILE_VALUES['prism-pose-calibration-landscape']);
    view.unmount();
  });

  it('requires a fresh center when the screen rotates between corner captures', async () => {
    seedPreviousProfiles();
    await cornersWizard();
    for (const [dx, y] of [[CORNER_REACH, 0.2], [-CORNER_REACH, 0.2]]) {
      pose(NEUTRAL_X + dx, y); await step(3);
      fireEvent.click(screen.getByTestId('tracking-capture-corner'));
    }
    expect(heading()).toHaveTextContent('Step 2: Corners (3/4)');
    rotateTo('portrait');
    pose(NEUTRAL_X - CORNER_REACH, 0.8); await step(3);
    fireEvent.click(screen.getByTestId('tracking-capture-corner'));
    expect(wizardPhase()).toBe('calibrate-center');
    for (const [key, raw] of Object.entries(ORIGINAL_PROFILE_VALUES)) expect(localStorage.getItem(key)).toBe(raw);
  });
});
