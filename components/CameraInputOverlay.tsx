'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startPoseTracker,
  isPoseTrackingSupported,
  type PoseTrackerHandle,
  type TrackingTarget,
} from '@/services/bodyPoseService';
import { ProximityCalculator } from '@/services/fingerProximityService';
import { tapFeedback } from '@/services/feedback';

/**
 * Camera Input Overlay — auto-starts camera-based finger/arm tracking.
 *
 * Uses MediaPipe Pose to detect the user's finger/arm position via
 * the webcam and maps it to cursor position on screen. Enabled by
 * default — the camera permission prompt fires on first load.
 *
 * Tracking targets: right_index (default), left_index, right_wrist,
 * left_wrist, right_elbow, left_elbow, nose, etc.
 */

type Status = 'starting' | 'tracking' | 'lost' | 'stopped';

export default function CameraInputOverlay() {
  const enabled = useSettingsStore(s => s.cameraInputEnabled);
  const target = useSettingsStore(s => s.cameraTrackingTarget) as TrackingTarget;
  const dwellMs = useSettingsStore(s => s.headTrackingDwellMs);
  const sensitivity = useSettingsStore(s => s.headTrackingSensitivity);

  const [status, setStatus] = useState<Status>('stopped');
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [dwellProgress, setDwellProgress] = useState(0);

  const handleRef = useRef<PoseTrackerHandle | null>(null);
  const dwellStartRef = useRef(0);
  const dwellElementRef = useRef<Element | null>(null);
  const rafRef = useRef(0);
  const highlightedKeyRef = useRef<HTMLElement | null>(null);
  const [keyBubble, setKeyBubble] = useState<{ char: string; x: number; y: number; visible: boolean }>({ char: '', x: 0, y: 0, visible: false });
  const proximityRef = useRef(new ProximityCalculator());
  const [proximity, setProximity] = useState(0);
  const touchFiredRef = useRef(false);

  const animateDwell = useCallback(() => {
    if (!dwellElementRef.current || dwellStartRef.current === 0) {
      setDwellProgress(0);
      return;
    }
    const progress = Math.min(1, (Date.now() - dwellStartRef.current) / dwellMs);
    setDwellProgress(progress);
    if (progress < 1) rafRef.current = requestAnimationFrame(animateDwell);
  }, [dwellMs]);

  useEffect(() => {
    if (!enabled || !isPoseTrackingSupported()) {
      if (handleRef.current) { handleRef.current.stop(); handleRef.current = null; }
      setStatus('stopped');
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
      onStatusChange(s) { setStatus(s); },
    });

    handleRef.current = handle;

    return () => {
      cancelAnimationFrame(rafRef.current);
      highlightedKeyRef.current?.classList.remove('camera-cursor-highlight');
      highlightedKeyRef.current = null;
      handle.stop();
      handleRef.current = null;
    };
  }, [enabled, target, dwellMs, sensitivity, animateDwell]);

  if (!enabled || status === 'stopped') return null;

  const statusColor = status === 'tracking' ? '#4CAF50' : status === 'lost' ? '#FF9800' : '#2196F3';
  const bubbleY = keyBubble.visible ? Math.max(5, keyBubble.y - 55) : 0;
  const bubbleX = keyBubble.visible ? Math.max(25, Math.min(typeof window !== 'undefined' ? window.innerWidth - 25 : 9999, keyBubble.x)) : 0;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998 }} aria-hidden="true">
      {/* Precision bubble on keyboard key */}
      {keyBubble.visible && (
        <div className="precision-bubble" style={{ left: bubbleX, top: bubbleY }}>
          {keyBubble.char}
        </div>
      )}
      {/* Cursor — grows as finger approaches screen (proximity feedback) */}
      <div
        style={{
          position: 'absolute',
          left: cursorPos.x - 12 - proximity * 10,
          top: cursorPos.y - 12 - proximity * 10,
          width: 24 + proximity * 20,
          height: 24 + proximity * 20,
          borderRadius: '50%',
          backgroundColor: proximity > 0.8 ? '#4CAF50' : statusColor,
          opacity: 0.7 + proximity * 0.3,
          border: `${2 + proximity * 2}px solid white`,
          boxShadow: `0 0 ${8 + proximity * 20}px ${proximity > 0.8 ? '#4CAF50' : statusColor}80`,
          transition: 'left 0.06s linear, top 0.06s linear, width 0.1s, height 0.1s',
        }}
      />

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
        {status === 'tracking' ? `Tracking ${target.replace('_', ' ')}` : status}
      </div>
    </div>
  );
}
