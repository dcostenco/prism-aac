'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startHeadTracker,
  isHeadTrackingSupported,
  type HeadTrackerHandle,
} from '@/services/headTracker';
import {
  createGestureDetector,
  destroyGestureDetector,
  type GestureDetector,
  type GestureConfig,
} from '@/services/gestureService';
import {
  startReliabilityProbe,
  type ReliabilityProbeHandle,
} from '@/services/reliabilityProbe';
import {
  recordDriftEvent,
  isSafeMode,
  clearDriftHistory,
  SAFE_MODE_EFFECTS,
} from '@/services/safeMode';
import {
  startMotionMonitor,
  type MotionMonitorHandle,
} from '@/services/deviceMotion';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';

/* ─────────────────────────────────────────────────────────────────────────────
 *  HeadTrackingOverlay
 *
 *  Renders above all other content when head tracking is enabled:
 *    - Cursor dot (20px circle) following head position
 *    - Dwell progress ring around cursor
 *    - Highlight border on element under cursor
 *    - Camera PIP preview (80x60px corner)
 *    - Status indicator
 * ────────────────────────────────────────────────────────────────────────── */

type TrackingStatus = 'starting' | 'tracking' | 'lost' | 'stopped';

/* ── Hooks (co-located — only used by this component) ────────────────────── */

/**
 * Apply safe-mode caps to user settings without mutating the store.
 * Returns the *effective* values that should be sent to the tracker.
 * `safeMode` is read fresh on every render so a localStorage update from
 * another tab is reflected without a manual subscribe.
 */
function useSafeModeCaps(input: { sensitivity: number; dwellMs: number; gestureConfig: GestureConfig }) {
  const safeMode = isSafeMode();
  return {
    safeMode,
    effectiveSensitivity: safeMode
      ? Math.min(input.sensitivity, SAFE_MODE_EFFECTS.sensitivityCap)
      : input.sensitivity,
    effectiveDwellMs: safeMode ? input.dwellMs * SAFE_MODE_EFFECTS.dwellMultiplier : input.dwellMs,
    effectiveGestureConfig: safeMode ? { ...input.gestureConfig, enabled: false } : input.gestureConfig,
  };
}

/**
 * Background reliability probe lifecycle. While `driftToast` is set and
 * `driftAutoDisable` is on, runs a 1Hz camera probe that fires
 * `onRecover` once the user's face has been visible + stable for 10s.
 * Returns the streak progress (0..1) for UI display.
 */
function useReliabilityProbe(
  active: boolean,
  onRecover: () => void,
): number {
  const [progress, setProgress] = useState(0);
  const probeRef = useRef<ReliabilityProbeHandle | null>(null);
  // Stable ref so the effect doesn't re-create the probe when the
  // consumer's onRecover identity changes.
  const onRecoverRef = useRef(onRecover);
  onRecoverRef.current = onRecover;

  useEffect(() => {
    if (!active) {
      probeRef.current?.stop();
      probeRef.current = null;
      setProgress(0);
      return;
    }
    const probe = startReliabilityProbe({
      recoverFrames: 10,
      stableConfidenceFloor: 0.7,
      onTick: ({ streak }) => setProgress(streak / 10),
      onRecover: () => {
        probeRef.current = null;
        setProgress(0);
        onRecoverRef.current();
      },
    });
    probeRef.current = probe;
    return () => {
      probe.stop();
      probeRef.current = null;
      setProgress(0);
    };
  }, [active]);

  return progress;
}

/**
 * DeviceMotion shake monitor. Returns a ref whose `.current` is true
 * while the device is being bounced (laptop on lap in moving car).
 * The ref form lets the caller pass `() => ref.current` into the head
 * tracker without re-creating the tracker on state changes.
 */
function useMotionMonitor(active: boolean): React.MutableRefObject<boolean> {
  const isShakingRef = useRef(false);
  const monitorRef = useRef<MotionMonitorHandle | null>(null);

  useEffect(() => {
    if (!active) {
      monitorRef.current?.stop();
      monitorRef.current = null;
      isShakingRef.current = false;
      return;
    }
    isShakingRef.current = false;
    monitorRef.current = startMotionMonitor({
      onChange: (state) => { isShakingRef.current = state === 'shaking'; },
    });
    return () => {
      monitorRef.current?.stop();
      monitorRef.current = null;
      isShakingRef.current = false;
    };
  }, [active]);

  return isShakingRef;
}

export default function HeadTrackingOverlay() {
  const enabled = useSettingsStore((s) => s.headTrackingEnabled);
  const dwellMs = useSettingsStore((s) => s.headTrackingDwellMs);
  const sensitivity = useSettingsStore((s) => s.headTrackingSensitivity);
  const eyeGaze = useSettingsStore((s) => s.headTrackingEyeGaze);
  const eyeGazeWeight = useSettingsStore((s) => s.headTrackingEyeGazeWeight);
  const gestureConfig = useSettingsStore((s) => s.gestureConfig);
  const driftAutoDisable = useSettingsStore((s) => s.headTrackingDriftAutoDisable);
  const driftThresholdPx = useSettingsStore((s) => s.headTrackingDriftThresholdPx);
  const driftWindowMs = useSettingsStore((s) => s.headTrackingDriftWindowMs);
  const setSettings = useSettingsStore((s) => s.update);

  const { t } = useT();

  const [status, setStatus] = useState<TrackingStatus>('stopped');
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [dwellProgress, setDwellProgress] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  // When drift auto-disables tracking, surface a non-blocking toast so the
  // user knows what happened. Cleared when they re-enable manually OR when
  // the reliability probe auto-recovers.
  const [driftToast, setDriftToast] = useState<{ reason: string; ts: number } | null>(null);

  // Hooks — see top of file. Each encapsulates one side concern so this
  // component reads top-to-bottom as a tracker lifecycle, not a pile of
  // intertwined effects.
  const { safeMode, effectiveSensitivity, effectiveDwellMs, effectiveGestureConfig } =
    useSafeModeCaps({ sensitivity, dwellMs, gestureConfig });
  const probeProgress = useReliabilityProbe(
    Boolean(driftToast) && driftAutoDisable,
    useCallback(() => {
      setDriftToast(null);
      setSettings({ headTrackingEnabled: true });
    }, [setSettings]),
  );
  const isShakingRef = useMotionMonitor(enabled);

  const handleRef = useRef<HeadTrackerHandle | null>(null);
  const gestureDetectorRef = useRef<GestureDetector | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const dwellStartRef = useRef(0);
  const dwellElementRef = useRef<Element | null>(null);
  const rafDwellRef = useRef(0);

  // Dwell progress animation
  const animateDwellProgress = useCallback(function animate() {
    if (!dwellElementRef.current || dwellStartRef.current === 0) {
      setDwellProgress(0);
      return;
    }
    const elapsed = Date.now() - dwellStartRef.current;
    const progress = Math.min(1, elapsed / dwellMs);
    setDwellProgress(progress);
    if (progress < 1) {
      rafDwellRef.current = requestAnimationFrame(animate);
    }
  }, [dwellMs]);

  // Start / stop tracker based on enabled flag
  useEffect(() => {
    let mounted = true;
    if (!enabled || !isHeadTrackingSupported()) {
      if (handleRef.current) { handleRef.current.stop(); handleRef.current = null; }
      queueMicrotask(() => {
        if (mounted) setStatus('stopped');
      });
      return;
    }

    // Create gesture detector if gesture recognition is enabled. Safe mode
    // disables gestures so we use the effective config here too.
    if (effectiveGestureConfig.enabled) {
      gestureDetectorRef.current = createGestureDetector(effectiveGestureConfig, (event) => {
        const mapping = effectiveGestureConfig.mappings.find(m => m.gesture === event.gesture);
        if (mapping) {
          // Execute the mapped action — trigger a click on the matching button
          const target = document.querySelector(`[data-action="${mapping.action}"], [data-key="${mapping.action}"], #${mapping.action}`);
          if (target instanceof HTMLElement) {
            tapFeedback();
            target.click();
          }
        }
      });
    }

    const handle = startHeadTracker({
      dwellMs: effectiveDwellMs,
      sensitivity: effectiveSensitivity,
      smoothing: 0.15,
      useEyeGaze: eyeGaze,
      eyeGazeWeight,
      isDeviceShaking: () => isShakingRef.current,
      // Drift safety net — see services/headTrackerStability.ts. The
      // detector lives inside the tracker; here we just react to its
      // verdict by stopping the tracker and showing a recovery toast.
      // When auto-disable is OFF the user keeps their broken cursor
      // (legacy behavior). Default ON.
      driftThresholdPx,
      driftWindowMs,
      onDrift: (reason) => {
        if (!driftAutoDisable) return;
        setDriftToast({ reason, ts: Date.now() });
        // Record the drift event BEFORE flipping the toggle so a
        // re-mount caused by the setting change reads the updated
        // history from localStorage. After the second event in 5min,
        // the next tracker spin-up will be in safe mode automatically.
        recordDriftEvent(Date.now());
        // Flip the user-facing toggle off so the next render unmounts
        // the tracker cleanly. The `enabled` watcher above will run
        // handle.stop() for us.
        setSettings({ headTrackingEnabled: false });
      },
      onLandmarks: effectiveGestureConfig.enabled ? (data) => {
        gestureDetectorRef.current?.processFrame(data);
      } : undefined,
      onMove(x, y) {
        setCursorPos({ x, y });

        // Track which element is under cursor for highlight
        const el = document.elementFromPoint(x, y);
        const interactive = el?.closest('button, a, [role="button"], [data-dwell-target], .aac-btn') ?? null;
        if (interactive) {
          const rect = interactive.getBoundingClientRect();
          setHighlightRect(rect);
          if (interactive !== dwellElementRef.current) {
            dwellElementRef.current = interactive;
            dwellStartRef.current = Date.now();
            cancelAnimationFrame(rafDwellRef.current);
            rafDwellRef.current = requestAnimationFrame(animateDwellProgress);
          }
        } else {
          setHighlightRect(null);
          dwellElementRef.current = null;
          dwellStartRef.current = 0;
          setDwellProgress(0);
          cancelAnimationFrame(rafDwellRef.current);
        }
      },
      onDwell() {
        tapFeedback();
        setDwellProgress(0);
        dwellElementRef.current = null;
        dwellStartRef.current = 0;
      },
      onStatusChange(s) {
        setStatus(s);
      },
    });

    handleRef.current = handle;

    // Set up PIP preview: clone the video stream into a small visible element
    const checkVideo = setInterval(() => {
      if (handle.videoElement && handle.videoElement.srcObject && pipVideoRef.current) {
        pipVideoRef.current.srcObject = handle.videoElement.srcObject;
        pipVideoRef.current.play().catch(() => {});
        clearInterval(checkVideo);
      }
    }, 200);

    return () => {
      mounted = false;
      clearInterval(checkVideo);
      cancelAnimationFrame(rafDwellRef.current);
      handle.stop();
      handleRef.current = null;
      destroyGestureDetector();
      gestureDetectorRef.current = null;
    };
    // Re-create tracker when key settings change
  }, [enabled, effectiveDwellMs, effectiveSensitivity, eyeGaze, eyeGazeWeight, effectiveGestureConfig, driftAutoDisable, driftThresholdPx, driftWindowMs, setSettings, animateDwellProgress]);

  // Render the drift recovery toast even when tracking is disabled, so the
  // user has a visible "Try again" path that doesn't depend on the cursor.
  if (!enabled) {
    if (!driftToast) return null;
    const reasonLabel = driftToast.reason === 'confidence-collapse'
      ? (t('drift_confidence') ?? 'Face was hard to read — tracking paused.')
      : (t('drift_cursor') ?? 'Cursor drifted — tracking paused.');
    return (
      <div
        className="fixed inset-x-0 bottom-8 flex justify-center pointer-events-none"
        style={{ zIndex: 9999 }}
        role="status"
        aria-live="polite"
      >
        <div
          className="pointer-events-auto surface-bar border border-theme rounded-2xl px-5 py-4 shadow-xl flex items-center gap-3 max-w-md"
          style={{ borderColor: '#FF9800' }}
        >
          <span className="text-2xl">🛡️</span>
          <div className="flex-1">
            <div className="text-primary font-bold text-base">{reasonLabel}</div>
            <div className="text-muted text-sm mt-0.5">
              {t('drift_safety_explanation') ?? 'Auto-disabled to keep your screen usable. Press Esc anytime to disable tracking.'}
            </div>
            {driftAutoDisable && probeProgress > 0 && (
              <div className="mt-2" aria-live="polite">
                <div className="text-xs text-muted mb-1">
                  {t('drift_probe_checking') ?? 'Watching for stable conditions…'}
                </div>
                <div className="h-1.5 rounded-full bg-[rgba(0,0,0,0.15)] overflow-hidden">
                  <div
                    className="h-full bg-[#4CAF50] transition-all"
                    style={{ width: `${Math.round(probeProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="aac-btn min-h-[48px] px-4 rounded-xl bg-[#4CAF50] text-white font-bold border-0"
            onClick={() => {
              tapFeedback();
              // Manual retry is a vote of confidence — clear the drift
              // history so we exit safe mode if the user just tripped
              // their second event. If they trip a third within the
              // window, safe mode kicks back in automatically.
              clearDriftHistory();
              setDriftToast(null);
              setSettings({ headTrackingEnabled: true });
            }}
            aria-label={t('try_again') ?? 'Try again'}
          >
            {t('try_again') ?? 'Try again'}
          </button>
          <button
            type="button"
            className="aac-btn min-h-[48px] min-w-[48px] rounded-xl surface-key text-muted border border-theme"
            onClick={() => { tapFeedback(); setDriftToast(null); }}
            aria-label={t('dismiss') ?? 'Dismiss'}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  const statusLabel =
    status === 'starting' ? t('starting') :
    status === 'tracking' ? t('tracking') :
    status === 'lost' ? t('face_lost') :
    t('stopped');

  const statusColor =
    status === 'tracking' ? '#4CAF50' :
    status === 'lost' ? '#FF9800' :
    status === 'starting' ? '#2196F3' :
    '#999';

  // SVG dwell ring
  // SVG renders circle directly

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
      data-testid="head-tracking-overlay"
      data-status={status}
      data-safe-mode={safeMode ? 'true' : 'false'}
    >
      {/* ── Cursor dot + dwell ring — large and visible ── */}
      <div
        style={{
          position: 'absolute',
          left: cursorPos.x - 40,
          top: cursorPos.y - 40,
          width: 80,
          height: 80,
          transition: 'left 0.06s linear, top 0.06s linear',
        }}
      >
        {/* Dwell progress ring */}
        <svg width="80" height="80" style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
          {dwellProgress > 0 && (
            <circle
              cx="40" cy="40" r="35"
              fill="none"
              stroke="#4CAF50"
              strokeWidth="5"
              strokeDasharray={Math.PI * 70}
              strokeDashoffset={Math.PI * 70 * (1 - dwellProgress)}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          )}
        </svg>
        {/* Cursor dot — 36px, bright, with glow */}
        <div
          style={{
            position: 'absolute',
            left: 22,
            top: 22,
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: status === 'tracking' ? '#4CAF50' : '#FF9800',
            opacity: 0.9,
            boxShadow: `0 0 20px ${status === 'tracking' ? 'rgba(76,175,80,0.6)' : 'rgba(255,152,0,0.6)'}, 0 0 40px ${status === 'tracking' ? 'rgba(76,175,80,0.3)' : 'rgba(255,152,0,0.3)'}`,
            border: '3px solid white',
            animation: dwellProgress > 0 ? 'none' : 'pulse-cursor 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* ── Highlight border on interactive element ── */}
      {highlightRect && (
        <div
          style={{
            position: 'absolute',
            left: highlightRect.left - 3,
            top: highlightRect.top - 3,
            width: highlightRect.width + 6,
            height: highlightRect.height + 6,
            border: '3px solid #4CAF50',
            borderRadius: 8,
            transition: 'all 0.1s ease',
          }}
        />
      )}

      {/* ── Status indicator (top-center) ── */}
      <div
        data-testid="head-tracking-status"
        style={{
          position: 'absolute',
          top: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: statusColor,
            display: 'inline-block',
          }}
        />
        {statusLabel}
        {safeMode && (
          <span
            title={t('safe_mode_explainer') ?? 'Reduced sensitivity, longer dwell, gestures off'}
            style={{
              marginLeft: 8,
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: '#FF9800',
              color: '#000',
              letterSpacing: 0.4,
            }}
          >
            {t('safe_mode') ?? 'SAFE MODE'}
          </span>
        )}
      </div>

      {/* ── Camera PIP preview (top-left to avoid overlapping bottom-right interactive elements) ── */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 8,
          width: 80,
          height: 60,
          borderRadius: 8,
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.5)',
          backgroundColor: '#000',
        }}
      >
        <video
          ref={pipVideoRef}
          muted
          playsInline
          data-testid="head-tracking-pip"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // mirror for natural feel
          }}
        />
      </div>
    </div>
  );
}
