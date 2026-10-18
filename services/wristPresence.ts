import { detectHand, initHandDetector } from './handProfileService';

const ROI_SIZE = 256;
const ROI_FRAME_FRACTION = 0.4;
const HAND_POINTS = 21;
const WRIST = 0, INDEX_MCP = 5, MIDDLE_MCP = 9, PINKY_MCP = 17;
type Point = { x: number; y: number };
export interface WristPresenceHandle {
  measure(frame: HTMLCanvasElement | HTMLVideoElement, wrist: Point, timestamp: number): Point | null;
  confirm(frame: HTMLCanvasElement | HTMLVideoElement, wrist: Point, timestamp: number): boolean;
  close(): void;
}

/** Pose may infer an occluded wrist. Require a hand in that wrist's local
 * pixels, within one measured palm size. This confirms presence, not identity
 * or intent. Return the measured hand wrist, not the coarse pose seed;
 * motion/dwell still qualify selection. Never reuse an earlier observation. */
export async function startWristPresence(): Promise<WristPresenceHandle> {
  if (!await initHandDetector()) throw new Error('wrist-presence-detector-unavailable');
  const crop = document.createElement('canvas'); crop.width = crop.height = ROI_SIZE;
  const context = crop.getContext('2d');
  if (!context) throw new Error('wrist-presence-canvas-unavailable');
  let closed = false;
  const measure: WristPresenceHandle['measure'] = (frame, wrist, timestamp) => {
      if (closed || ![wrist.x, wrist.y, timestamp].every(Number.isFinite) ||
          wrist.x < 0 || wrist.x > 1 || wrist.y < 0 || wrist.y > 1) return null;
      const width = frame instanceof HTMLVideoElement ? frame.videoWidth : frame.width;
      const height = frame instanceof HTMLVideoElement ? frame.videoHeight : frame.height;
      if (width <= 0 || height <= 0) return null;
      const side = Math.min(width, height) * ROI_FRAME_FRACTION;
      const x = Math.max(0, Math.min(width - side, wrist.x * width - side / 2));
      const y = Math.max(0, Math.min(height - side, wrist.y * height - side / 2));
      context.drawImage(frame, x, y, side, side, 0, 0, ROI_SIZE, ROI_SIZE);
      const hand = detectHand(crop, timestamp);
      if (!hand || hand.length !== HAND_POINTS || hand.some(p =>
        ![p.x, p.y, p.z].every(Number.isFinite) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return null;
      const anchor = hand[WRIST];
      const palm = Math.max(Math.hypot(anchor.x - hand[MIDDLE_MCP].x, anchor.y - hand[MIDDLE_MCP].y),
        Math.hypot(hand[INDEX_MCP].x - hand[PINKY_MCP].x, hand[INDEX_MCP].y - hand[PINKY_MCP].y)) * side;
      const point = { x: (x + anchor.x * side) / width, y: (y + anchor.y * side) / height };
      return palm > 0 && Math.hypot((wrist.x - point.x) * width, (wrist.y - point.y) * height) <= palm ? point : null;
  };
  return {
    measure,
    confirm: (...args) => measure(...args) !== null,
    // The existing detector is shared with touch calibration and deliberately
    // survives modal transitions on Safari. Release only this owner's canvas.
    close() { closed = true; crop.width = crop.height = 0; },
  };
}
