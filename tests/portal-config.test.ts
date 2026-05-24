/**
 * lib/portalConfig — SYNALUX_API, MAX_PORTAL_RESPONSE_BYTES, timeoutSignal
 *
 * timeoutSignal() provides abort-on-timeout for all portal fetches.
 * Regression here means emergency POST + inbox poll can hang indefinitely.
 *
 * polyfill-path tests use vi.resetModules() so HAS_ABORT_SIGNAL_TIMEOUT
 * is evaluated fresh with AbortSignal.timeout temporarily removed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SYNALUX_API,
  MAX_PORTAL_RESPONSE_BYTES,
  HAS_ABORT_SIGNAL_TIMEOUT,
  timeoutSignal as timeoutSignalNative,
} from '@/lib/portalConfig';

// ── constants ─────────────────────────────────────────────────────────────────

describe('portalConfig — constants', () => {
  it('SYNALUX_API is a non-empty string', () => {
    expect(typeof SYNALUX_API).toBe('string');
    expect(SYNALUX_API.length).toBeGreaterThan(0);
  });

  it('SYNALUX_API default ends with /api/v1 when env var is unset', () => {
    expect(SYNALUX_API).toMatch(/\/api\/v1$/);
  });

  it('MAX_PORTAL_RESPONSE_BYTES is 1 MiB (1_048_576)', () => {
    expect(MAX_PORTAL_RESPONSE_BYTES).toBe(1_048_576);
  });

  it('HAS_ABORT_SIGNAL_TIMEOUT is boolean', () => {
    expect(typeof HAS_ABORT_SIGNAL_TIMEOUT).toBe('boolean');
  });
});

// ── timeoutSignal — interface (works with either native or polyfill path) ─────

describe('portalConfig — timeoutSignal interface', () => {
  it('returns an object with signal and cancel', () => {
    const result = timeoutSignalNative(1000);
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('cancel');
    expect(typeof result.cancel).toBe('function');
    result.cancel();
  });

  it('signal is an AbortSignal', () => {
    const { signal, cancel } = timeoutSignalNative(1000);
    expect(signal).toBeInstanceOf(AbortSignal);
    cancel();
  });
});

// ── timeoutSignal — polyfill path (AbortController fallback) ──────────────────

describe('portalConfig — timeoutSignal polyfill path', () => {
  type TimeoutSignalFn = (ms: number) => { signal: AbortSignal; cancel: () => void };
  let timeoutSignalPolyfill: TimeoutSignalFn;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    // Remove AbortSignal.timeout BEFORE import so HAS_ABORT_SIGNAL_TIMEOUT = false
    const orig = (AbortSignal as Record<string, unknown>).timeout;
    (AbortSignal as Record<string, unknown>).timeout = undefined;
    const mod: { timeoutSignal: TimeoutSignalFn } = await import('@/lib/portalConfig');
    timeoutSignalPolyfill = mod.timeoutSignal;
    // Restore for other modules
    (AbortSignal as Record<string, unknown>).timeout = orig;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an object with signal and cancel', () => {
    const result = timeoutSignalPolyfill(500);
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('cancel');
    expect(typeof result.cancel).toBe('function');
    result.cancel();
  });

  it('signal is an AbortSignal', () => {
    const { signal, cancel } = timeoutSignalPolyfill(500);
    expect(signal).toBeInstanceOf(AbortSignal);
    cancel();
  });

  it('signal fires after specified ms', () => {
    const { signal } = timeoutSignalPolyfill(500);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(500);
    expect(signal.aborted).toBe(true);
  });

  it('signal does NOT fire before ms elapses', () => {
    const { signal, cancel } = timeoutSignalPolyfill(500);
    vi.advanceTimersByTime(499);
    expect(signal.aborted).toBe(false);
    cancel();
    vi.advanceTimersByTime(1000);
  });

  it('cancel() prevents the signal from firing', () => {
    const { signal, cancel } = timeoutSignalPolyfill(500);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(signal.aborted).toBe(false);
  });

  it('aborted signal reason is a TimeoutError DOMException', () => {
    const { signal } = timeoutSignalPolyfill(100);
    vi.advanceTimersByTime(100);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect((signal.reason as DOMException).name).toBe('TimeoutError');
  });
});
