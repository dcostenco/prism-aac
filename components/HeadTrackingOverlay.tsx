'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  startHeadTracker,
  isHeadTrackingSupported,
  type HeadTrackerHandle,
} from '@/services/headTracker';
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

export default function HeadTrackingOverlay() {
  const enabled = useSettingsStore((s) => s.headTrackingEnabled);
  const dwellMs = useSettingsStore((s) => s.headTrackingDwellMs);
  const sensitivity = useSettingsStore((s) => s.headTrackingSensitivity);

  const { t } = useT();

  const [status, setStatus] = useState<TrackingStatus>('stopped');
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [dwellProgress, setDwellProgress] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const handleRef = useRef<HeadTrackerHandle | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const dwellStartRef = useRef(0);
  const dwellElementRef = useRef<Element | null>(null);
  const rafDwellRef = useRef(0);

  // Dwell progress animation
  const animateDwellProgress = useCallback(() => {
    if (!dwellElementRef.current || dwellStartRef.current === 0) {
      setDwellProgress(0);
      return;
    }
    const elapsed = Date.now() - dwellStartRef.current;
    const progress = Math.min(1, elapsed / dwellMs);
    setDwellProgress(progress);
    if (progress < 1) {
      rafDwellRef.current = requestAnimationFrame(animateDwellProgress);
    }
  }, [dwellMs]);

  // Start / stop tracker based on enabled flag
  useEffect(() => {
    if (!enabled || !isHeadTrackingSupported()) {
      if (handleRef.current) { handleRef.current.stop(); handleRef.current = null; }
      setStatus('stopped');
      return;
    }

    const handle = startHeadTracker({
      dwellMs,
      sensitivity,
      smoothing: 0.15,
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
      onDwell(_element) {
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
      clearInterval(checkVideo);
      cancelAnimationFrame(rafDwellRef.current);
      handle.stop();
      handleRef.current = null;
    };
    // Re-create tracker when key settings change
  }, [enabled, dwellMs, sensitivity, animateDwellProgress]);

  if (!enabled) return null;

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
  const ringRadius = 16;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - dwellProgress);

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
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
      </div>

      {/* ── Camera PIP preview (bottom-right corner) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
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
