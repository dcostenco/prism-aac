import { acquireFaceDetector } from './sharedFaceDetector';
import { acquireHeadVerifier, type HeadVerifierLease } from './sharedHeadVerifier';
import { HEAD_PRESENCE_DETECTOR_URL } from './mediapipeRuntime';
import { CAMERA_FRAME_STALE_MS } from './cameraFrameTiming';

export interface HeadBox { x: number; y: number; width: number; height: number }
export interface HeadPresence { present: boolean; confidence: number; box: HeadBox | null; cropped: boolean; pending?: boolean; discontinuity?: boolean; reason?: 'head-missing' | 'head-unverified' | 'camera-frame-stale' }
export interface HeadPresenceHandle {
  detect(video: HTMLVideoElement, timestamp: number): HeadPresence;
  /** Native-detail snapshot used for this head observation and its wrist pose. */
  readonly capturedFrame: HTMLCanvasElement;
  /** Media time of the exact captured pixels, before inference latency. */
  readonly frameTimeMs: number;
  close(): void;
}
const ROI_SCALES = [0.5, 0.35] as const;
const ROI_OFFSETS = [0, 0.5, 1] as const;
const SEARCH_REGIONS = ROI_SCALES.flatMap(scale => ROI_OFFSETS.flatMap(y => ROI_OFFSETS.map(x => ({ scale, x, y }))));
const SEARCHES_PER_FRAME = 2;
const FACE_SCORE_FLOOR = 0.5;
const TRACKED_FACE_MARGIN = 3;
const MIN_TRACKED_ROI_FRACTION = 0.2;
const POSE_ASSOCIATION_MARGIN = 0.2;
const PREVIEW_FRAME_LONG_SIDE = 320;
const VERIFICATION_SIZE = 256;
const FACE_LANDMARK_COUNT = 468;
const NOSE_INDEX = 1;
const CANVAS_UNAVAILABLE = 'head-presence-canvas-unavailable';
const PRESENCE_CLOSED = 'head-presence-closed';

export function poseBelongsToHead(point: { x: number; y: number } | undefined, box: HeadBox | null): boolean {
  if (!point || !box || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return point.x >= box.x - box.width * POSE_ASSOCIATION_MARGIN &&
    point.x <= box.x + box.width * (1 + POSE_ASSOCIATION_MARGIN) &&
    point.y >= box.y - box.height * POSE_ASSOCIATION_MARGIN &&
    point.y <= box.y + box.height * (1 + POSE_ASSOCIATION_MARGIN);
}

/** Crops change detector scale, never fabricate camera detail. A cached box
 * is only a search location: every positive result requires fresh inference. */
export async function startHeadPresence(): Promise<HeadPresenceHandle> {
  const detector = await acquireFaceDetector(HEAD_PRESENCE_DETECTOR_URL);
  let verifier: HeadVerifierLease;
  try { verifier = await acquireHeadVerifier(); }
  catch (error) { detector.close(); throw error; }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const frame = document.createElement('canvas');
  const frameContext = frame.getContext('2d');
  const capturedFrame = document.createElement('canvas');
  const capturedContext = capturedFrame.getContext('2d');
  const confirmation = document.createElement('canvas');
  confirmation.width = confirmation.height = VERIFICATION_SIZE;
  const confirmationContext = confirmation.getContext('2d');
  if (!context || !frameContext || !capturedContext || !confirmationContext) {
    verifier.close(); detector.close(); throw new Error(CANVAS_UNAVAILABLE);
  }
  let previous: HeadBox | null = null;
  let scan = 0;
  let closed = false;
  let rejectedConfidence = 0;
  let observedVideo: HTMLVideoElement | null = null;
  let observedFrameTime = NaN;
  let observedAt = -Infinity;
  let discontinuity = false;
  const empty = (): HeadPresence => ({ present: false, confidence: rejectedConfidence, box: null, cropped: false,
    reason: rejectedConfidence ? 'head-unverified' : 'head-missing' });
  const infer = (timestamp: number, region: HeadBox | null): HeadPresence => {
    const width = frame.width, height = frame.height;
    const source = region ?? { x: 0, y: 0, width, height };
    let input = frame;
    if (region) {
      canvas.width = width; canvas.height = width;
      context.drawImage(frame, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
      input = canvas;
    }
    const inputWidth = region ? canvas.width : width, inputHeight = region ? canvas.height : height;
    const detections = detector.detectForVideo(input, timestamp).detections ?? [];
    for (const detection of detections) {
      const box = detection.boundingBox, score = detection.categories?.[0]?.score ?? 0;
      if (!box || !Number.isFinite(score) || score < FACE_SCORE_FLOOR || score > 1 ||
          ![box.originX, box.originY, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) continue;
      const x = Math.max(0, box.originX / inputWidth), y = Math.max(0, box.originY / inputHeight);
      const right = Math.min(1, (box.originX + box.width) / inputWidth), bottom = Math.min(1, (box.originY + box.height) / inputHeight);
      if (right <= x || bottom <= y) continue;
      const candidate = {
        x: (source.x + x * source.width) / width, y: (source.y + y * source.height) / height,
        width: (right - x) * source.width / width, height: (bottom - y) * source.height / height,
      };
      const side = Math.min(width, height, Math.max(candidate.width * width, candidate.height * height) * TRACKED_FACE_MARGIN);
      const ox = Math.max(0, Math.min(width - side, (candidate.x + candidate.width / 2) * width - side / 2));
      const oy = Math.max(0, Math.min(height - side, (candidate.y + candidate.height / 2) * height - side / 2));
      confirmationContext.drawImage(frame, ox, oy, side, side, 0, 0, VERIFICATION_SIZE, VERIFICATION_SIZE);
      const landmarks = verifier.detect(confirmation).faceLandmarks?.[0];
      const nose = landmarks?.[NOSE_INDEX];
      const nx = nose ? (ox + nose.x * side) / width : NaN;
      const ny = nose ? (oy + nose.y * side) / height : NaN;
      if (!landmarks || landmarks.length < FACE_LANDMARK_COUNT || !Number.isFinite(nx) || !Number.isFinite(ny) ||
          nx < candidate.x || nx > candidate.x + candidate.width || ny < candidate.y || ny > candidate.y + candidate.height) {
        rejectedConfidence = Math.max(rejectedConfidence, score);
        continue;
      }
      return { present: true, confidence: score, cropped: Boolean(region), box: candidate, discontinuity };
    }
    return empty();
  };
  return {
    capturedFrame,
    get frameTimeMs() { return observedFrameTime * 1000; },
    detect(video, timestamp) {
      if (closed) throw new Error(PRESENCE_CLOSED);
      rejectedConfidence = 0;
      const nativeWidth = video.videoWidth, nativeHeight = video.videoHeight;
      if (!nativeWidth || !nativeHeight || video.readyState < 2) { previous = null; return empty(); }
      const frameTime = video.currentTime;
      if (observedVideo === video && frameTime === observedFrameTime && timestamp - observedAt < CAMERA_FRAME_STALE_MS) {
        return { ...empty(), pending: true }; // Polling is not a newly observed frame.
      }
      if (!Number.isFinite(frameTime) || (observedVideo === video && frameTime === observedFrameTime)) {
        previous = null;
        return { ...empty(), reason: 'camera-frame-stale' };
      }
      discontinuity = observedVideo !== null && (observedVideo !== video || frameTime < observedFrameTime ||
        (frameTime - observedFrameTime) * 1000 >= CAMERA_FRAME_STALE_MS || timestamp - observedAt >= CAMERA_FRAME_STALE_MS);
      if (discontinuity) previous = null;
      observedVideo = video; observedFrameTime = frameTime; observedAt = timestamp;
      // Keep the qualified detail envelope even when getUserMedia ignores its
      // ideal size. Preserve aspect/orientation, never stretch a portrait head.
      const factor = Math.min(1, PREVIEW_FRAME_LONG_SIDE / Math.max(nativeWidth, nativeHeight));
      capturedFrame.width = nativeWidth; capturedFrame.height = nativeHeight;
      capturedContext.drawImage(video, 0, 0, nativeWidth, nativeHeight);
      frame.width = Math.round(nativeWidth * factor); frame.height = Math.round(nativeHeight * factor);
      frameContext.drawImage(capturedFrame, 0, 0, frame.width, frame.height);
      const width = frame.width, height = frame.height;
      if (previous) {
        const side = Math.min(width, height, Math.max(Math.min(width, height) * MIN_TRACKED_ROI_FRACTION,
          Math.max(previous.width * width, previous.height * height) * TRACKED_FACE_MARGIN));
        const region = { x: Math.max(0, Math.min(width - side, (previous.x + previous.width / 2) * width - side / 2)),
          y: Math.max(0, Math.min(height - side, (previous.y + previous.height / 2) * height - side / 2)), width: side, height: side };
        const result = infer(timestamp, region);
        if (result.present) { previous = result.box; return result; }
        previous = null;
      }
      const full = infer(timestamp, null);
      if (full.present) { previous = full.box; return full; }
      for (let i = 0; i < SEARCHES_PER_FRAME; i++) {
        const tile = SEARCH_REGIONS[scan++ % SEARCH_REGIONS.length];
        const side = Math.min(width, height) * tile.scale;
        const result = infer(timestamp, { x: tile.x * (width - side), y: tile.y * (height - side), width: side, height: side });
        if (result.present) { previous = result.box; return result; }
      }
      return empty();
    },
    close() { if (closed) return; closed = true; previous = null; verifier.close(); detector.close(); },
  };
}
