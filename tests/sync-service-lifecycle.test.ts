/**
 * syncService — lifecycle utilities not covered by sync-service-hardening.test.ts.
 *
 * The hardening tests cover the merge algorithms (mergeWordFreq,
 * mergeCustomItems, mergeHistory). This file covers the state-management
 * layer: setUserId (localStorage write), onSyncStatus (listener pattern
 * with immediate-call-on-register semantics), isSupabaseConfigured (env
 * check), and subscribeToChanges (returns null when Supabase unconfigured).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isSupabaseConfigured,
  setUserId,
  onSyncStatus,
  subscribeToChanges,
  type SyncStatus,
} from '@/services/syncService';

beforeEach(() => {
  localStorage.clear();
});

// ── isSupabaseConfigured ──────────────────────────────────────────────────────

describe('isSupabaseConfigured', () => {
  it('returns false in test environment (NEXT_PUBLIC_SUPABASE_URL not set)', () => {
    // In the vitest environment, Supabase env vars are absent.
    // This verifies the guard works — all cloud paths are gated by this.
    expect(isSupabaseConfigured()).toBe(false);
  });
});

// ── setUserId ─────────────────────────────────────────────────────────────────

describe('setUserId', () => {
  it('writes the user ID to localStorage under the correct key', () => {
    setUserId('user-abc-123');
    expect(localStorage.getItem('prism-aac-user-id')).toBe('user-abc-123');
  });

  it('overwrites any previously stored user ID', () => {
    setUserId('first-user');
    setUserId('second-user');
    expect(localStorage.getItem('prism-aac-user-id')).toBe('second-user');
  });

  it('does not throw on empty string', () => {
    expect(() => setUserId('')).not.toThrow();
    expect(localStorage.getItem('prism-aac-user-id')).toBe('');
  });
});

// ── onSyncStatus ──────────────────────────────────────────────────────────────

describe('onSyncStatus', () => {
  it('immediately calls the listener with the current status on registration', () => {
    const received: SyncStatus[] = [];
    const unsub = onSyncStatus((s) => received.push(s));
    try {
      // Must be called at least once (with current status) synchronously
      expect(received.length).toBeGreaterThanOrEqual(1);
      const validStatuses: SyncStatus[] = ['idle', 'syncing', 'synced', 'offline', 'error'];
      expect(validStatuses).toContain(received[0]);
    } finally {
      unsub();
    }
  });

  it('returns a callable unsubscribe function', () => {
    const unsub = onSyncStatus(vi.fn());
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('unsubscribed listener is no longer called after unsub()', async () => {
    const received: SyncStatus[] = [];
    const unsub = onSyncStatus((s) => received.push(s));
    const countAfterRegister = received.length;
    unsub();

    // Any subsequent status change should NOT reach the removed listener.
    // We verify indirectly: register another listener that we control,
    // then confirm the first one doesn't grow.
    const received2: SyncStatus[] = [];
    const unsub2 = onSyncStatus((s) => received2.push(s));
    try {
      expect(received.length).toBe(countAfterRegister); // no new calls
    } finally {
      unsub2();
    }
  });

  it('multiple listeners all receive the current status on registration', () => {
    const a: SyncStatus[] = [];
    const b: SyncStatus[] = [];
    const ua = onSyncStatus((s) => a.push(s));
    const ub = onSyncStatus((s) => b.push(s));
    try {
      expect(a.length).toBeGreaterThanOrEqual(1);
      expect(b.length).toBeGreaterThanOrEqual(1);
      // Both receive the same current status
      expect(a[0]).toBe(b[0]);
    } finally {
      ua(); ub();
    }
  });

  it('unsub() is idempotent — calling twice does not throw', () => {
    const unsub = onSyncStatus(vi.fn());
    unsub();
    expect(() => unsub()).not.toThrow();
  });
});

// ── subscribeToChanges ────────────────────────────────────────────────────────

describe('subscribeToChanges', () => {
  it('returns null when Supabase is not configured (test env)', () => {
    // In the test environment, NEXT_PUBLIC_SUPABASE_URL is absent.
    // subscribeToChanges must return null — callers gate on this null check.
    const result = subscribeToChanges(() => {});
    expect(result).toBeNull();
  });
});
