/**
 * Voice catalog service — client side.
 *
 * Fetches the curated voice list from the Synalux portal (single source of
 * truth at /api/v1/tts/voices). Caches in memory for the session — the
 * catalog rarely changes, the Settings UI may render multiple times, and
 * we don't want to hammer the endpoint while a user scrolls a dropdown.
 *
 * All voices in the catalog are paid-tier-only on the server side (the
 * endpoint returns 403 for free); on the client we still show the picker
 * for paid users only via SettingsModal's `isPaid` gate.
 */

export type VoiceBackend = 'inworld' | 'azure';
export type VoiceGender = 'female' | 'male' | 'neutral';

export interface VoiceEntry {
  voiceId: string;
  lang: string;
  backend: VoiceBackend;
  gender: VoiceGender;
  displayName: string;
  description?: string;
  tags?: string[];
}

import { SYNALUX_API, timeoutSignal } from '@/lib/portalConfig';

let cache: { fetchedAt: number; voices: VoiceEntry[] } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const FETCH_TIMEOUT_MS = 8_000;

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('prism-aac-auth-token') || null;
}

/**
 * Returns all voices the user is allowed to choose from. Returns [] if the
 * user is not signed in / on free tier (the portal returns 403 in that case).
 */
export async function fetchVoiceCatalog(force = false): Promise<VoiceEntry[]> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.voices;
  }

  // Skip the round-trip when offline — return cached voices if we have
  // them (still useful in the picker; caller's own offline UI handles
  // the "actually try to use them" case).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return cache?.voices ?? [];
  }

  const { signal, cancel } = timeoutSignal(FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${SYNALUX_API}/tts/voices`, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal,
    });

    if (!res.ok) {
      // 403 = free tier or unauthenticated → caller renders empty picker.
      // Other errors → log and return cached if any, else empty.
      console.warn('[voiceCatalog] fetch failed:', res.status);
      return cache?.voices ?? [];
    }

    const json = await res.json();
    const rawVoices = Array.isArray(json?.voices) ? json.voices as unknown[] : [];
    // Cap on catalog size — no legitimate reason to ship 10k voices to
    // the client; defends against a buggy/hostile portal flooding the
    // settings dropdown.
    const MAX_CATALOG_SIZE = 1000;
    const voices: VoiceEntry[] = rawVoices.slice(0, MAX_CATALOG_SIZE).filter(
      (v): v is VoiceEntry => !!v && typeof v === 'object'
        && typeof (v as VoiceEntry).voiceId === 'string'
        && typeof (v as VoiceEntry).lang === 'string',
    );
    cache = { fetchedAt: Date.now(), voices };
    return voices;
  } catch (e) {
    console.warn('[voiceCatalog] fetch error:', e instanceof Error ? e.message : e);
    return cache?.voices ?? [];
  } finally {
    cancel();
  }
}

/** Filter the catalog to a single language (base code). */
export function voicesForLanguage(catalog: VoiceEntry[], lang: string): VoiceEntry[] {
  const norm = (lang || 'en').toLowerCase().replace('_', '-');
  const exact = catalog.filter(v => v.lang === norm);
  if (exact.length > 0) return exact;
  const base = norm.split('-')[0];
  return catalog.filter(v => v.lang === base);
}

/** Bypass cache — used by tests. */
export function _resetVoiceCatalogCacheForTests(): void {
  cache = null;
}
