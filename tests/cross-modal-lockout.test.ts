/**
 * crossModalLockout — pub/sub + isLocked pure-logic tests
 *
 * Covers: dispatchGestureClaim fan-out, onGestureClaim disposer,
 * error isolation, isLocked boundary math, default lockoutMs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dispatchGestureClaim, onGestureClaim, isLocked } from '@/services/crossModalLockout';

const claim = { gesture: 'blink', confidence: 0.8, timestamp: 1000 };

// ── shared cleanup ─────────────────────────────────────────────────────────────

// Disposers collected across tests; cleared in beforeEach to avoid listener leak
const disposers: Array<() => void> = [];
beforeEach(() => {
  disposers.forEach((d) => d());
  disposers.length = 0;
});

// ── onGestureClaim / dispatchGestureClaim ──────────────────────────────────────

describe('crossModalLockout — pub/sub', () => {
  it('dispatched claim is received by a registered listener', () => {
    const handler = vi.fn();
    disposers.push(onGestureClaim(handler));
    dispatchGestureClaim(claim);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(claim);
  });

  it('multiple listeners all receive the claim', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const h3 = vi.fn();
    disposers.push(onGestureClaim(h1), onGestureClaim(h2), onGestureClaim(h3));
    dispatchGestureClaim(claim);
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
    expect(h3).toHaveBeenCalledOnce();
  });

  it('disposer removes listener — not called after disposal', () => {
    const handler = vi.fn();
    const dispose = onGestureClaim(handler);
    dispose();
    dispatchGestureClaim(claim);
    expect(handler).not.toHaveBeenCalled();
  });

  it('disposing one listener does not affect others', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const dispose1 = onGestureClaim(h1);
    disposers.push(onGestureClaim(h2));
    dispose1();
    dispatchGestureClaim(claim);
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('throwing listener does not prevent other listeners from firing', () => {
    const thrower = vi.fn(() => { throw new Error('oops'); });
    const survivor = vi.fn();
    disposers.push(onGestureClaim(thrower), onGestureClaim(survivor));
    expect(() => dispatchGestureClaim(claim)).not.toThrow();
    expect(thrower).toHaveBeenCalledOnce();
    expect(survivor).toHaveBeenCalledOnce();
  });

  it('calling dispose() twice is safe (no throw, no duplicate removal side-effects)', () => {
    const handler = vi.fn();
    const dispose = onGestureClaim(handler);
    dispose();
    expect(() => dispose()).not.toThrow();
    dispatchGestureClaim(claim);
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatching with no listeners is a no-op', () => {
    expect(() => dispatchGestureClaim(claim)).not.toThrow();
  });

  it('re-registering after dispose works', () => {
    const handler = vi.fn();
    const dispose = onGestureClaim(handler);
    dispose();
    disposers.push(onGestureClaim(handler));
    dispatchGestureClaim(claim);
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ── isLocked boundary math ─────────────────────────────────────────────────────

describe('crossModalLockout — isLocked', () => {
  it('returns false when lastClaimTs is 0 (zero-init state)', () => {
    expect(isLocked(0, 9999, 250)).toBe(false);
  });

  it('returns true when elapsed < lockoutMs (strict <)', () => {
    // 1249 - 1000 = 249 < 250 → locked
    expect(isLocked(1000, 1249, 250)).toBe(true);
  });

  it('returns false when elapsed === lockoutMs (boundary)', () => {
    // 1250 - 1000 = 250 = 250 → NOT locked (strict <)
    expect(isLocked(1000, 1250, 250)).toBe(false);
  });

  it('returns false when elapsed > lockoutMs', () => {
    // 1300 - 1000 = 300 > 250 → not locked
    expect(isLocked(1000, 1300, 250)).toBe(false);
  });

  it('default lockoutMs is 250', () => {
    // No lockoutMs arg — should default to 250
    expect(isLocked(1000, 1249)).toBe(true);
    expect(isLocked(1000, 1250)).toBe(false);
  });

  it('works with non-default lockoutMs', () => {
    expect(isLocked(500, 799, 300)).toBe(true);   // 299 < 300
    expect(isLocked(500, 800, 300)).toBe(false);  // 300 = 300, not locked
  });

  it('returns true immediately after claim (elapsed = 1)', () => {
    expect(isLocked(1000, 1001, 250)).toBe(true);
  });
});
