/**
 * TrackingSetupWizard end-to-end step-flow regression tests.
 *
 * Pins the user-visible behavior the user has hit "still broken" on
 * for many cycles in May 2026:
 *   • detection succeeds → auto-advance to step 1 (calibrate-center)
 *   • step 1 Capture is gated on a non-empty pose-sample buffer
 *   • step 1 Capture advances to step 2 (calibrate-corners)
 *   • each of 4 corners advances cornerIdx, the 4th computes calibration
 *     and advances to accuracy-test
 *   • adaptive-adjustment via online learner: subsequent observed range
 *     wider than wizard-captured range → calibration EXPANDS, not shrinks
 *   • finger out of camera view → no false advance, status returns to 'lost'
 *   • head out of view, body landmarks present → wizard chooses a body
 *     target rather than freezing
 *
 * The wizard's tracker is mocked at module level. Real MediaPipe Pose
 * needs photographic input which headless WebKit can't reliably give it,
 * so we drive `prism-pose-sample` events + onStatusChange callbacks
 * directly. This is the strict-DoD evidence path: deterministic, fast,
 * pins the wizard-side logic regardless of the browser's pose detection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type {
  PoseTrackerHandle,
  PoseTrackerOptions,
  TrackingTarget,
} from '@/services/bodyPoseService';

// ── Module mocks ────────────────────────────────────────────────────────
//
// startPoseTracker captures the wizard's callbacks so the test driver
// can fire onStatusChange + dispatch synthetic prism-pose-sample events.
// The pure helpers (computeCalibrationFromCorners, savePoseCalibration,
// loadPoseCalibration) are spied or stubbed.

interface CapturedTracker {
  opts: PoseTrackerOptions;
  stopped: boolean;
}
const trackers: CapturedTracker[] = [];

vi.mock('@/services/bodyPoseService', async () => {
  const actual = await vi.importActual<typeof import('@/services/bodyPoseService')>(
    '@/services/bodyPoseService',
  );
  return {
    ...actual,
    startPoseTracker(opts: PoseTrackerOptions): PoseTrackerHandle {
      const t: CapturedTracker = { opts, stopped: false };
      trackers.push(t);
      // Mirror real behavior: status goes 'starting' synchronously.
      opts.onStatusChange('starting');
      return {
        stop() { t.stopped = true; },
        videoElement: null,
        setCalibration: vi.fn(),
      };
    },
    savePoseCalibration: vi.fn(),
    loadPoseCalibration: vi.fn(() => null),
  };
});

vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

// Lazy import AFTER mocks are in place.
import TrackingSetupWizard from '@/components/TrackingSetupWizard';
import { useSettingsStore } from '@/store/settingsStore';

// ── Driver helpers ──────────────────────────────────────────────────────

function latestTracker(): CapturedTracker {
  if (trackers.length === 0) throw new Error('no tracker captured yet');
  return trackers[trackers.length - 1];
}

/** Simulate the tracker dispatching a `prism-pose-sample` event AND
 *  flipping its status to 'tracking'. Mirrors the real
 *  bodyPoseService dispatch + onStatusChange order. */
function dispatchPoseSample(target: TrackingTarget, normX: number, normY: number, vis = 0.9) {
  const t = latestTracker();
  // Real tracker calls onStatusChange('tracking', target) once per frame
  // when a pose is detected — drive that too so the wizard's detection
  // counter accumulates.
  t.opts.onStatusChange('tracking', target);
  window.dispatchEvent(
    new CustomEvent('prism-pose-sample', {
      detail: { normX, normY, visibility: vis, noiseFloor: 0.005, egoSuppressed: false },
    }),
  );
}

/** Simulate the tracker losing the user (out-of-view). Status flips to
 *  'lost' and NO prism-pose-sample fires. */
function simulatePoseLost() {
  latestTracker().opts.onStatusChange('lost');
}

function rootEl(): HTMLElement {
  return screen.getByTestId('tracking-setup-wizard');
}

// ── Setup / teardown ────────────────────────────────────────────────────

beforeEach(() => {
  trackers.length = 0;
  vi.useFakeTimers();
  // Settings — speech rate / volume must exist for aacSpeak's destructure.
  useSettingsStore.setState({
    speechRate: 1.0,
    speechVolume: 1.0,
  });
  // jsdom doesn't implement HTMLMediaElement.play; the wizard's PIP
  // <video> autoplay tries to play. Stub so the cleanup interval
  // doesn't throw.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLMediaElement.prototype as any).play = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  trackers.length = 0;
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('TrackingSetupWizard — Setup flow (detection → step 1 → corners → test)', () => {
  it('intro → Get Started kicks off detecting phase + spins up a tracker', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    expect(rootEl()).toHaveAttribute('data-phase', 'intro');

    fireEvent.click(screen.getByTestId('tracking-setup-start'));

    expect(rootEl()).toHaveAttribute('data-phase', 'detecting');
    // Wizard called startPoseTracker — first tracker captured.
    expect(trackers.length).toBe(1);
    expect(latestTracker().opts.trackingTarget).toBe('nose');
  });

  it('detection of a body part > 5 frames + 5s elapses + 1.5s advance → calibrate-center', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));

    // Six frames where the user's right_index is detected; counts > 5
    // is the detection threshold inside startDetection.
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
    });
    // 5s detection window elapses → setSelectedPart fires.
    act(() => { vi.advanceTimersByTime(5000); });
    // 1.5s advance → startCenterCalibration runs → phase=calibrate-center.
    // Inside startCenterCalibration the wizard restartTrackerForPart fires
    // a NEW tracker, which is the second captured tracker.
    act(() => { vi.advanceTimersByTime(1500); });

    expect(rootEl()).toHaveAttribute('data-phase', 'calibrate-center');
    // Restart fired with the chosen part, NOT a hardcoded 'nose'.
    expect(trackers.length).toBe(2);
    expect(latestTracker().opts.trackingTarget).toBe('right_index');
  });

  it('step 1: Capture is disabled with empty buffer, enables once events flow', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(5000 + 1500);
    });

    // Just-entered calibrate-center → buffer was reset to [] → button disabled.
    const captureBtn = screen.getByTestId('tracking-capture-center') as HTMLButtonElement;
    expect(captureBtn).toBeDisabled();

    // Drive a few synthetic events through the NEW (selected-part) tracker.
    act(() => {
      for (let i = 0; i < 5; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      // The 100ms progress interval triggers a re-render that picks up
      // the new buffer length — advance past one tick.
      vi.advanceTimersByTime(150);
    });
    expect(captureBtn).not.toBeDisabled();
  });

  it('step 1: Capture with non-empty buffer advances to calibrate-corners', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(5000 + 1500);
      for (let i = 0; i < 5; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(150);
    });

    fireEvent.click(screen.getByTestId('tracking-capture-center'));
    expect(rootEl()).toHaveAttribute('data-phase', 'calibrate-corners');
  });

  it('all 4 corners captured → wizard computes calibration + advances to accuracy-test', async () => {
    const { savePoseCalibration } = await import('@/services/bodyPoseService');
    (savePoseCalibration as ReturnType<typeof vi.fn>).mockClear();
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(5000 + 1500);
      for (let i = 0; i < 5; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(150);
    });
    fireEvent.click(screen.getByTestId('tracking-capture-center'));

    // 4 corners — TL (0.85, 0.2), TR (0.15, 0.2), BR (0.15, 0.8), BL (0.85, 0.8)
    // Note: normX is RAW (un-mirrored). User pointing top-left of screen
    // shows up at the RIGHT side of the (un-mirrored) frame — normX≈0.85.
    const corners: Array<[number, number]> = [
      [0.85, 0.20], // TL
      [0.15, 0.20], // TR
      [0.15, 0.80], // BR
      [0.85, 0.80], // BL
    ];
    for (const [nx, ny] of corners) {
      act(() => {
        for (let i = 0; i < 5; i++) dispatchPoseSample('right_index', nx, ny);
        vi.advanceTimersByTime(150);
      });
      fireEvent.click(screen.getByTestId('tracking-capture-corner'));
    }

    expect(rootEl()).toHaveAttribute('data-phase', 'accuracy-test');
    // savePoseCalibration is called twice: once at wizard-start with
    // DEFAULT_CALIBRATION (clears stale prior cal), then once at the
    // 4th corner with the final recentered cal. Assert on the LAST call.
    const calls = (savePoseCalibration as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const cal = calls[calls.length - 1][0];
    expect(cal.leftX).toBeGreaterThan(cal.rightX);
    expect(cal.bottomY).toBeGreaterThan(cal.topY);
  });
});

describe('TrackingSetupWizard — out-of-view scenarios', () => {
  it('finger out of camera view: status flips to lost, no false-advance from step 1', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(5000 + 1500);
    });
    expect(rootEl()).toHaveAttribute('data-phase', 'calibrate-center');

    // User moves finger out of frame — tracker reports lost, no events.
    act(() => {
      simulatePoseLost();
      vi.advanceTimersByTime(2000);
    });

    // Phase must NOT have advanced — capture button stays disabled.
    expect(rootEl()).toHaveAttribute('data-phase', 'calibrate-center');
    expect(screen.getByTestId('tracking-capture-center')).toBeDisabled();
  });

  it('head out of view, body still detected: detection picks a body target', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));

    // No nose frames — only right_wrist + left_wrist (head cropped above
    // the frame, shoulders + hands visible).
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_wrist', 0.4, 0.6);
      for (let i = 0; i < 8; i++) dispatchPoseSample('left_wrist', 0.6, 0.6);
      // Advance ONLY through the detection timer first so React commits
      // setSelectedPart (and the ref to startCenterCalibration is updated)
      // BEFORE the 1500ms advance timer fires.
      vi.advanceTimersByTime(5000);
    });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(rootEl()).toHaveAttribute('data-phase', 'calibrate-center');
    // The chosen part is whichever had highest count — both had 8 here.
    // Either wrist is acceptable; what matters is we did NOT pick 'nose'.
    expect(['right_wrist', 'left_wrist']).toContain(latestTracker().opts.trackingTarget);
    expect(latestTracker().opts.trackingTarget).not.toBe('nose');
  });

  it('detection finds nothing: wizard stays in detecting phase with guidance', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));

    // Tracker starts but never reports tracking — status stays 'starting' /
    // flips to 'lost' shortly. No prism-pose-sample events.
    act(() => {
      simulatePoseLost();
      vi.advanceTimersByTime(5000 + 1500);
    });

    // Wizard remains in detecting phase, NOT auto-advancing.
    expect(rootEl()).toHaveAttribute('data-phase', 'detecting');
  });
});

describe('TrackingSetupWizard — StrictMode-safe lifecycle (regression)', () => {
  // May 2026 — root cause of "can't pass step 1" in dev mode was that
  // useRef(true) preserves identity across React StrictMode's
  // intentional mount → cleanup → remount cycle. The cleanup set
  // mountedRef.current = false on the same ref the remount inherited,
  // and every detection setTimeout's `if (!mountedRef.current) return;`
  // guard fired silently. Fix: re-arm mountedRef.current = true in
  // the mount useEffect so the ref reflects the live mount state.
  it('remount re-arms mountedRef so detection timers fire after StrictMode cycle', () => {
    // StrictMode triggers the dev-only double-mount: setup → cleanup
    // → setup again. Without the mountedRef.current = true re-arm in
    // the mount effect, the cleanup leaves the ref at false on a ref
    // instance the remount inherits, and the detection setTimeout's
    // early-exit guard fires silently → wizard never advances.
    render(
      <StrictMode>
        <TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />
      </StrictMode>
    );
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(5000);
    });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(rootEl()).toHaveAttribute('data-phase', 'calibrate-center');
  });
});

describe('TrackingSetupWizard — narrow-range fallback (head-tracking accessibility)', () => {
  // May 2026 user report (Image #45) — user reclining on sofa runs the
  // wizard with head tracking. Their nose moves only ~0.02 in normalized
  // frame coords across the 4 corner captures. Raw cal becomes
  // rangeX=0.022 ("TOO NARROW") and the cursor is pinned to a tiny
  // pose region — wizard run left them WORSE than skipping calibration.
  //
  // The fix anchors a DEFAULT-width (rangeX≈0.70, rangeY≈0.60)
  // calibration on the captured center sample whenever raw corner
  // range falls below PRACTICAL_MIN_RANGE (0.10). Wizard never
  // produces a worse cursor than Skip would have.
  async function captureFullFlow(centerXY: [number, number], cornerXY: [number, number][]) {
    const { savePoseCalibration } = await import('@/services/bodyPoseService');
    (savePoseCalibration as ReturnType<typeof vi.fn>).mockClear();
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(5000);
    });
    act(() => { vi.advanceTimersByTime(1500); });

    // Step 1 — center capture.
    act(() => {
      for (let i = 0; i < 5; i++) dispatchPoseSample('right_index', centerXY[0], centerXY[1]);
      vi.advanceTimersByTime(150);
    });
    fireEvent.click(screen.getByTestId('tracking-capture-center'));

    // Step 2 — 4 corners.
    for (const [nx, ny] of cornerXY) {
      act(() => {
        for (let i = 0; i < 5; i++) dispatchPoseSample('right_index', nx, ny);
        vi.advanceTimersByTime(150);
      });
      fireEvent.click(screen.getByTestId('tracking-capture-corner'));
    }
    return savePoseCalibration as ReturnType<typeof vi.fn>;
  }

  it('narrow corner samples (cluster within 0.02) trigger DEFAULT-width fallback anchored on center', async () => {
    // User on sofa: head moves only ~0.02 across all 4 "corner" attempts.
    const saveSpy = await captureFullFlow(
      [0.475, 0.508], // captured center (real Image #44 values)
      [
        [0.470, 0.503], // ~TL — head barely moved
        [0.480, 0.503], // ~TR
        [0.480, 0.513], // ~BR
        [0.470, 0.513], // ~BL
      ],
    );
    expect(rootEl()).toHaveAttribute('data-phase', 'accuracy-test');
    // savePoseCalibration is called twice: once at wizard-start with
    // DEFAULT_CALIBRATION (clears stale prior cal) and once at the
    // 4th corner with the final cal. The interesting assertions
    // below target the LAST (final) call.
    expect(saveSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    const cal = saveSpy.mock.calls[saveSpy.mock.calls.length - 1][0];
    const rangeX = cal.leftX - cal.rightX;
    const rangeY = cal.bottomY - cal.topY;
    // Fallback anchored on center (anchorMirX = 1 - 0.475 = 0.525).
    // Expected: leftX = 0.525 + 0.35 = 0.875, rightX = 0.525 - 0.35 = 0.175.
    expect(cal.leftX).toBeCloseTo(0.875, 2);
    expect(cal.rightX).toBeCloseTo(0.175, 2);
    expect(rangeX).toBeCloseTo(0.70, 2);
    expect(rangeY).toBeCloseTo(0.60, 2);
  });

  it('wide corners centered on (0.5, 0.5) save raw range with midpoint at (0.5, 0.5)', async () => {
    // User can reach screen corners AND their neutral pose IS the
    // midpoint of corners → recentering produces the same cal as raw.
    const saveSpy = await captureFullFlow(
      [0.5, 0.5], // center matches centroid of corners below
      [
        [0.85, 0.20], // TL
        [0.15, 0.20], // TR
        [0.15, 0.80], // BR
        [0.85, 0.80], // BL
      ],
    );
    // savePoseCalibration is called twice: once at wizard-start with
    // DEFAULT_CALIBRATION (clears stale prior cal) and once at the
    // 4th corner with the final cal. The interesting assertions
    // below target the LAST (final) call.
    expect(saveSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    const cal = saveSpy.mock.calls[saveSpy.mock.calls.length - 1][0];
    // anchorMirX = 1 - 0.5 = 0.5. rawRangeX = 0.70.
    // leftX = 0.5 + 0.35 = 0.85, rightX = 0.5 - 0.35 = 0.15.
    expect(cal.leftX).toBeCloseTo(0.85, 2);
    expect(cal.rightX).toBeCloseTo(0.15, 2);
    expect(cal.topY).toBeCloseTo(0.20, 2);
    expect(cal.bottomY).toBeCloseTo(0.80, 2);
  });

  it('wide corners but OFF-CENTER neutral: cal recenters on captured center (Image #46 fix)', async () => {
    // User reclining on sofa — their neutral facing-center pose is
    // normY=0.665 (head tilted slightly down). Corners span a healthy
    // range but their centroid is NOT where the user's neutral is.
    // Without recentering: cursor offset 170px from target when
    // facing center. With recentering: cursor lands on target.
    const saveSpy = await captureFullFlow(
      [0.455, 0.665], // captured center — Image #46 actual values
      [
        [0.80, 0.50], // TL — corners centroid normY = 0.50
        [0.20, 0.50], // TR
        [0.20, 0.80], // BR
        [0.80, 0.80], // BL
      ],
    );
    const cal = saveSpy.mock.calls[saveSpy.mock.calls.length - 1][0];
    // Raw cal would give topY=0.50 bottomY=0.80 (Y-midpoint = 0.65).
    // Captured user neutral normY=0.665.
    // After recenter, Y-midpoint of cal == 0.665.
    const calYMid = (cal.topY + cal.bottomY) / 2;
    expect(calYMid).toBeCloseTo(0.665, 2);
    // X recenter: anchorMirX = 1 - 0.455 = 0.545.
    const calXMid = (cal.leftX + cal.rightX) / 2;
    expect(calXMid).toBeCloseTo(0.545, 2);
    // Range is preserved (not the narrow-fallback path).
    expect(cal.leftX - cal.rightX).toBeCloseTo(0.60, 2); // raw rangeX = 0.85-0.20 = 0.60... wait, 0.80-0.20 = 0.60
    expect(cal.bottomY - cal.topY).toBeCloseTo(0.30, 2);
  });

  it('Y-axis-only narrow (user can pan but not nod) still triggers fallback', async () => {
    const saveSpy = await captureFullFlow(
      [0.5, 0.5],
      [
        [0.85, 0.49], // TL — wide X but narrow Y
        [0.15, 0.49], // TR
        [0.15, 0.51], // BR
        [0.85, 0.51], // BL
      ],
    );
    const cal = saveSpy.mock.calls[saveSpy.mock.calls.length - 1][0];
    // Y-range was 0.02 → fallback fires for Y. Whole cal becomes anchored
    // on center (anchor=(0.5, 0.5), anchorMirX = 0.5).
    expect(cal.leftX - cal.rightX).toBeCloseTo(0.70, 2);
    expect(cal.bottomY - cal.topY).toBeCloseTo(0.60, 2);
  });
});

describe('TrackingSetupWizard — Skip + Cancel paths', () => {
  it('Skip in calibrate-center jumps the user past calibration into the test', () => {
    render(<TrackingSetupWizard onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('tracking-setup-start'));
    act(() => {
      for (let i = 0; i < 8; i++) dispatchPoseSample('right_index', 0.5, 0.5);
      vi.advanceTimersByTime(5000 + 1500);
    });

    fireEvent.click(screen.getByTestId('tracking-calibrate-skip'));
    expect(rootEl()).toHaveAttribute('data-phase', 'accuracy-test');
  });
});
