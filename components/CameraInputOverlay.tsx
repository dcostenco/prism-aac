'use client';

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { subscribeCameraSelection, readCameraSelectionState } from '@/services/cameraSelection';
import { resolveDwellTarget } from '@/services/dwellTarget';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startPoseTracker,
  isPoseTrackingSupported,
  type PoseTrackerHandle,
  type TrackingTarget,
} from '@/services/bodyPoseService';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { trackingLossKey } from '@/services/trackingFeedback';
import type { TrackingLossReason } from '@/services/trackingDiagnostics';
import TrackingSelectionNotice from './TrackingSelectionNotice';
import { isCameraCursorTarget } from '@/services/cameraTrackingTargets';
import { wristSelectionDwellMs } from '@/services/wristMotion';

/**
 * Camera Input Overlay — opt-in camera-based finger/arm tracking.
 *
 * Uses MediaPipe Pose to detect the user's finger/arm position via
 * the webcam and maps it to cursor position on screen.
 *
 * DISABLED BY DEFAULT (settingsStore.cameraInputEnabled = false).
 * Users opt in via Settings → Input modes. The accuracy regression in
 * v0.2.x made the overlay interfere with mouse use; we force-disable
 * on migration to v9 and let users re-enable explicitly.
 *
 * Tracking targets: right_wrist (default), right_index, left_index,
 * left_wrist, right_elbow, left_elbow, nose, etc.
 */

type Status = 'starting' | 'tracking' | 'lost' | 'stopped';
const NO_INTERACTION_MS = 45_000;
const CAMERA_KEY_SELECTOR = 'button[data-key], button[data-action]';
function cameraKeyTarget(target: Element | null): HTMLElement | null {
  return target instanceof HTMLElement && target.matches(CAMERA_KEY_SELECTOR) ? target : null;
}

export default function CameraInputOverlay() {
  const { t } = useT();
  const enabled = useSettingsStore(s => s.cameraInputEnabled && isCameraCursorTarget(s.cameraTrackingTarget));
  const ownershipEpoch = useSyncExternalStore(subscribeCameraSelection,
    () => readCameraSelectionState().epoch, () => 0);
  const selectionBlocked = readCameraSelectionState().blocked;
  const calGeneration = useSettingsStore(s => s.poseCalibrationGeneration);
  const target = useSettingsStore(s => s.cameraTrackingTarget) as TrackingTarget;
  const configuredDwellMs = useSettingsStore(s => s.headTrackingDwellMs);
  const dwellMs = wristSelectionDwellMs(configuredDwellMs);
  const sensitivity = useSettingsStore(s => s.headTrackingSensitivity);

  const [status, setStatus] = useState<Status>('stopped');
  const [lossReason, setLossReason] = useState<TrackingLossReason | null>(null);
  const [motionPaused, setMotionPaused] = useState(false);
  const [selectionReady, setSelectionReady] = useState(false);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const lockedElementRef = useRef<Element | null>(null);
  const selectionReadyRef = useRef(false);
  const pauseObservedAtRef = useRef(0);
  const [activeTarget, setActiveTarget] = useState(target);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [dwellProgress, setDwellProgress] = useState(0);

  const handleRef = useRef<PoseTrackerHandle | null>(null);
  const [resumeGeneration, setResumeGeneration] = useState(0);
  const dwellStartRef = useRef(0);
  const dwellElementRef = useRef<Element | null>(null);
  const rafRef = useRef(0);
  const highlightedKeyRef = useRef<HTMLElement | null>(null);
  const [keyBubble, setKeyBubble] = useState<{ char: string; x: number; y: number; visible: boolean }>({ char: '', x: 0, y: 0, visible: false });
  // Cursor radius — sized to ~45% of the nearest AAC letter key height so
  // the cursor gives the user a realistic sense of dwell precision without
  // obscuring the button label. Re-measured on mount and every resize.
  const [cursorRadius, setCursorRadius] = useState(14);
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLElement>('[data-key]');
      if (el) {
        const h = el.getBoundingClientRect().height;
        if (h > 0) setCursorRadius(Math.max(10, Math.min(32, Math.round(h * 0.45))));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  // Stuck-cursor / no-interaction auto-disable. Tracks the most recent
  // dwell-trigger timestamp + cursor position samples so we can detect
  // a user whose calibration is so off the cursor never reaches a
  // button. Fixes May 2026 user report — "uncalibrated finger" left
  // them unable to reach Settings, no auto-detect fired because the
  // existing drift detector lives only in HeadTrackingOverlay.
  const lastDwellTsRef = useRef(0);
  const enabledAtRef = useRef(0);
  const cursorWindowRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const [stuckToast, setStuckToast] = useState(false);
  const [stuckReason, setStuckReason] = useState<'no-interaction' | 'pinned'>('no-interaction');
  const [recalToast, setRecalToast] = useState(false);
  useEffect(() => {
    const handler = () => {
      setRecalToast(true);
      setTimeout(() => setRecalToast(false), 12_000);
    };
    window.addEventListener('prism-recalibration-needed', handler);
    return () => window.removeEventListener('prism-recalibration-needed', handler);
  }, []);
  const setSettings = useSettingsStore(s => s.update);
  // Declared up here so the watchdog setInterval inside the main
  // tracker useEffect can read it without a TDZ error. Mirrored to
  // current status in a follow-on useEffect below.
  const statusRef = useRef<Status>('stopped');

  const animateDwell = useCallback(function animate() {
    if (lockedElementRef.current || !selectionReadyRef.current || !dwellElementRef.current || dwellStartRef.current === 0 ||
        resolveDwellTarget(dwellElementRef.current) !== dwellElementRef.current) {
      dwellElementRef.current = null;
      dwellStartRef.current = 0;
      setDwellProgress(0);
      return;
    }
    const progress = Math.min(1, (Date.now() - dwellStartRef.current) / dwellMs);
    setDwellProgress(progress);
    if (progress < 1) rafRef.current = requestAnimationFrame(animate);
  }, [dwellMs]);

  useEffect(() => {
    let mounted = true;
    let staleFrameLoss = false;
    if (!enabled || readCameraSelectionState().blocked || !isPoseTrackingSupported()) {
      if (handleRef.current) { handleRef.current.stop(); handleRef.current = null; }
      queueMicrotask(() => {
        if (mounted) setStatus('stopped');
      });
      return () => { mounted = false; };
    }

    const handle = startPoseTracker({
      dwellMs,
      sensitivity,
      smoothing: 0.15,
      trackingTarget: target,
      selectedTargetOnly: true,
      requireHeadPresence: true,
      calibrationMode: 'control',
      cursorSmoothing: 0.12,
      onTrackingLoss(reason) {
        if (!mounted) return;
        setLossReason(reason);
        // A stale frame cancels selection, but cannot erase a previously
        // measured rest from the watchdog's bounded activity history.
        // Actual target/head loss still discards that history immediately.
        staleFrameLoss = reason === 'camera-frame-stale';
        if (!staleFrameLoss) pauseObservedAtRef.current = 0;
        setMotionPaused(false);
        selectionReadyRef.current = false; setSelectionReady(false);
      },
      onMotionStateChange(motion) {
        if (!mounted) return;
        selectionReadyRef.current = motion.selectionReady === true;
        if (motion.paused && !motion.rejected) pauseObservedAtRef.current = Date.now();
        if (mounted) setMotionPaused(motion.paused);
        setSelectionReady(selectionReadyRef.current);
        if (!selectionReadyRef.current) {
          cancelAnimationFrame(rafRef.current); dwellElementRef.current = null; dwellStartRef.current = 0;
          if (mounted) setDwellProgress(0);
        }
      },
      onMove(x, y) {
        if (!mounted) return;
        setCursorPos({ x, y });
        if (readCameraSelectionState().blocked) return;
        // Watchdog window — only keep the most recent 100 samples to
        // bound memory; the watchdog filters by timestamp anyway.
        cursorWindowRef.current.push({ x, y, t: Date.now() });
        if (cursorWindowRef.current.length > 100) cursorWindowRef.current.shift();

        // Proximity detection is fed by real landmark data from the pose
        // tracker (not here — CameraInputOverlay only receives cursor x,y).
        // Proximity click will be wired when bodyPoseService provides
        // finger width data alongside cursor position.

        const el = document.elementFromPoint(x, y);
        const interactive = resolveDwellTarget(el);

        const keyBtn = cameraKeyTarget(interactive);
        if (keyBtn && keyBtn !== highlightedKeyRef.current) {
          highlightedKeyRef.current?.classList.remove('camera-cursor-highlight');
          highlightedKeyRef.current = keyBtn;
          keyBtn.classList.add('camera-cursor-highlight');
          const char = keyBtn.getAttribute('data-display') || '';
          const isUtility = !!keyBtn.getAttribute('data-action');
          if (char && !isUtility && char.length <= 2) {
            const rect = keyBtn.getBoundingClientRect();
            setKeyBubble({ char, x: rect.left + rect.width / 2, y: rect.top, visible: true });
          } else {
            setKeyBubble(prev => ({ ...prev, visible: false }));
          }
        } else if (!keyBtn && highlightedKeyRef.current) {
          highlightedKeyRef.current.classList.remove('camera-cursor-highlight');
          highlightedKeyRef.current = null;
          setKeyBubble(prev => ({ ...prev, visible: false }));
        }

        if (selectionReadyRef.current && interactive && !lockedElementRef.current) {
          if (interactive !== dwellElementRef.current) {
            dwellElementRef.current = interactive;
            dwellStartRef.current = Date.now();
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(animateDwell);
          }
        } else {
          dwellElementRef.current = null;
          dwellStartRef.current = 0;
          setDwellProgress(0);
          cancelAnimationFrame(rafRef.current);
        }
      },
      onDwellLockChange(element) {
        if (!mounted) return;
        lockedElementRef.current = element; setSelectionLocked(element !== null);
        if (element) {
          cancelAnimationFrame(rafRef.current);
          dwellElementRef.current = null; dwellStartRef.current = 0; setDwellProgress(0);
        }
      },
      onDwell() {
        if (!mounted) return;
        tapFeedback();
        setDwellProgress(0);
        dwellElementRef.current = null;
        dwellStartRef.current = 0;
        cancelAnimationFrame(rafRef.current);
        // Successful interaction — reset the no-interaction timer.
        lastDwellTsRef.current = Date.now();
      },
      onStatusChange(s, detectedTarget) {
        if (!mounted) return;
        if (s !== 'lost') staleFrameLoss = false;
        setStatus(s);
        if (s === 'starting' || s === 'tracking') setLossReason(null);
        if (detectedTarget) setActiveTarget(detectedTarget);
        if (s !== 'tracking') {
          if (s !== 'lost' || !staleFrameLoss) pauseObservedAtRef.current = 0;
          selectionReadyRef.current = false; setSelectionReady(false);
          if (s === 'starting' || s === 'stopped') { lockedElementRef.current = null; setSelectionLocked(false); }
          cancelAnimationFrame(rafRef.current);
          dwellElementRef.current = null;
          dwellStartRef.current = 0;
          setDwellProgress(0);
          highlightedKeyRef.current?.classList.remove('camera-cursor-highlight');
          highlightedKeyRef.current = null;
          setKeyBubble(previous => ({ ...previous, visible: false }));
        }
      },
    });

    handleRef.current = handle;
    enabledAtRef.current = Date.now();
    lastDwellTsRef.current = 0;
    cursorWindowRef.current = [];
    pauseObservedAtRef.current = 0;

    // Stuck-cursor / no-interaction watchdog. Runs at 1 Hz. Two
    // failure modes auto-disable tracking + show a recovery toast:
    //   1. NO INTERACTION — tracker reached NO_INTERACTION_MS
    //      without a single onDwell. The cursor isn't reaching
    //      anything interactive (degenerate calibration, cursor
    //      mapped off-screen, calibration anchored on wrong body
    //      part). Better to disable than leave the user trapped.
    //   2. PINNED CURSOR — samples in PIN_WINDOW_MS stayed
    //      inside PIN_BOX_PX. Calibration range
    //      collapsed; cursor barely responds to pose movement.
    //
    // The watchdog is the CameraInput equivalent of the drift
    // safety stack in HeadTrackingOverlay (services/headTrackerStability).
    // Couldn't reuse that primitive directly because it requires
    // landmark confidence which CameraInputOverlay doesn't get from
    // the tracker — we only have cursor x/y here.
    const PIN_WINDOW_MS = 15_000;       // raised from 10s — user may sit still briefly
    const PIN_BOX_PX = 80;
    const GRACE_PERIOD_MS = 20_000;     // don't fire for 20s after tracker start — calibration just set
    const watchdog = setInterval(() => {
      if (!mounted || readCameraSelectionState().blocked) return;
      const now = Date.now();
      // Only judge once tracker is actually tracking (not 'starting' /
      // 'lost' / 'stopped') — those have their own UX.
      if (statusRef.current !== 'tracking') return;
      // Observed pauses reset the same bounded grace interval, even before
      // its first check. Polling phase must not erase legitimate rest.
      const lastPause = pauseObservedAtRef.current <= now ? pauseObservedAtRef.current : 0;
      const activityAt = Math.max(enabledAtRef.current, lastPause);
      if (now - activityAt < GRACE_PERIOD_MS) return;
      // Don't fire while tutorial wizard is running (UI is captive).
      if (document.querySelector('[data-testid="tracking-setup-wizard"]')) return;
      // 1. No interaction window
      const sinceDwell = now - Math.max(activityAt, lastDwellTsRef.current);
      if (sinceDwell > NO_INTERACTION_MS) {
        console.warn('[camera-input] no successful interaction for ' + Math.round(sinceDwell / 1000) + 's — auto-disabling, calibration likely degenerate');
        setStuckReason('no-interaction'); setStuckToast(true);
        setSettings({ cameraInputEnabled: false });
        return;
      }

      // 2. Pinned cursor in a small box for the last PIN_WINDOW_MS
      const win = cursorWindowRef.current.filter(p => now - p.t <= PIN_WINDOW_MS);
      cursorWindowRef.current = win;
      if (win.length >= 30) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of win) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        if (maxX - minX < PIN_BOX_PX && maxY - minY < PIN_BOX_PX) {
          console.warn('[camera-input] cursor pinned to ' + Math.round(maxX - minX) + 'x' + Math.round(maxY - minY) + ' px box for ' + (PIN_WINDOW_MS / 1000) + 's — auto-disabling, calibration likely too narrow');
          setStuckReason('pinned'); setStuckToast(true);
          setSettings({ cameraInputEnabled: false });
          return;
        }
      }
    }, 1000);

    return () => {
      cancelAnimationFrame(rafRef.current);
      highlightedKeyRef.current?.classList.remove('camera-cursor-highlight');
      highlightedKeyRef.current = null;
      handle.stop();
      handleRef.current = null;
      clearInterval(watchdog);
      mounted = false;
    };
  // calGeneration increments each time the wizard saves a new calibration.
  // Adding it to deps forces the tracker to restart and reload the new cal
  // from localStorage — otherwise the running tracker's in-memory cal is stale.
  }, [enabled, resumeGeneration, target, dwellMs, sensitivity, animateDwell, setSettings, calGeneration]);

  // Ownership pauses selection inside the service, not the tracker lifetime:
  // a completed same-control hold must survive scanning and require departure.
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    dwellElementRef.current = null;
    dwellStartRef.current = 0;
    setDwellProgress(0);
    highlightedKeyRef.current?.classList.remove('camera-cursor-highlight');
    highlightedKeyRef.current = null;
    setKeyBubble(prev => ({ ...prev, visible: false }));
    enabledAtRef.current = Date.now();
    lastDwellTsRef.current = 0;
    cursorWindowRef.current = [];
    if (enabled && !readCameraSelectionState().blocked && !handleRef.current) {
      setResumeGeneration(generation => generation + 1);
    }
  }, [ownershipEpoch, enabled]);

  // Pointer fallback: when camera is on but can't detect the target
  // (MacBook — hands below FOV), use mouse movement for cursor + highlights.
  // Mirror status into the ref on every change so the watchdog (above)
  // and pointer fallback (below) read the latest value.
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => {
      if (statusRef.current === 'tracking') return;
      setCursorPos({ x: e.clientX, y: e.clientY });

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const keyBtn = cameraKeyTarget(resolveDwellTarget(el));
      if (keyBtn && keyBtn !== highlightedKeyRef.current) {
        highlightedKeyRef.current?.classList.remove('camera-cursor-highlight');
        highlightedKeyRef.current = keyBtn;
        keyBtn.classList.add('camera-cursor-highlight');
      } else if (!keyBtn && highlightedKeyRef.current) {
        highlightedKeyRef.current.classList.remove('camera-cursor-highlight');
        highlightedKeyRef.current = null;
      }
      // No bubble for mouse — mouse users click directly. Bubble is for camera dwell only.
      setKeyBubble(prev => prev.visible ? { ...prev, visible: false } : prev);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [enabled]);

  // Render the auto-disable toast even when tracking is disabled, so
  // the user sees what happened and has a one-tap path back.
  if (!enabled) {
    if (!stuckToast) return null;
    return (
      <div
        className="camera-recovery-warning bg-[#1f1f1f] text-white border border-white/10 pointer-events-auto"
        data-testid="camera-input-stuck-toast"
        role="alert"
      >
        <p className="font-semibold text-sm">{t('camera_watchdog_disabled')}</p>
        <p className="text-xs text-white/70 mt-1">
          {stuckReason === 'pinned' ? t('camera_watchdog_pinned') :
            t('camera_watchdog_no_interaction').replace('{seconds}', String(NO_INTERACTION_MS / 1000))}
        </p>
        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={() => setStuckToast(false)}
            className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20"
          >{t('camera_watchdog_dismiss')}</button>
          <button
            onClick={() => {
              setStuckToast(false);
              setSettings({ cameraInputEnabled: true });
            }}
            className="text-xs px-3 py-1.5 rounded bg-[#4CAF50] hover:bg-[#43a047] font-semibold"
          >{t('camera_watchdog_reenable')}</button>
        </div>
      </div>
    );
  }

  const statusColor = status === 'tracking' ? '#4CAF50' : status === 'lost' ? '#FF9800' : '#2196F3';

  const recalToastEl = recalToast ? (
    <div
      className="camera-recovery-warning bg-[#1a1a2e] text-white border border-[#FF9800]/40 pointer-events-auto"
      data-testid="camera-input-recal-toast"
      role="alert"
    >
      <p className="font-semibold text-sm text-[#FF9800]">⚠ Cursor drift — re-calibrate?</p>
      <p className="text-xs text-white/70 mt-1">
        Auto-correction tried 3 times but couldn&apos;t fully compensate. Re-run the tracking wizard for best accuracy.
      </p>
      <div className="flex gap-2 mt-3 justify-end">
        <button onClick={() => setRecalToast(false)} className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">
          Dismiss
        </button>
      </div>
    </div>
  ) : null;
  const bubbleY = keyBubble.visible ? Math.max(5, keyBubble.y - 55) : 0;
  const bubbleX = keyBubble.visible ? Math.max(25, Math.min(typeof window !== 'undefined' ? window.innerWidth - 25 : 9999, keyBubble.x)) : 0;
  // The status remains visible, but reserves space instead of covering keys.
  const statusBadge = <div data-testid="camera-input-status" role="status"
    className="shrink-0 surface-bar px-3 py-1 items-center gap-1 text-primary text-xs font-semibold"
    style={{ position: 'static', display: selectionBlocked || status === 'stopped' ? 'none' : 'flex' }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }} />
    {status === 'tracking' ? (selectionLocked ? t('camera_selection_locked') : motionPaused ? (selectionReady
      ? t('camera_motion_paused').replace('{seconds}', String(dwellMs / 1000))
      : t('camera_selection_uncertain')) : t('camera_motion_moving')) : status}
  </div>;

  return (
    <>
    <div className={`camera-recovery-rows${recalToast && (selectionBlocked || status === 'stopped' || status === 'lost') ? ' camera-recovery-rows-paired' : ''}`}>
    {(selectionBlocked || status === 'stopped' || status === 'lost') && <TrackingSelectionNotice
      title={t('camera_required')} message={!selectionBlocked && lossReason ? t(trackingLossKey(lossReason)) : undefined}
      testId="camera-input-notice" paused={selectionBlocked}
      onRetry={() => {
        if (!useSettingsStore.getState().cameraInputEnabled || readCameraSelectionState().blocked) return;
        tapFeedback();
        setResumeGeneration(generation => generation + 1);
      }}
    />}
    {recalToastEl}
    </div>
    {statusBadge}
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998, display: selectionBlocked || status === 'stopped' ? 'none' : undefined }}
      aria-hidden="true"
      data-testid="camera-input-overlay"
      data-status={selectionBlocked ? 'paused' : status}
      data-target={activeTarget}
      data-motion-paused={motionPaused ? 'true' : 'false'}
      data-selection-ready={!selectionBlocked && selectionReady && !selectionLocked ? 'true' : 'false'}
    >
      {/* Precision bubble on keyboard key */}
      {keyBubble.visible && (
        <div className="precision-bubble" style={{ left: bubbleX, top: bubbleY, pointerEvents: 'none' }}>
          {keyBubble.char}
        </div>
      )}
      {/* Cursor dot — only for camera tracking, not mouse fallback */}
      {status === 'tracking' && cursorPos.x >= 0 && cursorPos.y >= 0 && <div
        style={{
          position: 'absolute',
          left: cursorPos.x - cursorRadius,
          top: cursorPos.y - cursorRadius,
          width: cursorRadius * 2,
          height: cursorRadius * 2,
          borderRadius: '50%',
          backgroundColor: statusColor,
          opacity: 0.75,
          border: '2px solid white',
          boxShadow: `0 0 ${cursorRadius}px ${statusColor}80`,
          transition: 'left 0.06s linear, top 0.06s linear',
          pointerEvents: 'none',
        }}
      />}

      {/* Dwell ring — same size as cursor */}
      {dwellProgress > 0 && (() => {
        const r = cursorRadius + 4;
        const d = r * 2;
        const circ = Math.PI * 2 * r;
        return (
          <svg
            width={d} height={d}
            style={{
              position: 'absolute',
              left: cursorPos.x - r,
              top: cursorPos.y - r,
              transition: 'left 0.06s linear, top 0.06s linear',
            }}
          >
            <circle cx={r} cy={r} r={r - 2} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
            <circle
              cx={r} cy={r} r={r - 2}
              fill="none" stroke="#4CAF50" strokeWidth="4"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - dwellProgress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${r} ${r})`}
            />
          </svg>
        );
      })()}

    </div>
    </>
  );
}
