import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startWristPresence } from '@/services/wristPresence';
import type { HandLandmarks } from '@/services/handProfileService';

const detector = vi.hoisted(() => ({ init: vi.fn(), detect: vi.fn() }));
vi.mock('@/services/handProfileService', () => ({ initHandDetector: detector.init, detectHand: detector.detect }));
const SIZES = [[640, 480], [480, 640], [320, 240], [240, 320]];
const DRIFTS = [0, 0.003, 0.015];
const wrist = { x: 0.5, y: 0.6 };
const palm = () => Array.from({ length: 21 }, (_, i): HandLandmarks => ({
  x: i === 5 ? 0.4 : i === 17 ? 0.6 : 0.5, y: i === 9 ? 0.35 : 0.5, z: 0,
}));
let draw: ReturnType<typeof vi.fn>;
beforeEach(() => {
  detector.init.mockReset().mockResolvedValue(true);
  detector.detect.mockReset().mockImplementation(palm);
  draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw } as never);
});
afterEach(() => vi.restoreAllMocks());

describe.each(DRIFTS)('same-frame hand confirmation, drift=%s', drift => {
  it('returns the measured hand wrist rather than the coarse pose ROI seed', async () => {
    const presence = await startWristPresence();
    const frame = document.createElement('canvas'); frame.width = 640; frame.height = 480;
    const hand = palm(); hand[0].x = 0.55; detector.detect.mockReturnValue(hand);
    const point = { x: wrist.x + drift, y: wrist.y + drift / 2 };
    expect(presence.measure(frame, point, 100)).toEqual({ x: point.x + 0.05 * (480 * 0.4) / 640, y: point.y });
    detector.detect.mockReturnValue(null);
    expect(presence.measure(frame, point, 200)).toBeNull();
    presence.close();
  });
  it.each(SIZES)('preserves aspect and associates wrist using native pixel distances at %sx%s', async (width, height) => {
    const presence = await startWristPresence();
    const frame = document.createElement('canvas'); frame.width = width; frame.height = height;
    const point = { x: wrist.x + drift, y: wrist.y + drift / 2 };
    expect(presence.confirm(frame, point, 100)).toBe(true);
    const side = Math.min(width, height) * 0.4;
    expect(draw).toHaveBeenCalledWith(frame, point.x * width - side / 2, point.y * height - side / 2,
      side, side, 0, 0, 256, 256);
    expect(detector.detect).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 100);
    detector.detect.mockReturnValueOnce(null);
    expect(presence.confirm(frame, point, 200)).toBe(false); // A cached hand is not current evidence.
    expect(presence.confirm(frame, point, 300)).toBe(true); // A missed frame is recoverable.
    presence.close();
    expect(presence.confirm(frame, point, 400)).toBe(false);
    expect(detector.detect).toHaveBeenCalledTimes(3);
  });
  it('does not accept a hand elsewhere in the crop or malformed landmarks', async () => {
    const presence = await startWristPresence();
    const frame = document.createElement('canvas'); frame.width = 640; frame.height = 480;
    const malformed = [null, [], palm().slice(1), palm().map(p => ({ ...p, x: NaN })),
      palm().map(p => ({ ...p, y: 2 })), palm().map(p => ({ ...p, x: p.x + 0.4 }))];
    for (const hand of malformed) {
      detector.detect.mockReturnValueOnce(hand);
      expect(presence.confirm(frame, { x: wrist.x + drift, y: wrist.y }, 100)).toBe(false);
    }
    expect(presence.confirm(frame, { x: NaN, y: wrist.y }, 200)).toBe(false);
    presence.close();
  });
});
it('fails closed if the existing shared detector cannot initialize', async () => {
  detector.init.mockResolvedValue(false);
  await expect(startWristPresence()).rejects.toThrow('wrist-presence-detector-unavailable');
  expect(detector.detect).not.toHaveBeenCalled();
});
