import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TrackingSetupWizard from '@/components/TrackingSetupWizard';
import CameraInputOverlay from '@/components/CameraInputOverlay';
import { loadPoseCalibration, stopPoseTracker } from '@/services/bodyPoseService';
import { useSettingsStore } from '@/store/settingsStore';

// Real wizard, settings, calibration, tracker and filters. Only camera,
// detector and audio IO are replaced; no synthetic pose events/callbacks.
const io = vi.hoisted(() => ({
  poses: [] as Array<Array<{ x: number; y: number; visibility: number }>>,
  detect: vi.fn(), release: vi.fn(), acquire: vi.fn(),
  cameraDelay: 0,
}));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: { createFromOptions: vi.fn(async () => ({ detectForVideo: io.detect })) },
}));
vi.mock('@/services/cameraStream', () => ({ acquireCamera: io.acquire }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

let frames: Map<number, FrameRequestCallback>;
let id: number;
let now: number;
let driftLevel: number;
const drift = () => driftLevel * Math.min(now / 20_000, 1);
const originalSettings = { ...useSettingsStore.getState() };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  localStorage.clear();
  useSettingsStore.setState({ ...originalSettings, cameraInputEnabled: false,
    headTrackingEyeGaze: false, headTrackingSensitivity: 5 });
  frames = new Map(); id = 0; now = 0;
  io.poses = [];
  io.cameraDelay = 0;
  io.detect.mockReset().mockImplementation(() => ({ landmarks: io.poses.map(p => p.map(mark => ({
    ...mark, x: mark.x + drift(), y: mark.y + drift() / 2,
  }))) }));
  io.release.mockClear();
  io.acquire.mockReset().mockImplementation(async () => {
    if (io.cameraDelay) await new Promise(resolve => setTimeout(resolve, io.cameraDelay));
    const video = document.createElement('video');
    const track = { readyState: 'live', getSettings: () => ({ facingMode: 'user' }) };
    Object.defineProperties(video, {
      readyState: { value: 4 }, videoWidth: { value: 640 }, videoHeight: { value: 480 },
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
});

afterEach(() => {
  cleanup(); stopPoseTracker();
  useSettingsStore.setState(originalSettings);
  localStorage.clear();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

function pose(x: number, y: number) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  landmarks[20] = { x, y, visibility: 0.9 };
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
  pose(0.5, 0.5);
  await step(66);
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center');
  expect(useSettingsStore.getState().cameraTrackingTarget).toBe('right_index');
  await step(40);
  const cursor = screen.getByTestId('tracking-wizard-cursor');
  expect(Math.hypot(parseFloat(cursor.style.left) + 18 - 640,
    parseFloat(cursor.style.top) + 18 - 360)).toBeLessThan(55);
  expect(screen.getByTestId('tracking-capture-center')).not.toBeDisabled();
  fireEvent.click(screen.getByTestId('tracking-capture-center'));
  for (const [x, y] of [[0.85, 0.2], [0.15, 0.2], [0.15, 0.8], [0.85, 0.8]]) {
    pose(x, y); await step(3);
    fireEvent.click(screen.getByTestId('tracking-capture-corner'));
  }
  expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'accuracy-test');
  return view;
}

describe.each([0, 0.003, 0.015])('wizard → production tracker replay, drift=%s frame units', level => {
  beforeEach(() => { driftLevel = level; });
  it('saves selected-finger calibration and restores its real cursor mapping in the application overlay', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const wizard = await calibratedWizard();
    const saved = loadPoseCalibration();
    expect(saved.wizardCompleted).toBe(true);
    expect(saved.leftX - saved.rightX).toBeCloseTo(0.7, 2);
    // The tracker stays alive throughout accuracy testing. Neutral frames
    // must not bootstrap-shrink the user's just-captured reachable range.
    pose(0.5, 0.5); await step(530);
    expect(screen.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'complete');
    expect(loadPoseCalibration().leftX - loadPoseCalibration().rightX).toBeCloseTo(0.7, 2);
    expect(loadPoseCalibration().bottomY - loadPoseCalibration().topY).toBeCloseTo(0.6, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Start Using Prism AAC' }));
    wizard.unmount();
    const overlay = render(<CameraInputOverlay />);
    await act(async () => { await Promise.resolve(); });
    pose(0.5, 0.5); await step(3);
    const root = screen.getByTestId('camera-input-overlay');
    expect(root).toHaveAttribute('data-status', 'tracking');
    expect(root).toHaveAttribute('data-target', 'right_index');
    const dot = root.querySelector<HTMLElement>('div[style*="border-radius"]')!;
    expect(Math.abs(parseFloat(dot.style.left) - 626)).toBeLessThan(30);
    pose(0.25, 0.5); await step(10);
    expect(parseFloat(dot.style.left)).toBeGreaterThan(900);
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
    pose(0.5, 0.5); await step(3);
    io.poses = [];
    await step(9);
    expect(screen.getByTestId('tracking-wizard-status')).toHaveTextContent('Camera');
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
    expect(useSettingsStore.getState().cameraTrackingTarget).toBe('right_index');
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
});
