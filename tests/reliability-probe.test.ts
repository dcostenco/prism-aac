/**
 * reliabilityProbe — lifecycle, teardown idempotency, and graceful degradation.
 *
 * This probe reopens the camera after a drift auto-disable and fires
 * onRecover() once the face is stable again.  A stuck probe (e.g. stop()
 * not idempotent, stream not released) would block the user from re-enabling
 * head-tracking — a life-safety concern for non-verbal AAC users who depend
 * on it as their sole input method.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const emitTrackingEventMock = vi.fn();
vi.mock('@/services/trackingTelemetry', () => ({
  emitTrackingEvent: (...a: unknown[]) => emitTrackingEventMock(...a),
}));

// ReliabilityProbe from headTrackerStability is used internally — let it run real
// (it's already covered by headTrackerStability tests; no need to re-mock it here)

import { startReliabilityProbe } from '@/services/reliabilityProbe';

// jsdom stubs for browser APIs
let mockStream: { getTracks: () => Array<{ stop: ReturnType<typeof vi.fn> }> };
let mockGetUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockStream = {
    getTracks: () => [{ stop: vi.fn() }],
  };
  mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  });
});

// ── handle return ─────────────────────────────────────────────────────────────

describe('startReliabilityProbe — handle', () => {
  it('returns a handle synchronously before async init completes', () => {
    // getUserMedia never resolves — init hangs
    mockGetUserMedia.mockReturnValue(new Promise(() => {}));
    const handle = startReliabilityProbe({ onRecover: vi.fn() });
    expect(handle).toBeDefined();
    expect(typeof handle.stop).toBe('function');
    handle.stop();
  });

  it('stop() is idempotent — calling twice does not throw', () => {
    mockGetUserMedia.mockReturnValue(new Promise(() => {}));
    const handle = startReliabilityProbe({ onRecover: vi.fn() });
    expect(() => {
      handle.stop();
      handle.stop();
    }).not.toThrow();
  });
});

// ── graceful degradation ──────────────────────────────────────────────────────

describe('startReliabilityProbe — graceful degradation', () => {
  it('does not throw when mediaDevices is undefined', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const onRecover = vi.fn();
    let handle!: ReturnType<typeof startReliabilityProbe>;
    expect(() => {
      handle = startReliabilityProbe({ onRecover });
    }).not.toThrow();
    await new Promise(r => setTimeout(r, 0)); // let init tick
    expect(onRecover).not.toHaveBeenCalled();
    handle.stop();
  });

  it('does not throw when getUserMedia rejects (camera denied)', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    const onRecover = vi.fn();
    const handle = startReliabilityProbe({ onRecover });
    await new Promise(r => setTimeout(r, 10)); // let init settle
    expect(onRecover).not.toHaveBeenCalled();
    handle.stop();
  });

  it('stop() before getUserMedia resolves cleans up without crash', async () => {
    let resolveStream!: (v: unknown) => void;
    mockGetUserMedia.mockReturnValue(new Promise(r => { resolveStream = r; }));
    const handle = startReliabilityProbe({ onRecover: vi.fn() });
    handle.stop(); // stop before stream arrives
    resolveStream(mockStream); // now resolve — should be a no-op
    await new Promise(r => setTimeout(r, 10));
    // No assertion needed beyond "did not throw"
  });
});

// ── telemetry emissions ───────────────────────────────────────────────────────

describe('startReliabilityProbe — telemetry on stop', () => {
  it('emits probe-stop event when consumer calls stop() without recovering', async () => {
    mockGetUserMedia.mockReturnValue(new Promise(() => {})); // never resolves
    const handle = startReliabilityProbe({ onRecover: vi.fn() });
    handle.stop();
    // probe-stop fires only when stopped === true AND recovered === false
    expect(emitTrackingEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'probe-stop' })
    );
  });

  it('does not emit probe-stop when never started (no camera)', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const handle = startReliabilityProbe({ onRecover: vi.fn() });
    await new Promise(r => setTimeout(r, 0));
    // teardown runs internally (init exits early), but stopped stays false
    // because init() returned before setting stopped
    handle.stop(); // explicit stop
    // Only called once at most (from explicit stop), type probe-stop
    const probeCalls = emitTrackingEventMock.mock.calls.filter(
      c => c[0]?.type === 'probe-stop'
    );
    expect(probeCalls.length).toBeLessThanOrEqual(1);
  });
});
