'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startPoseTracker,
  isPoseTrackingSupported,
  type PoseTrackerHandle,
  type TrackingTarget,
} from '@/services/bodyPoseService';
import { tapFeedback } from '@/services/feedback';

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

export default function CameraInputOverlay() {
  const enabled = useSettingsStore(s => s.cameraInputEnabled);
  const calGeneration = useSettingsStore(s => s.poseCalibrationGeneration);
  const target = useSettingsStore(s => s.cameraTrackingTarget) as TrackingTarget;
  const dwellMs = useSettingsStore(s => s.headTrackingDwellMs);
  const sensitivity = useSettingsStore(s => s.headTrackingSensitivity);

  const [status, setStatus] = useState<Status>('stopped');
  const [activeTarget, setActiveTarget] = useState(target);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [dwellProgress, setDwellProgress] = useState(0);

  const handleRef = useRef<PoseTrackerHandle | null>(null);
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
    if (!dwellElementRef.current || dwellStartRef.current === 0) {
      setDwellProgress(0);
      return;
    }
    const progress = Math.min(1, (Date.now() - dwellStartRef.current) / dwellMs);
    setDwellProgress(progress);
    if (progress < 1) rafRef.current = requestAnimationFrame(animate);
  }, [dwellMs]);

  useEffect(() => {
    let mounted = true;
    if (!enabled || !isPoseTrackingSupported()) {
      if (handleRef.current) { handleRef.current.stop(); handleRef.current = null; }
      queueMicrotask(() => {
        if (mounted) setStatus('stopped');
      });
      return;
    }

    const handle = startPoseTracker({
      dwellMs,
      sensitivity,
      smoothing: 0.15,
      trackingTarget: target,
      cursorSmoothing: 0.12,
      onMove(x, y) {
        setCursorPos({ x, y });
        // Watchdog window — only keep the most recent 100 samples to
        // bound memory; the watchdog filters by timestamp anyway.
        cursorWindowRef.current.push({ x, y, t: Date.now() });
        if (cursorWindowRef.current.length > 100) cursorWindowRef.current.shift();

        // Proximity detection is fed by real landmark data from the pose
        // tracker (not here — CameraInputOverlay only receives cursor x,y).
        // Proximity click will be wired when bodyPoseService provides
        // finger width data alongside cursor position.

        const el = document.elementFromPoint(x, y);
        const interactive = el?.closest('button, a, [role="button"], [data-dwell-target], .aac-btn') ?? null;

        const keyBtn = el?.closest('button[data-key], button[data-action]') as HTMLElement | null;
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

        if (interactive) {
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
      onDwell() {
        tapFeedback();
        setDwellProgress(0);
        dwellElementRef.current = null;
        dwellStartRef.current = 0;
        // Successful interaction — reset the no-interaction timer.
        lastDwellTsRef.current = Date.now();
      },
      onStatusChange(s, detectedTarget) {
        setStatus(s);
        if (detectedTarget) setActiveTarget(detectedTarget);
      },
    });

    handleRef.current = handle;
    enabledAtRef.current = Date.now();
    lastDwellTsRef.current = 0;
    cursorWindowRef.current = [];

    // Stuck-cursor / no-interaction watchdog. Runs at 1 Hz. Two
    // failure modes auto-disable tracking + show a recovery toast:
    //   1. NO INTERACTION — tracker has been 'tracking' for ≥ 25s
    //      without a single onDwell. The cursor isn't reaching
    //      anything interactive (degenerate calibration, cursor
    //      mapped off-screen, calibration anchored on wrong body
    //      part). Better to disable than leave the user trapped.
    //   2. PINNED CURSOR — every cursor sample in the last 10s
    //      stayed within a 100×100 px box. Calibration range
    //      collapsed; cursor barely responds to pose movement.
    //
    // The watchdog is the CameraInput equivalent of the drift
    // safety stack in HeadTrackingOverlay (services/headTrackerStability).
    // Couldn't reuse that primitive directly because it requires
    // landmark confidence which CameraInputOverlay doesn't get from
    // the tracker — we only have cursor x/y here.
    const NO_INTERACTION_MS = 45_000;   // raised from 25s — new calibration needs time to settle
    const PIN_WINDOW_MS = 15_000;       // raised from 10s — user may sit still briefly
    const PIN_BOX_PX = 80;
    const GRACE_PERIOD_MS = 20_000;     // don't fire for 20s after tracker start — calibration just set
    const watchdog = setInterval(() => {
      if (!mounted) return;
      const now = Date.now();
      // Only judge once tracker is actually tracking (not 'starting' /
      // 'lost' / 'stopped') — those have their own UX.
      if (statusRef.current !== 'tracking') return;
      // Grace period after start — calibration was just set, cursor may
      // appear stable while user adjusts posture. Don't fire during this window.
      if (now - enabledAtRef.current < GRACE_PERIOD_MS) return;
      // Don't fire while tutorial wizard is running (UI is captive).
      if (document.querySelector('[data-testid="tracking-setup-wizard"]')) return;

      // 1. No interaction window
      const enabledFor = now - enabledAtRef.current;
      const sinceDwell = lastDwellTsRef.current === 0
        ? enabledFor
        : now - lastDwellTsRef.current;
      if (sinceDwell > NO_INTERACTION_MS) {
        console.warn('[camera-input] no successful interaction for ' + Math.round(sinceDwell / 1000) + 's — auto-disabling, calibration likely degenerate');
        setStuckToast(true);
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
          setStuckToast(true);
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
  }, [enabled, target, dwellMs, sensitivity, animateDwell, setSettings, calGeneration]);

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
      const keyBtn = el?.closest('button[data-key], button[data-action]') as HTMLElement | null;
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
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] bg-[#1f1f1f] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 max-w-md pointer-events-auto"
        data-testid="camera-input-stuck-toast"
        role="alert"
      >
        <p className="font-semibold text-sm">Camera tracking auto-disabled</p>
        <p className="text-xs text-white/70 mt-1">
          Cursor wasn&apos;t reaching anything for 25 s — calibration looks off.
          Re-run setup from Settings, or close this and use touch.
        </p>
        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={() => setStuckToast(false)}
            className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20"
          >Dismiss</button>
          <button
            onClick={() => {
              setStuckToast(false);
              setSettings({ cameraInputEnabled: true });
            }}
            className="text-xs px-3 py-1.5 rounded bg-[#4CAF50] hover:bg-[#43a047] font-semibold"
          >Re-enable</button>
        </div>
      </div>
    );
  }

  const statusColor = status === 'tracking' ? '#4CAF50' : status === 'lost' ? '#FF9800' : '#2196F3';

  const recalToastEl = recalToast ? (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] bg-[#1a1a2e] text-white px-4 py-3 rounded-2xl shadow-2xl border border-[#FF9800]/40 max-w-sm pointer-events-auto"
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

  return (
    <>
    {recalToastEl}
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998 }}
      aria-hidden="true"
      data-testid="camera-input-overlay"
      data-status={status}
      data-target={activeTarget}
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

      {/* Status badge */}
      <div
        data-testid="camera-input-status"
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          padding: '3px 10px',
          borderRadius: 16,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }} />
        {status === 'tracking' ? `Tracking ${activeTarget.replace('_', ' ')}` : status}
      </div>
    </div>
    </>
  );
}
