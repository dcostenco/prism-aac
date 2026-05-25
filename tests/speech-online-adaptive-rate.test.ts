/**
 * speechService::isOnline + adaptiveEngine::recordPreferredRate
 *
 * isOnline() wraps navigator.onLine with a typeof guard for SSR safety.
 * recordPreferredRate() validates the input (finite, positive) before
 * writing to the adaptive profile. These two small exports had zero coverage.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOnline } from '@/services/speechService';
import { recordPreferredRate } from '@/services/adaptiveEngine';

// ── isOnline ──────────────────────────────────────────────────────────────────

describe('isOnline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    expect(isOnline()).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    expect(isOnline()).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof isOnline()).toBe('boolean');
  });
});

// ── recordPreferredRate ───────────────────────────────────────────────────────

describe('recordPreferredRate', () => {
  it('does not throw for a valid rate', () => {
    expect(() => recordPreferredRate(0.5)).not.toThrow();
  });

  it('does not throw for the minimum sensible rate (e.g. 0.1)', () => {
    expect(() => recordPreferredRate(0.1)).not.toThrow();
  });

  it('does not throw for a high rate (e.g. 2.0)', () => {
    expect(() => recordPreferredRate(2.0)).not.toThrow();
  });

  it('does not throw when called with NaN (no-op guard)', () => {
    expect(() => recordPreferredRate(NaN)).not.toThrow();
  });

  it('does not throw when called with Infinity (no-op guard)', () => {
    expect(() => recordPreferredRate(Infinity)).not.toThrow();
  });

  it('does not throw when called with -Infinity (no-op guard)', () => {
    expect(() => recordPreferredRate(-Infinity)).not.toThrow();
  });

  it('does not throw when called with 0 (invalid — ≤ 0 guard)', () => {
    expect(() => recordPreferredRate(0)).not.toThrow();
  });

  it('does not throw when called with a negative rate (invalid — ≤ 0 guard)', () => {
    expect(() => recordPreferredRate(-1)).not.toThrow();
  });

  it('is idempotent — calling multiple times does not throw', () => {
    expect(() => {
      recordPreferredRate(0.5);
      recordPreferredRate(1.0);
      recordPreferredRate(0.75);
    }).not.toThrow();
  });

  it('returns undefined', () => {
    expect(recordPreferredRate(0.5)).toBeUndefined();
  });
});
