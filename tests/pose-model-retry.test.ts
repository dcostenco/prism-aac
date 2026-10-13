import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PoseTrackerHandle, PoseTrackerOptions } from '@/services/bodyPoseService';

const io = vi.hoisted(() => ({ available: false, create: vi.fn(), faceCreate: vi.fn(), faceClose: vi.fn() }));
const MODEL_LOAD_FAILURE = 'transient model download failure';
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  PoseLandmarker: { createFromOptions: io.create },
  FaceDetector: { createFromOptions: io.faceCreate },
}));
let handles: PoseTrackerHandle[];
beforeEach(() => {
  vi.resetModules(); localStorage.clear(); handles = []; io.available = false;
  io.create.mockReset().mockImplementation(async () => {
    if (!io.available) throw new Error(MODEL_LOAD_FAILURE);
    return { detectForVideo: vi.fn(() => ({ landmarks: [] })) };
  });
  io.faceClose.mockReset(); io.faceCreate.mockReset().mockResolvedValue({ detectForVideo: vi.fn(() => ({ detections: [] })), close: io.faceClose });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { handles.forEach(handle => handle.stop()); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
async function start(strict: boolean) {
  const { startPoseTracker } = await import('@/services/bodyPoseService');
  const video = document.createElement('video');
  Object.defineProperties(video, { readyState: { value: 4 }, videoWidth: { value: 320 }, videoHeight: { value: 240 }, srcObject: { value: {} } });
  const options: PoseTrackerOptions = { trackingTarget: strict ? 'right_wrist' : 'nose', selectedTargetOnly: strict,
    dwellMs: 1200, sensitivity: 5, smoothing: 0.15, onMove: vi.fn(), onDwell: vi.fn(), onStatusChange: vi.fn(), onTrackingLoss: vi.fn() };
  handles.push(startPoseTracker(options, undefined, video));
  return options;
}
it('retries a transient strict wrist model failure without installing a forbidden face cursor fallback', async () => {
  const failed = await start(true);
  await vi.waitFor(() => expect(failed.onStatusChange).toHaveBeenLastCalledWith('stopped'));
  expect(io.create).toHaveBeenCalledTimes(2); expect(io.faceCreate).not.toHaveBeenCalled();
  io.available = true;
  const retried = await start(true);
  await vi.waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled());
  expect(io.create).toHaveBeenCalledTimes(3); expect(retried.onTrackingLoss).not.toHaveBeenCalled();
});
it('replaces and releases a legacy face-only fallback when the next caller requires a wrist pose', async () => {
  await start(false);
  await vi.waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled());
  expect(io.faceCreate).toHaveBeenCalledOnce(); io.available = true;
  vi.mocked(requestAnimationFrame).mockClear();
  const wrist = await start(true);
  await vi.waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled());
  expect(io.create).toHaveBeenCalledTimes(3); expect(io.faceClose).toHaveBeenCalledOnce();
  expect(wrist.onTrackingLoss).not.toHaveBeenCalled();
});
