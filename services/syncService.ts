'use client';
/**
 * Sync Service — Supabase Hivemind with localStorage fallback.
 *
 * Architecture:
 *   - localStorage is always the primary store (instant, works offline)
 *   - Supabase is the sync layer (cross-device, hivemind mode)
 *   - On load: pull from Supabase, merge with local, write back
 *   - On save: write local immediately, push to Supabase in background
 *   - Conflict resolution: last-write-wins for settings, union-merge for custom data
 */

import { getSupabase, isSupabaseConfigured as _isConfigured } from './supabase';
import { WordFreqEntry, HistoryEntry, Category, Phrase } from '@/types';

export function isSupabaseConfigured(): boolean { return _isConfigured(); }

const AAC_TABLE = 'aac_profiles';

export interface AACProfile {
  device_id: string;
  user_id: string;
  custom_categories: Category[];
  custom_phrases: Phrase[];
  word_freq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
  history: HistoryEntry[];
  settings: Record<string, unknown>;
  updated_at: string;
}

function getDeviceId(): string {
  let id = localStorage.getItem('prism-aac-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('prism-aac-device-id', id);
  }
  return id;
}

function getUserId(): string {
  return localStorage.getItem('prism-aac-user-id') || 'default';
}

export function setUserId(id: string): void {
  localStorage.setItem('prism-aac-user-id', id);
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

let currentStatus: SyncStatus = 'idle';
const listeners = new Set<(s: SyncStatus) => void>();

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(currentStatus);
  return () => listeners.delete(fn);
}

function setStatus(s: SyncStatus) {
  currentStatus = s;
  listeners.forEach(fn => fn(s));
}

export async function pushToCloud(data: Partial<AACProfile>): Promise<void> {
  if (!_isConfigured()) { setStatus('offline'); return; }
  const sb = getSupabase();
  if (!sb) { setStatus('offline'); return; }

  setStatus('syncing');
  try {
    const record = {
      device_id: getDeviceId(),
      user_id: getUserId(),
      ...data,

    };
    await sb.from(AAC_TABLE).upsert(record, { onConflict: 'user_id,device_id' });
    setStatus('synced');
  } catch {
    setStatus('error');
  }
}

/**
 * Emergency sync for page teardown (pagehide, visibilitychange=hidden).
 *
 * Strategy:
 *   1. If payload < 60KB → sendBeacon (guaranteed delivery, no async)
 *   2. If payload > 60KB → write to IndexedDB, register Background Sync
 *      via Service Worker (uploads after tab closes)
 *   3. Fallback: keepalive fetch (may fail if > 64KB browser limit)
 *
 * The W3C Fetch spec hard-caps keepalive payloads at 64KB total.
 * An active AAC user's profile easily exceeds this.
 */
const BEACON_SIZE_LIMIT = 60_000; // 60KB (safe margin under 64KB)
const SYNC_IDB_KEY = 'prism-pending-sync';

export function pushToCloudKeepalive(data: Partial<AACProfile>): void {
  if (!_isConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const url = (sb as unknown as { supabaseUrl: string }).supabaseUrl;
    const key = (sb as unknown as { supabaseKey: string }).supabaseKey;
    if (!url || !key) return;

    const record = { device_id: getDeviceId(), user_id: getUserId(), ...data };
    const body = JSON.stringify(record);
    const endpoint = `${url}/rest/v1/${AAC_TABLE}?on_conflict=user_id,device_id`;

    // sendBeacon cannot set custom headers, so we pass apikey as a query
    // parameter. Supabase PostgREST accepts ?apikey= as an alternative to
    // the apikey header. Without this, every sendBeacon was silently 401'd.
    const authedEndpoint = `${endpoint}&apikey=${encodeURIComponent(key)}`;

    const blob = new Blob([body], { type: 'application/json' });
    if (blob.size < BEACON_SIZE_LIMIT) {
      const sent = navigator.sendBeacon?.(authedEndpoint, blob);
      if (sent) return;
    } else {
      const criticalRecord = {
        device_id: record.device_id,
        user_id: record.user_id,
        custom_categories: record.custom_categories,
        custom_phrases: record.custom_phrases,
      };
      const criticalBlob = new Blob([JSON.stringify(criticalRecord)], { type: 'application/json' });
      if (criticalBlob.size < BEACON_SIZE_LIMIT) {
        const sent = navigator.sendBeacon?.(authedEndpoint, criticalBlob);
        if (sent) return;
      }
    }

    // Last resort: keepalive fetch (may fail > 64KB but worth trying)
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* best effort */ }
}

export async function pullFromCloud(): Promise<Partial<AACProfile> | null> {
  if (!_isConfigured()) { setStatus('offline'); return null; }
  const sb = getSupabase();
  if (!sb) { setStatus('offline'); return null; }

  setStatus('syncing');
  try {
    const userId = getUserId();
    const { data, error } = await sb
      .from(AAC_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) { setStatus('error'); return null; }
    if (!data || data.length === 0) { setStatus('synced'); return null; }
    setStatus('synced');
    return data[0] as AACProfile;
  } catch {
    setStatus('offline');
    return null;
  }
}

/** Merge remote word frequencies with local (take higher counts) */
export function mergeWordFreq(
  local: Record<string, WordFreqEntry>,
  remote: Record<string, WordFreqEntry>,
): Record<string, WordFreqEntry> {
  const merged = { ...local };
  for (const [key, val] of Object.entries(remote)) {
    const existing = merged[key];
    if (!existing || val.count > existing.count || val.lastUsed > existing.lastUsed) {
      merged[key] = {
        count: Math.max(val.count, existing?.count ?? 0),
        lastUsed: Math.max(val.lastUsed, existing?.lastUsed ?? 0),
      };
    }
  }
  return merged;
}

/** Merge custom categories/phrases with tombstone support.
 *  Items with deletedAt are tombstones — they suppress the item on all devices. */
export function mergeCustomItems<T extends { id: string; deletedAt?: number; updatedAt?: number }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) {
    const existing = map.get(item.id);
    if (!existing) { map.set(item.id, item); continue; }
    // Tombstone wins: if either side deleted it, keep the deletion
    if (item.deletedAt || existing.deletedAt) {
      const winner = (item.deletedAt ?? 0) > (existing.deletedAt ?? 0) ? item : existing;
      map.set(item.id, winner);
    } else {
      // Newest mutation wins (updatedAt comparison). If neither has a
      // timestamp, local is authoritative (backward compat).
      const localTime = (item as { updatedAt?: number }).updatedAt ?? 0;
      const remoteTime = (existing as { updatedAt?: number }).updatedAt ?? 0;
      map.set(item.id, localTime >= remoteTime ? item : existing);
    }
  }
  return [...map.values()].filter(item => !item.deletedAt);
}

/** Merge history entries (union, dedup by timestamp, cap at 100) */
export function mergeHistory(local: HistoryEntry[], remote: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<number>();
  const merged: HistoryEntry[] = [];
  for (const entry of [...local, ...remote]) {
    if (!seen.has(entry.timestamp)) {
      seen.add(entry.timestamp);
      merged.push(entry);
    }
  }
  return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
}

/** Subscribe to realtime changes for hivemind sync */
export function subscribeToChanges(
  onUpdate: (profile: Partial<AACProfile>) => void,
): (() => void) | null {
  if (!_isConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;

  const userId = getUserId();
  const deviceId = getDeviceId();

  const channel = sb
    .channel('aac-hivemind')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: AAC_TABLE,
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const remote = payload.new as AACProfile;
        if (remote.device_id !== deviceId) {
          onUpdate(remote);
        }
      },
    )
    .subscribe();

  return () => { sb.removeChannel(channel); };
}
