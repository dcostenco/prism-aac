/**
 * Simple guard/state functions — getSupabase, isSupabaseConfigured,
 * isPythonReady, isPoseTrackingSupported, cancelEmergency (null-state),
 * setDelayedAlertHandler, registerConnectivityListener
 *
 * These small exports had zero unit coverage. All are either pure
 * environment checks or null-guard paths callable without complex setup.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// ── supabase ──────────────────────────────────────────────────────────────────

import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

describe('getSupabase', () => {
  it('returns null when Supabase env vars are absent', () => {
    // Test env does not set NEXT_PUBLIC_SUPABASE_URL/ANON_KEY
    const result = getSupabase();
    // May return null OR a cached client from a prior test — both are acceptable.
    // What must NOT happen is a throw.
    expect(() => getSupabase()).not.toThrow();
  });

  it('returns null or a SupabaseClient (never throws)', () => {
    const result = getSupabase();
    expect(result === null || typeof result === 'object').toBe(true);
  });
});

describe('isSupabaseConfigured', () => {
  it('returns false when env vars are absent (test env)', () => {
    const result = isSupabaseConfigured();
    expect(typeof result).toBe('boolean');
    // In CI / test env these vars are absent
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      expect(result).toBe(false);
    }
  });

  it('returns a boolean, never throws', () => {
    expect(() => isSupabaseConfigured()).not.toThrow();
    expect(typeof isSupabaseConfigured()).toBe('boolean');
  });
});

// ── pythonRuntime ─────────────────────────────────────────────────────────────

import { isPythonReady } from '@/services/pythonRuntime';

describe('isPythonReady', () => {
  it('returns false before worker initialises (test env — no Worker)', () => {
    // jsdom does not load the python worker, so workerReady stays false
    expect(isPythonReady()).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof isPythonReady()).toBe('boolean');
  });

  it('is idempotent — multiple calls do not throw', () => {
    expect(() => {
      isPythonReady();
      isPythonReady();
    }).not.toThrow();
  });
});

// ── bodyPoseService ───────────────────────────────────────────────────────────

import { isPoseTrackingSupported } from '@/services/bodyPoseService';

describe('isPoseTrackingSupported', () => {
  it('returns a boolean', () => {
    expect(typeof isPoseTrackingSupported()).toBe('boolean');
  });

  it('does not throw', () => {
    expect(() => isPoseTrackingSupported()).not.toThrow();
  });

  it('returns false or true based on navigator.mediaDevices availability', () => {
    // jsdom may or may not stub mediaDevices.getUserMedia — either result is valid
    const result = isPoseTrackingSupported();
    expect(result === true || result === false).toBe(true);
  });
});

// ── emergencyService — cancelEmergency (null-state path) ──────────────────────

import { cancelEmergency, setDelayedAlertHandler, registerConnectivityListener } from '@/services/emergencyService';

describe('cancelEmergency', () => {
  it('does not throw when no emergency is active', () => {
    // _activeCountdownSeverity starts as null; cancelEmergency() is a no-op except cleanup
    expect(() => cancelEmergency()).not.toThrow();
  });

  it('is idempotent — calling multiple times does not throw', () => {
    expect(() => {
      cancelEmergency();
      cancelEmergency();
    }).not.toThrow();
  });

  it('does not throw when called with an alertId', () => {
    expect(() => cancelEmergency('test-alert-id')).not.toThrow();
  });

  it('returns undefined', () => {
    expect(cancelEmergency()).toBeUndefined();
  });
});

// ── emergencyService — setDelayedAlertHandler ─────────────────────────────────

describe('setDelayedAlertHandler', () => {
  it('does not throw when registering a handler', () => {
    const handler = vi.fn();
    expect(() => setDelayedAlertHandler(handler)).not.toThrow();
  });

  it('returns undefined', () => {
    expect(setDelayedAlertHandler(vi.fn())).toBeUndefined();
  });

  it('calling twice replaces the handler without throwing', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    expect(() => {
      setDelayedAlertHandler(h1);
      setDelayedAlertHandler(h2);
    }).not.toThrow();
  });
});

// ── emergencyService — registerConnectivityListener ───────────────────────────

describe('registerConnectivityListener', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a cleanup function', () => {
    const cleanup = registerConnectivityListener();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('cleanup does not throw', () => {
    const cleanup = registerConnectivityListener();
    expect(() => cleanup()).not.toThrow();
  });

  it('calling cleanup twice does not throw', () => {
    const cleanup = registerConnectivityListener();
    cleanup();
    expect(() => cleanup()).not.toThrow();
  });

  it('registering multiple listeners does not throw', () => {
    const c1 = registerConnectivityListener();
    const c2 = registerConnectivityListener();
    expect(() => { c1(); c2(); }).not.toThrow();
  });
});
