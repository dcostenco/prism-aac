'use client';
/**
 * DwellButton — Phase 5A.
 *
 * A button that requires the user to hold their finger for
 * `holdTimeMs` (read from settings.mathHoldTimeMs) before the
 * commit fires. Visual progress ring fills during the dwell;
 * releasing before expiry cancels.
 *
 * When `holdTimeMs === 0` (default), the button behaves like a
 * regular onClick — pointerdown + pointerup commits immediately.
 *
 * Why we don't use plain onClick + a setTimeout:
 *   • A user with motor imprecision needs to SEE that the dwell is
 *     in progress so they can hold steady. The ring is the
 *     feedback channel.
 *   • Releasing early MUST cancel — onClick fires on release
 *     regardless, which would defeat the dwell-as-confirmation
 *     intent.
 *   • Pointer leaving the button mid-dwell also cancels (matches
 *     the head-tracker dwell semantics elsewhere in the app).
 *
 * Render: the children are absolutely-positioned content; the dwell
 * ring is an SVG overlay drawn ON TOP of the button when active.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

interface DwellButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Fires once the dwell completes (or immediately when holdTimeMs=0). */
  onCommit: () => void;
  /** Optional override — bypasses the settings store. Useful for tests. */
  holdTimeMsOverride?: number;
  /** Children render INSIDE the button; the dwell ring is a sibling overlay. */
  children: React.ReactNode;
}

export default function DwellButton({
  onCommit,
  holdTimeMsOverride,
  children,
  className,
  ...rest
}: DwellButtonProps) {
  const settingsHold = useSettingsStore((s) => s.mathHoldTimeMs);
  const holdMs = holdTimeMsOverride ?? settingsHold ?? 0;

  const [progress, setProgress] = useState(0);          // 0..1
  const [active, setActive] = useState(false);          // is dwell in flight?
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const committedRef = useRef(false);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    setActive(false);
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    if (startRef.current === null || holdMs <= 0) return;
    const elapsed = performance.now() - startRef.current;
    const p = Math.min(1, elapsed / holdMs);
    setProgress(p);
    if (p >= 1) {
      committedRef.current = true;
      onCommit();
      cancel();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, onCommit, cancel]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    committedRef.current = false;
    if (holdMs <= 0) {
      // Instant mode — commit immediately on press, like onClick.
      onCommit();
      committedRef.current = true;
      return;
    }
    setActive(true);
    setProgress(0);
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    // Capture pointer so leave events fire reliably even if the user's
    // finger drifts slightly off the button.
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [holdMs, onCommit, tick]);

  const onPointerUp = useCallback(() => {
    if (committedRef.current) return; // already committed via dwell
    cancel();
  }, [cancel]);

  const onPointerLeave = useCallback(() => {
    if (committedRef.current) return;
    cancel();
  }, [cancel]);

  // Cleanup on unmount.
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <button
      {...rest}
      data-dwell-active={active ? '1' : '0'}
      data-hold-ms={holdMs}
      className={`relative ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLeave}
      onPointerLeave={onPointerLeave}
    >
      {children}
      {active && (
        <DwellRing progress={progress} />
      )}
    </button>
  );
}

function DwellRing({ progress }: { progress: number }) {
  const SIZE = 100;        // svg viewbox; scaled to button via 100% size
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - progress);
  return (
    <svg
      width="100%" height="100%"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="absolute inset-0 pointer-events-none"
      data-testid="dwell-ring"
      preserveAspectRatio="none"
    >
      <circle
        cx={SIZE / 2} cy={SIZE / 2} r={R}
        fill="none"
        stroke="rgba(64,170,80,0.85)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </svg>
  );
}
