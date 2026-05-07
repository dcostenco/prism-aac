'use client';
/**
 * DwellButton — Phase 5A + 5D.
 *
 * Combines two AAC accessibility profiles for math keys:
 *
 *   1. Hold-time dwell (Phase 5A) — requires the user to hold for
 *      `mathHoldTimeMs` ms before commit. Visual ring fills during
 *      dwell; release before expiry cancels.
 *
 *   2. Two-hit magnify (Phase 5D) — when `mathTwoHitMagnify` is on,
 *      the FIRST press arms the button (scaled 1.4× + green halo,
 *      no commit). The SECOND press within 2 s actually commits
 *      (subject to dwell rules if also enabled). 2 s of inactivity
 *      auto-disarms.
 *
 * Defaults are off, off → button behaves like plain onClick. The
 * profiles compose: caregiver can enable dwell only, two-hit only,
 * or both.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

const TWO_HIT_AUTO_DISARM_MS = 2000;

interface DwellButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Fires once the dwell completes (or immediately when holdTimeMs=0). */
  onCommit: () => void;
  /** Optional override — bypasses the settings store. Useful for tests. */
  holdTimeMsOverride?: number;
  /** Optional override — bypasses the settings store. Useful for tests. */
  twoHitMagnifyOverride?: boolean;
  /** Children render INSIDE the button; the dwell ring is a sibling overlay. */
  children: React.ReactNode;
}

export default function DwellButton({
  onCommit,
  holdTimeMsOverride,
  twoHitMagnifyOverride,
  children,
  className,
  ...rest
}: DwellButtonProps) {
  const settingsHold = useSettingsStore((s) => s.mathHoldTimeMs);
  const settingsTwoHit = useSettingsStore((s) => s.mathTwoHitMagnify);
  const holdMs = holdTimeMsOverride ?? settingsHold ?? 0;
  const twoHit = twoHitMagnifyOverride ?? settingsTwoHit ?? false;

  const [progress, setProgress] = useState(0);          // 0..1
  const [active, setActive] = useState(false);          // is dwell in flight?
  const [armed, setArmed] = useState(false);            // two-hit armed?
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const committedRef = useRef(false);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Two-hit magnify: if enabled and not yet armed, this press is
    // the FIRST tap — arm the button visually, set a 2 s
    // auto-disarm timer, and DON'T commit yet.
    if (twoHit && !armed) {
      setArmed(true);
      if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = setTimeout(() => {
        setArmed(false);
      }, TWO_HIT_AUTO_DISARM_MS);
      return;
    }

    // Either two-hit is off, or the button is already armed — proceed
    // to the commit path (instant or dwell).
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
    setArmed(false);

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
  }, [twoHit, armed, holdMs, onCommit, tick]);

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
    if (disarmTimerRef.current !== null) clearTimeout(disarmTimerRef.current);
  }, []);

  return (
    <button
      {...rest}
      data-dwell-active={active ? '1' : '0'}
      data-hold-ms={holdMs}
      data-two-hit={twoHit ? '1' : '0'}
      data-armed={armed ? '1' : '0'}
      className={`relative ${className ?? ''} ${
        armed ? 'z-30 scale-[1.4] ring-4 ring-[#4CAF50] shadow-2xl transition-transform' : 'transition-transform'
      }`}
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
