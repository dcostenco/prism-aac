import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const camera = vi.hoisted(() => ({ detect: vi.fn(), create: vi.fn(), close: vi.fn(), verify: vi.fn(), verifierCreate: vi.fn(), verifierClose: vi.fn(), frameTime: 0 }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  FaceDetector: { createFromOptions: camera.create },
  FaceLandmarker: { createFromOptions: camera.verifierCreate },
}));
const FACE = { detections: [{ boundingBox: { originX: 100, originY: 60, width: 40, height: 40 }, categories: [{ score: 0.9 }] }] };
const NO_FACE = { detections: [] };
const VERIFIED_FACE = { faceLandmarks: [Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }))] };
const draw = vi.fn();
const CAMERA_INTERVALS = [215, 1000 / 4.5];
const POLL_MS = 1000 / 15;
const FRAME_JITTER = [1.2, 0.8, 1.1, 0.9];
let closers: Array<() => void>;
beforeEach(() => {
  vi.resetModules(); closers = []; draw.mockReset();
  camera.frameTime = 0;
  camera.detect.mockReset().mockReturnValue(FACE); camera.close.mockReset();
  camera.create.mockReset().mockResolvedValue({ detectForVideo: camera.detect, close: camera.close });
  camera.verify.mockReset().mockReturnValue(VERIFIED_FACE); camera.verifierClose.mockReset();
  camera.verifierCreate.mockReset().mockResolvedValue({ detect: camera.verify, close: camera.verifierClose });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw } as never);
});
afterEach(() => { closers.forEach(close => close()); vi.restoreAllMocks(); });
function video() {
  const v = document.createElement('video');
  Object.defineProperties(v, { videoWidth: { value: 320 }, videoHeight: { value: 240 }, readyState: { value: 4 },
    currentTime: { configurable: true, get: () => ++camera.frameTime / 30 } });
  return v;
}
describe('fresh head presence and shared model ownership', () => {
  it('marks a skipped media-frame interval as a discontinuity even when a stale poll was not observed', async () => {
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = video(); let mediaTime = 1;
    Object.defineProperty(v, 'currentTime', { get: () => mediaTime });
    expect(head.detect(v, 1000).present).toBe(true);
    mediaTime += 0.52;
    expect(head.detect(v, 1100)).toMatchObject({ present: true, discontinuity: true });
    expect(head.frameTimeMs).toBe(1520);
  });
  it.each(CAMERA_INTERVALS)('does not label a healthy independent %s ms camera clock stale between processing polls', async interval => {
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = video(); let frameTime = 0, nextFrame = interval, index = 0;
    Object.defineProperty(v, 'currentTime', { get: () => frameTime / 1000 });
    let accepted = 0, pending = 0;
    for (let timestamp = 0; timestamp < 10_000; timestamp += POLL_MS) {
      if (timestamp >= nextFrame) { frameTime = nextFrame; nextFrame += interval * FRAME_JITTER[index++ % FRAME_JITTER.length]; }
      const result = head.detect(v, timestamp);
      expect(result.reason).not.toBe('camera-frame-stale');
      if (result.pending) { pending++; expect(result.present).toBe(false); }
      else { accepted++; expect(result.present).toBe(true); }
    }
    expect(accepted).toBeGreaterThan(40); expect(pending).toBeGreaterThan(50);
    expect(camera.detect).toHaveBeenCalledTimes(accepted); expect(camera.verify).toHaveBeenCalledTimes(accepted);
  });
  it('shares a model and keeps the remaining consumer alive after close', async () => {
    const { acquireFaceDetector } = await import('@/services/sharedFaceDetector');
    const [a, b] = await Promise.all([acquireFaceDetector(), acquireFaceDetector()]);
    closers.push(a.close, b.close);
    expect(camera.create).toHaveBeenCalledTimes(1);
    a.detectForVideo(video(), 1000); a.close();
    expect(camera.close).not.toHaveBeenCalled(); b.detectForVideo(video(), 10);
    expect(camera.detect.mock.calls[1][1]).toBeGreaterThan(camera.detect.mock.calls[0][1]);
    b.close(); b.close(); expect(camera.close).toHaveBeenCalledTimes(1);
    expect(() => a.detectForVideo(video(), 2000)).toThrow();
  });
  it('never treats the previous face box as present without current inference', async () => {
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = video();
    expect(head.detect(v, 1000).present).toBe(true);
    camera.detect.mockReturnValue(NO_FACE);
    expect(head.detect(v, 1100).present).toBe(false);
    expect(camera.detect).toHaveBeenCalledTimes(5); // previous ROI, full frame, two acquisition tiles
  });
  it('does not count a stalled camera frame as a fresh head even when both models would accept it', async () => {
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = video(); Object.defineProperty(v, 'currentTime', { writable: true, value: 1 });
    expect(head.detect(v, 1000).present).toBe(true);
    expect(head.detect(v, 1100)).toMatchObject({ present: false, pending: true });
    expect(head.detect(v, 1500)).toMatchObject({ present: false, reason: 'camera-frame-stale' });
    expect(camera.detect).toHaveBeenCalledOnce(); expect(camera.verify).toHaveBeenCalledOnce();
    v.currentTime += 1 / 30;
    expect(head.detect(v, 1550).present).toBe(true);
  });
  it('bounds search cost and scans beyond the center rather than assuming head location', async () => {
    camera.detect.mockReturnValue(NO_FACE);
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = video();
    for (let i = 0; i < 12; i++) expect(head.detect(v, 1000 + i * 100).present).toBe(false);
    expect(camera.detect).toHaveBeenCalledTimes(36);
    expect(new Set(draw.mock.calls.filter(args => args.length === 9).map(args => `${args[1]},${args[2]},${args[3]}`)).size).toBe(18);
  });
  it('rejects a confident coarse face without landmarks and never caches that rejected search location', async () => {
    camera.verify.mockReturnValue({ faceLandmarks: [] });
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = video();
    expect(head.detect(v, 1000)).toMatchObject({ present: false, reason: 'head-unverified', box: null });
    expect(head.detect(v, 1100).present).toBe(false);
    expect(camera.detect).toHaveBeenCalledTimes(6); // no rejected previous-box fast path
    camera.verify.mockReturnValue(VERIFIED_FACE);
    expect(head.detect(v, 1200).present).toBe(true);
  });
  it('confirms every accepted frame and rejects a mesh from outside the coarse face', async () => {
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = video();
    expect(head.detect(v, 1000).present).toBe(true);
    camera.verify.mockReturnValue({ faceLandmarks: [Array.from({ length: 468 }, () => ({ x: 0, y: 0 }))] });
    expect(head.detect(v, 1100).present).toBe(false);
    expect(camera.verify).toHaveBeenCalledTimes(5);
  });
  it('shares the CPU verifier, fails closed when its model cannot load, and releases both models', async () => {
    const { startHeadPresence } = await import('@/services/headPresence');
    const [a, b] = await Promise.all([startHeadPresence(), startHeadPresence()]);
    closers.push(a.close, b.close);
    expect(camera.verifierCreate).toHaveBeenCalledTimes(1);
    expect(camera.verifierCreate.mock.calls[0][1]).toMatchObject({ baseOptions: { delegate: 'CPU' }, runningMode: 'IMAGE' });
    a.close(); expect(camera.verifierClose).not.toHaveBeenCalled();
    expect(b.detect(video(), 1000).present).toBe(true);
    b.close(); expect(camera.verifierClose).toHaveBeenCalledOnce(); expect(camera.close).toHaveBeenCalledOnce();
    expect(() => b.detect(video(), 1100)).toThrow();
    camera.verifierCreate.mockRejectedValue(new Error('model load failed'));
    await expect(startHeadPresence()).rejects.toThrow('model load failed');
    expect(camera.close).toHaveBeenCalledTimes(2);
  });
  it('normalizes high-detail camera input to the qualified preview envelope without stretching it', async () => {
    const { startHeadPresence } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const v = document.createElement('video');
    Object.defineProperties(v, { videoWidth: { value: 480 }, videoHeight: { value: 640 }, readyState: { value: 4 } });
    head.detect(v, 1000);
    expect(draw.mock.calls[0]).toEqual([v, 0, 0, 480, 640]);
    expect(draw.mock.calls[1]).toEqual([head.capturedFrame, 0, 0, 240, 320]);
    expect(head.capturedFrame.width).toBe(480); expect(head.capturedFrame.height).toBe(640);
  });
  it('maps a cropped face box back to the original camera coordinates', async () => {
    camera.detect.mockReturnValueOnce(NO_FACE).mockReturnValue(FACE);
    const { startHeadPresence, poseBelongsToHead } = await import('@/services/headPresence');
    const head = await startHeadPresence(); closers.push(head.close);
    const result = head.detect(video(), 1000);
    expect(result.cropped).toBe(true);
    expect(result.box).toEqual({ x: 0.1171875, y: 0.09375, width: 0.046875, height: 0.0625 });
    expect(poseBelongsToHead({ x: 0.14, y: 0.12 }, result.box)).toBe(true);
    expect(poseBelongsToHead({ x: 0.8, y: 0.8 }, result.box)).toBe(false);
  });
});
