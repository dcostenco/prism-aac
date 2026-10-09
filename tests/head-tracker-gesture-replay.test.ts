/** Detector-boundary replay: real public tracker, fusion and GestureDetector.
 * Controlled camera leases/MediaPipe output are NOT pixel recognition proof.
 * Wall time and inference latency are independent of observation time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import type { HeadTrackerHandle, FaceLandmarkData } from '@/services/headTracker';
import { DEFAULT_GESTURE_CONFIG, GestureDetector, type GestureEvent } from '@/services/gestureService';

const camera = vi.hoisted(() => ({
  now: 1000, frame: 0, drift: 0, delay: 0,
  faces: [true, true], alternating: false, landmarks: true,
  areas: [0.30, 0.30],
  videos: [] as HTMLVideoElement[],
  observations: [] as number[],
}));
vi.mock('@/services/cameraStream', () => ({
  acquireCamera: vi.fn(async () => {
    const video = document.createElement('video');
    video.dataset.camera = String(camera.videos.length);
    Object.defineProperties(video, {
      readyState: { value: 2 }, videoWidth: { value: 320 }, videoHeight: { value: 240 },
    });
    camera.videos.push(video);
    return { video, release: vi.fn() };
  }),
}));
const visionMock = vi.hoisted(() => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  FaceDetector: { createFromOptions: async () => ({
    close() {},
    detectForVideo(video: HTMLVideoElement) {
      const index = Number(video.dataset.camera);
      if (!camera.faces[index]) return { detections: [] };
      const confidence = camera.areas[index] - (camera.alternating && (camera.frame + index) % 2 ? 0.01 : 0);
      const size = Math.sqrt(confidence * 320 * 240);
      const offset = camera.drift * camera.frame / 20;
      return { detections: [{ boundingBox: {
        originX: 160 - size / 2 + offset * 320,
        originY: 120 - size / 2 + offset * 240, width: size, height: size,
      } }] };
    },
  }) },
  FaceLandmarker: { createFromOptions: async () => ({
    close() {},
    detectForVideo(_video: HTMLVideoElement, observationTime: number) {
      camera.observations.push(observationTime);
      camera.now += camera.delay;
      if (!camera.landmarks) return { faceBlendshapes: [] };
      return { faceBlendshapes: [{ categories: ['eyeBlinkLeft', 'eyeBlinkRight'].map(categoryName =>
        ({ categoryName, score: 1 - camera.drift })) }] };
    },
  }) },
}));

let handle: HeadTrackerHandle | undefined;
let queue: Map<number, FrameRequestCallback>;
let nextId: number;
let events: GestureEvent[];
let samples: (FaceLandmarkData | null)[];
let detector: GestureDetector;
let onDrift: ReturnType<typeof vi.fn>;
let onDwell: ReturnType<typeof vi.fn>;
let onMove: ReturnType<typeof vi.fn>;
let elementFromPointDescriptor: PropertyDescriptor | undefined;

async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

beforeEach(() => {
  vi.resetModules();
  Object.assign(camera, { now: 1000, frame: 0, delay: 0, faces: [true, true],
    alternating: false, landmarks: true, areas: [0.30, 0.30], videos: [], observations: [] });
  queue = new Map(); nextId = 0; events = []; samples = [];
  onDrift = vi.fn();
  onDwell = vi.fn();
  onMove = vi.fn();
  localStorage.clear();
  vi.spyOn(Date, 'now').mockImplementation(() => camera.now);
  vi.spyOn(performance, 'now').mockImplementation(() => camera.now);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queue.set(++nextId, callback); return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
  detector = new GestureDetector({ ...DEFAULT_GESTURE_CONFIG, enabled: true }, event => events.push(event));
});
afterEach(() => {
  cleanup();
  handle?.stop(); handle = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (elementFromPointDescriptor) Object.defineProperty(document, 'elementFromPoint', elementFromPointDescriptor);
  else Reflect.deleteProperty(document, 'elementFromPoint');
});

async function start(count = 1) {
  // Spy on the canonical ESM factory, not the bare-package mock (which can
  // resolve to CJS with cached/symlinked dependencies). No real WASM loads.
  const actual = await vi.importActual<typeof import('@mediapipe/tasks-vision')>(
    fileURLToPath(import.meta.resolve('@mediapipe/tasks-vision')));
  vi.spyOn(actual.FilesetResolver, 'forVisionTasks').mockImplementation(visionMock.FilesetResolver.forVisionTasks);
  vi.spyOn(actual.FaceDetector, 'createFromOptions').mockResolvedValue(
    await visionMock.FaceDetector.createFromOptions() as unknown as InstanceType<typeof actual.FaceDetector>);
  vi.spyOn(actual.FaceLandmarker, 'createFromOptions').mockResolvedValue(
    await visionMock.FaceLandmarker.createFromOptions() as unknown as InstanceType<typeof actual.FaceLandmarker>);
  const { startHeadTracker } = await import('@/services/headTracker');
  handle = startHeadTracker({ dwellMs: 800, sensitivity: 5, smoothing: 0.15,
    onMove, onDwell, onStatusChange: vi.fn(),
    onDrift,
    onLandmarks: sample => { samples.push(sample); detector.processFrame(sample); },
  }, Array.from({ length: count }, (_, i) => `replay-camera-${i}`));
  // Dynamic MediaPipe module loading needs an event-loop turn, not just
  // flushing microtasks. Wait for real init; never force active state.
  await vi.waitFor(() => expect(handle?.activeCameraCount,
    `leases=${camera.videos.length}; ready=${camera.videos.map(v => v.readyState)}; raf=${queue.size}`
  ).toBe(count));
  expect(queue.size).toBe(count + 1);
}

// Execute actual scheduled camera loops, then actual fusion tick. Skipping a
// camera callback simulates a stalled loop, not a fabricated tracker callback.
async function frame(time: number, stalled: number[] = []) {
  camera.now = time; camera.frame++;
  const callbacks = [...queue.values()]; queue.clear();
  let index = 0;
  for (const callback of callbacks) {
    if (callback.name === 'camTick' && stalled.includes(index++)) {
      queue.set(++nextId, callback); continue;
    }
    callback(time); await settle();
  }
}

describe.each([0, 0.003, 0.015])('head tracker gesture replay with drift %s', drift => {
  it('keeps a completed head dwell locked through actual overlay ownership until observed departure', async () => {
    camera.drift = drift; camera.landmarks = false;
    await start(); handle!.stop(); queue.clear(); camera.videos = [];
    const service = await import('@/services/headTracker');
    const realStart = service.startHeadTracker;
    const startSpy = vi.spyOn(service, 'startHeadTracker').mockImplementation(options => {
      handle = realStart(options, ['replay-camera-0']); return handle;
    });
    vi.spyOn(service, 'isHeadTrackingSupported').mockReturnValue(true);
    const { useSettingsStore } = await import('@/store/settingsStore');
    useSettingsStore.setState({ headTrackingEnabled: true, headTrackingDwellMs: 800,
      headTrackingEyeGaze: false, gestureConfig: { ...DEFAULT_GESTURE_CONFIG, enabled: false } });
    const { default: Overlay } = await import('@/components/HeadTrackingOverlay');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    let pointed: HTMLElement | null = button;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => pointed });
    const view = render(createElement(Overlay));
    await vi.waitFor(() => expect(handle!.activeCameraCount).toBe(1));
    for (let t = 1200; t <= 2200; t += 100) await act(() => frame(t));
    expect(clicks).toHaveBeenCalledTimes(1);
    const { suspendCameraSelection } = await import('@/services/cameraSelection');
    let release!: () => void;
    act(() => { release = suspendCameraSelection(); });
    try {
      for (let t = 2300; t <= 4200; t += 100) await act(() => frame(t));
      expect(clicks).toHaveBeenCalledTimes(1);
    } finally { act(() => release()); }
    for (let t = 4300; t <= 5700; t += 100) await act(() => frame(t));
    expect(startSpy).toHaveBeenCalledTimes(1); expect(clicks).toHaveBeenCalledTimes(1);
    pointed = null; await act(() => frame(5800)); pointed = button;
    for (let t = 5900; t <= 6700; t += 100) await act(() => frame(t));
    expect(clicks).toHaveBeenCalledTimes(2);
    view.unmount();
  });
  it.each(['callback-reflow', 'click-reflow', 'click-removal'])('teaches the original target center after allowed %s, not post-click geometry', async mutation => {
    camera.drift = drift; camera.landmarks = false;
    await start();
    const service = await import('@/services/headTracker');
    const before = { ...service.loadCalibration() };
    const button = document.createElement('button'); document.body.append(button);
    let moved = false;
    button.getBoundingClientRect = () => {
      const [x, y] = onMove.mock.calls.at(-1) ?? [window.innerWidth / 2, window.innerHeight / 2];
      return new DOMRect(moved ? x + 50 : x - 70, y - 20, 40, 40);
    };
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => button });
    const clicks = vi.fn(() => { moved = true; if (mutation === 'click-removal') button.remove(); });
    button.addEventListener('click', clicks);
    if (mutation === 'callback-reflow') onDwell.mockImplementationOnce(() => { moved = true; });
    for (let t = 1200; t <= 2000; t += 100) await frame(t);
    expect(clicks).toHaveBeenCalledTimes(1);
    const after = service.loadCalibration();
    const originalDelta = 50 * (before.leftX - before.rightX) / window.innerWidth * 0.3;
    expect(after.leftX - before.leftX).toBeCloseTo(originalDelta, 6);
    expect(after.rightX - before.rightX).toBeCloseTo(originalDelta, 6);
    document.body.replaceChildren();
  });
  it('camera ownership cancels head dwell and gesture evidence, then requires a fresh native hold', async () => {
    camera.drift = drift;
    await start();
    const { suspendCameraSelection } = await import('@/services/cameraSelection');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => button });
    const release = suspendCameraSelection();
    try {
      for (let t = 1200; t <= 2800; t += 100) await frame(t);
      expect(clicks).not.toHaveBeenCalled(); expect(events).toEqual([]);
      expect(samples.every(sample => sample === null)).toBe(true);
      button.click(); expect(clicks).toHaveBeenCalledTimes(1); clicks.mockClear();
    } finally { release(); }
    camera.landmarks = false;
    for (let t = 2900; t <= 3600; t += 100) await frame(t);
    expect(clicks).not.toHaveBeenCalled();
    await frame(3700); expect(clicks).toHaveBeenCalledTimes(1);
    document.body.replaceChildren();
  });
  it('does not deliver head native clicks or lock completion after a callback ownership cycle', async () => {
    camera.drift = drift; camera.landmarks = false;
    await start();
    const { suspendCameraSelection } = await import('@/services/cameraSelection');
    const button = document.createElement('button'); document.body.append(button);
    const clicks = vi.fn(); button.addEventListener('click', clicks);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => button });
    onDwell.mockImplementationOnce(() => { const release = suspendCameraSelection(); release(); });
    for (let t = 1200; t <= 2000; t += 100) await frame(t);
    expect(onDwell).toHaveBeenCalledTimes(1); expect(clicks).not.toHaveBeenCalled();
    for (let t = 2100; t <= 2800; t += 100) await frame(t);
    expect(clicks).not.toHaveBeenCalled();
    await frame(2900); expect(clicks).toHaveBeenCalledTimes(1);
    document.body.replaceChildren();
  });
  beforeEach(() => { camera.drift = drift; });

  it('does not treat slow inference as a held blink', async () => {
    await start();
    await frame(1000); await frame(1067);
    camera.delay = 400;
    await frame(1134);
    expect(camera.observations).toEqual([1000, 1067, 1134]);
    expect(samples.filter(sample => sample !== null).map(sample => sample.timestamp))
      .toEqual(camera.observations);
    expect(events).toEqual([]); // Only 134ms observed, never a 400ms deliberate hold.
  });

  it('retains a valid primary through small confidence fluctuations', async () => {
    camera.alternating = true;
    await start(2);
    for (let i = 0; i < 20; i++) await frame(1000 + i * 67);
    expect(samples.filter(sample => sample === null)).toHaveLength(0);
    expect(events.map(event => event.gesture)).toEqual(['blink']);
  });

  it('cannot accumulate evidence by replaying a stalled camera result', async () => {
    await start(); await frame(1000);
    for (let i = 1; i < 9; i++) await frame(1000 + i * 50, [0]);
    expect(camera.observations).toEqual([1000]);
    expect(events).toEqual([]);
    await frame(1600, [0]);
    expect(samples.at(-1)).toBeNull();
    for (let i = 0; i < 10; i++) await frame(1667 + i * 67);
    expect(events.map(event => event.gesture)).toEqual(['blink']);
  });

  it('resets on actual camera failover and recovers on the fresh backup', async () => {
    await start(2); await frame(1000); await frame(1067);
    // Stale high-confidence camera must not be selected over fresh backup.
    await frame(1700, [0]); await frame(1767, [0]);
    expect(samples).toContain(null);
    expect(samples.at(-1)?.timestamp).toBe(1767);
    expect(events).toEqual([]);
    for (let i = 0; i < 8; i++) await frame(1834 + i * 67, [0]);
    expect(events.map(event => event.gesture)).toEqual(['blink']);
  });

  it('clears missing landmarks and recovers without joining across loss', async () => {
    await start(); await frame(1000); await frame(1067);
    camera.landmarks = false; await frame(1134);
    expect(samples.at(-1)).toBeNull();
    camera.landmarks = true; await frame(1201); await frame(1268);
    expect(events).toEqual([]);
    for (let i = 0; i < 8; i++) await frame(1335 + i * 67);
    expect(events.map(event => event.gesture)).toEqual(['blink']);
  });

  it('does not classify an ordinary 3%-of-frame face as confidence collapse', async () => {
    camera.areas = [0.03, 0.03];
    await start();
    for (let i = 0; i < 20; i++) await frame(1000 + i * 67);
    expect(onDrift).not.toHaveBeenCalled();
  });

  it('still disables genuinely low-confidence input with the original floor', async () => {
    camera.areas = [0.005, 0.005];
    await start();
    for (let i = 0; i < 20; i++) await frame(1000 + i * 67);
    expect(onDrift).toHaveBeenCalledWith('confidence-collapse');
  });

  it('uses the fresh backup confidence instead of a stale or lost primary', async () => {
    camera.areas = [0.01, 0.03];
    await start(2); await frame(1000); await frame(1067);
    for (let i = 0; i < 20; i++) await frame(1700 + i * 67, [0]);
    expect(onDrift).not.toHaveBeenCalled();
  });
});
