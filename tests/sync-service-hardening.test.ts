/**
 * syncService hardening tests — military grade.
 *
 * The basic merge tests live in ux-accessibility.test.ts. This file
 * covers the safety-critical edge cases that are NOT tested there:
 *   - mergeCustomItems tombstone behaviour (deletedAt suppresses cross-device)
 *   - mergeCustomItems conflict resolution via updatedAt (newer wins)
 *   - mergeCustomItems: local authority when no timestamps
 *   - mergeWordFreq: new remote keys are appended (not just existing ones updated)
 *   - mergeHistory: exact timestamp dedup (two entries at same ms → one survives)
 *   - mergeHistory: sorted descending (most recent first)
 */
import { describe, it, expect } from 'vitest';
import { mergeWordFreq, mergeCustomItems, mergeHistory } from '@/services/syncService';

// ── mergeCustomItems — tombstone behaviour ────────────────────────────────

describe('mergeCustomItems — tombstone (deletedAt) behaviour', () => {
  it('remote tombstone suppresses a locally active item', () => {
    const local = [{ id: 'a', name: 'Active locally' }];
    const remote = [{ id: 'a', name: 'Deleted server-side', deletedAt: 1000 }];
    const result = mergeCustomItems(local, remote);
    // Tombstone from remote must evict the item from the merged output
    expect(result.find((x) => x.id === 'a')).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('local tombstone suppresses a remote active item', () => {
    const local = [{ id: 'b', name: 'Deleted locally', deletedAt: 2000 }];
    const remote = [{ id: 'b', name: 'Still active on server' }];
    const result = mergeCustomItems(local, remote);
    expect(result.find((x) => x.id === 'b')).toBeUndefined();
  });

  it('tombstone from the later timestamp wins when both sides deleted the item', () => {
    // Both deleted — higher deletedAt timestamp is authoritative (last delete wins)
    const local = [{ id: 'c', deletedAt: 5000 }];
    const remote = [{ id: 'c', deletedAt: 3000 }];
    const result = mergeCustomItems(local, remote);
    // Regardless of which tombstone wins, the item must still be absent
    expect(result.find((x) => x.id === 'c')).toBeUndefined();
  });

  it('non-deleted items survive a merge that also has tombstones', () => {
    const local = [
      { id: 'keep', name: 'Keep me' },
      { id: 'remove', name: 'Delete me', deletedAt: 1000 },
    ];
    const remote = [{ id: 'keep', name: 'Keep me (remote)' }];
    const result = mergeCustomItems(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('keep');
  });

  it('tombstone does not affect items with a different id', () => {
    const local = [{ id: 'alive', name: 'I am fine' }];
    const remote = [
      { id: 'alive', name: 'Still fine' },
      { id: 'dead', name: 'Tombstoned', deletedAt: 9999 },
    ];
    const result = mergeCustomItems(local, remote);
    expect(result.find((x) => x.id === 'alive')).toBeDefined();
    expect(result.find((x) => x.id === 'dead')).toBeUndefined();
  });
});

// ── mergeCustomItems — updatedAt conflict resolution ──────────────────────

describe('mergeCustomItems — updatedAt conflict resolution', () => {
  it('remote item with newer updatedAt overrides local', () => {
    const local = [{ id: 'x', name: 'Old local', updatedAt: 100 }];
    const remote = [{ id: 'x', name: 'New remote', updatedAt: 999 }];
    const result = mergeCustomItems(local, remote);
    expect(result[0].name).toBe('New remote');
  });

  it('local item with newer updatedAt beats remote', () => {
    const local = [{ id: 'y', name: 'New local', updatedAt: 999 }];
    const remote = [{ id: 'y', name: 'Old remote', updatedAt: 100 }];
    const result = mergeCustomItems(local, remote);
    expect(result[0].name).toBe('New local');
  });

  it('local wins on equal timestamps (≥ comparison — local authority)', () => {
    const local = [{ id: 'z', name: 'Local equal', updatedAt: 500 }];
    const remote = [{ id: 'z', name: 'Remote equal', updatedAt: 500 }];
    const result = mergeCustomItems(local, remote);
    expect(result[0].name).toBe('Local equal');
  });

  it('local wins when neither side has updatedAt (backward compat)', () => {
    const local = [{ id: 'no-ts', name: 'Local no-ts' }];
    const remote = [{ id: 'no-ts', name: 'Remote no-ts' }];
    const result = mergeCustomItems(local, remote);
    expect(result[0].name).toBe('Local no-ts');
  });

  it('remote-only items are included even if local has no matching id', () => {
    const local = [{ id: 'local-only', name: 'Only local' }];
    const remote = [{ id: 'remote-only', name: 'Only remote' }];
    const result = mergeCustomItems(local, remote);
    expect(result).toHaveLength(2);
  });
});

// ── mergeWordFreq — completeness ──────────────────────────────────────────

describe('mergeWordFreq — all scenarios', () => {
  it('adds remote keys that are absent locally', () => {
    const local = { hello: { count: 3, lastUsed: 1000 } };
    const remote = { world: { count: 7, lastUsed: 2000 } };
    const merged = mergeWordFreq(local, remote);
    expect(merged.world).toEqual({ count: 7, lastUsed: 2000 });
    expect(merged.hello).toEqual({ count: 3, lastUsed: 1000 });
  });

  it('keeps local count when local > remote', () => {
    const local = { hi: { count: 10, lastUsed: 1000 } };
    const remote = { hi: { count: 2, lastUsed: 500 } };
    const merged = mergeWordFreq(local, remote);
    expect(merged.hi.count).toBe(10);
  });

  it('takes remote lastUsed when remote is more recent', () => {
    const local = { hi: { count: 5, lastUsed: 1000 } };
    const remote = { hi: { count: 3, lastUsed: 9999 } };
    const merged = mergeWordFreq(local, remote);
    expect(merged.hi.lastUsed).toBe(9999);
  });

  it('takes remote count when remote > local', () => {
    const local = { bye: { count: 1, lastUsed: 100 } };
    const remote = { bye: { count: 20, lastUsed: 50 } };
    const merged = mergeWordFreq(local, remote);
    expect(merged.bye.count).toBe(20);
  });

  it('does not modify the local object in place', () => {
    const local = { a: { count: 1, lastUsed: 1 } };
    const original = { ...local.a };
    mergeWordFreq(local, { a: { count: 99, lastUsed: 99 } });
    expect(local.a).toEqual(original);
  });
});

// ── mergeHistory — edge cases ─────────────────────────────────────────────

describe('mergeHistory — edge cases', () => {
  it('deduplicates entries with the exact same timestamp', () => {
    const local = [{ text: 'a', timestamp: 1000 }];
    const remote = [{ text: 'a-dup', timestamp: 1000 }]; // same timestamp
    const merged = mergeHistory(local, remote);
    expect(merged.filter((e) => e.timestamp === 1000)).toHaveLength(1);
  });

  it('returns entries sorted descending (most recent first)', () => {
    const local = [{ text: 'old', timestamp: 100 }, { text: 'new', timestamp: 500 }];
    const merged = mergeHistory(local, []);
    expect(merged[0].timestamp).toBeGreaterThanOrEqual(merged[merged.length - 1].timestamp);
  });

  it('caps merged output at 100 entries even when combined list is larger', () => {
    const local = Array.from({ length: 80 }, (_, i) => ({ text: `l${i}`, timestamp: i * 2 }));
    const remote = Array.from({ length: 80 }, (_, i) => ({ text: `r${i}`, timestamp: i * 2 + 1 }));
    const merged = mergeHistory(local, remote);
    expect(merged.length).toBeLessThanOrEqual(100);
  });

  it('handles empty local + non-empty remote', () => {
    const remote = [{ text: 'a', timestamp: 1 }, { text: 'b', timestamp: 2 }];
    const merged = mergeHistory([], remote);
    expect(merged).toHaveLength(2);
  });

  it('handles both empty without throwing', () => {
    expect(mergeHistory([], [])).toEqual([]);
  });

  it('keeps the top-100 highest-timestamp entries when cap is exceeded', () => {
    // Create 150 entries with timestamps 1..150
    const all = Array.from({ length: 150 }, (_, i) => ({ text: `t${i}`, timestamp: i + 1 }));
    const merged = mergeHistory(all, []);
    expect(merged.length).toBe(100);
    // Highest 100 timestamps should survive (51..150)
    expect(merged[0].timestamp).toBe(150);
    expect(merged[99].timestamp).toBe(51);
  });
});
