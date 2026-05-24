/**
 * syncService — cloud push/pull/keepalive guard paths.
 *
 * pushToCloud, pullFromCloud, and pushToCloudKeepalive all gate on
 * isSupabaseConfigured(). In the test environment (no NEXT_PUBLIC_SUPABASE_URL)
 * they must return early without throwing, and push/pull must update the sync
 * status to 'offline' so callers know why the operation was skipped.
 *
 * These paths were not covered in sync-service-hardening.test.ts (which tests
 * the merge algorithms) or sync-service-lifecycle.test.ts (which tests the
 * listener/state helpers).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushToCloud,
  pullFromCloud,
  pushToCloudKeepalive,
  onSyncStatus,
  type SyncStatus,
  type AACProfile,
} from '@/services/syncService';

beforeEach(() => {
  localStorage.clear();
});

// ── pushToCloud — guard path ──────────────────────────────────────────────────

describe('pushToCloud — Supabase not configured', () => {
  it('does not throw when Supabase is not configured', async () => {
    await expect(pushToCloud({})).resolves.toBeUndefined();
  });

  it('sets sync status to offline when Supabase is not configured', async () => {
    const statuses: SyncStatus[] = [];
    const unsub = onSyncStatus((s) => statuses.push(s));
    try {
      await pushToCloud({});
      expect(statuses).toContain('offline');
    } finally {
      unsub();
    }
  });

  it('accepts a partial AACProfile without throwing', async () => {
    const partial: Partial<AACProfile> = {
      wordFreq: { water: 12, help: 5 },
    };
    await expect(pushToCloud(partial)).resolves.toBeUndefined();
  });

  it('accepts an empty object payload without throwing', async () => {
    await expect(pushToCloud({})).resolves.toBeUndefined();
  });

  it('multiple sequential calls do not throw', async () => {
    await expect(pushToCloud({})).resolves.toBeUndefined();
    await expect(pushToCloud({})).resolves.toBeUndefined();
    await expect(pushToCloud({})).resolves.toBeUndefined();
  });
});

// ── pullFromCloud — guard path ────────────────────────────────────────────────

describe('pullFromCloud — Supabase not configured', () => {
  it('returns null when Supabase is not configured', async () => {
    const result = await pullFromCloud();
    expect(result).toBeNull();
  });

  it('sets sync status to offline when returning null', async () => {
    const statuses: SyncStatus[] = [];
    const unsub = onSyncStatus((s) => statuses.push(s));
    try {
      await pullFromCloud();
      expect(statuses).toContain('offline');
    } finally {
      unsub();
    }
  });

  it('multiple sequential pulls all return null', async () => {
    expect(await pullFromCloud()).toBeNull();
    expect(await pullFromCloud()).toBeNull();
    expect(await pullFromCloud()).toBeNull();
  });
});

// ── pushToCloudKeepalive — guard path ─────────────────────────────────────────

describe('pushToCloudKeepalive — Supabase not configured', () => {
  it('does not throw when Supabase is not configured', () => {
    expect(() => pushToCloudKeepalive({})).not.toThrow();
  });

  it('accepts partial payload without throwing', () => {
    expect(() => pushToCloudKeepalive({ wordFreq: { go: 3 } })).not.toThrow();
  });

  it('is synchronous — returns immediately (no pending work)', () => {
    const start = Date.now();
    pushToCloudKeepalive({});
    const elapsed = Date.now() - start;
    // Guard path exits synchronously — should complete well under 10ms
    expect(elapsed).toBeLessThan(50);
  });
});
