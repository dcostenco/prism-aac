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
      },
      onStatusChange(s, detectedTarget) {
        setStatus(s);
        if (detectedTarget) setActiveTarget(detectedTarget);
      },
    });

    handleRef.current = handle;

    return () => {
      cancelAnimationFrame(rafRef.current);
      highlightedKeyRef.current?.classList.remove('camera-cursor-highlight');
      highlightedKeyRef.current = null;
      handle.stop();
      handleRef.current = null;
      mounted = false;
    };
  }, [enabled, target, dwellMs, sensitivity, animateDwell]);

  // Pointer fallback: when camera is on but can't detect the target
  // (MacBook — hands below FOV), use mouse movement for cursor + highlights.
  // Uses a ref to avoid stale closure over status.
  const statusRef = useRef(status);
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

  if (!enabled) return null;

  const statusColor = status === 'tracking' ? '#4CAF50' : status === 'lost' ? '#FF9800' : '#2196F3';
  const bubbleY = keyBubble.visible ? Math.max(5, keyBubble.y - 55) : 0;
  const bubbleX = keyBubble.visible ? Math.max(25, Math.min(typeof window !== 'undefined' ? window.innerWidth - 25 : 9999, keyBubble.x)) : 0;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998 }} aria-hidden="true">
      {/* Precision bubble on keyboard key */}
      {keyBubble.visible && (
        <div className="precision-bubble" style={{ left: bubbleX, top: bubbleY, pointerEvents: 'none' }}>
          {keyBubble.char}
        </div>
      )}
      {/* Cursor dot — only for camera tracking, not mouse fallback */}
      {status === 'tracking' && cursorPos.x > 0 && cursorPos.y > 0 && <div
        style={{
          position: 'absolute',
          left: cursorPos.x - 14,
          top: cursorPos.y - 14,
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: statusColor,
          opacity: 0.85,
          border: '2px solid white',
          boxShadow: `0 0 12px ${statusColor}80`,
          transition: 'left 0.06s linear, top 0.06s linear',
          pointerEvents: 'none',
        }}
      />}

      {/* Dwell ring */}
      {dwellProgress > 0 && (
        <svg
          width="50" height="50"
          style={{
            position: 'absolute',
            left: cursorPos.x - 25,
            top: cursorPos.y - 25,
            transition: 'left 0.06s linear, top 0.06s linear',
          }}
        >
          <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <circle
            cx="25" cy="25" r="22"
            fill="none" stroke="#4CAF50" strokeWidth="4"
            strokeDasharray={Math.PI * 44}
            strokeDashoffset={Math.PI * 44 * (1 - dwellProgress)}
            strokeLinecap="round"
            transform="rotate(-90 25 25)"
          />
        </svg>
      )}

      {/* Status badge */}
      <div
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
  );
}
