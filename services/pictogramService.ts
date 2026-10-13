'use client';

/**
 * Pictogram service — generated pictures for typed words, on paid plans.
 *
 * Board tiles, category icons and search results show their words: this build
 * ships no picture library of its own and no longer downloads third-party
 * pictograms. A prediction-bar word may get a picture from the Synalux portal's
 * shared generated-picture cache when the account is on a paid plan; tiles never
 * request generation, so a board render cannot start paid work.
 *
 * Generated pictures are held in memory for the session. Pictures cached on the
 * device by earlier versions are deleted once by clearLegacyPictogramCache().
 */

import { PictureMode } from '@/store/settingsStore';
import { SynaluxProfile } from '@/services/aiService';
import { SYNALUX_API, timeoutSignal } from '@/lib/portalConfig';
import { PROFANITY, SENSITIVE } from '@/engine/ageBlocklist';
export { clearLegacyPictogramCache } from '@/services/legacyPictogramCache';

/**
 * Picture mode is derived from the user's Synalux plan, not from a user
 * preference. Free and anonymous users see words; paid subscribers (Standard /
 * Advanced / Enterprise) additionally get generated pictures for prediction-bar
 * words.
 *
 * A null profile means anonymous or still loading, so it must stay on the free
 * path. Optimistically calling the paid route caused a burst of 401s for every
 * anonymous first visit. Paid profile hydration changes the mode to
 * `symbols-ai`, which is part of the cache key.
 */
export function pictureModeForProfile(profile: SynaluxProfile | null): PictureMode {
  if (!profile || profile.plan === 'free') return 'symbols';
  return 'symbols-ai';
}

const STYLE_VERSION = 2;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB cap — prevents OOM from oversized blobs
// Large enough to hold a full prediction session without eviction.
// We do NOT revoke on eviction — a component may still hold the old blob URL
// in its state and revoking causes WebKitBlobResource error 1. Blob URLs are
// cleaned up by the browser when the page unloads; the memory cost is small.
const MAX_MEM_CACHE = 600;
const MEM_CACHE = new Map<string, string | null>();
const IN_FLIGHT = new Map<string, Promise<string | null>>();

function memCacheSet(key: string, value: string | null) {
  if (MEM_CACHE.size >= MAX_MEM_CACHE) {
    const oldest = MEM_CACHE.keys().next().value;
    if (oldest !== undefined) MEM_CACHE.delete(oldest);
    // No URL.revokeObjectURL — component may still hold the old URL.
  }
  MEM_CACHE.set(key, value);
}

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalize(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

// Tokenize a phrase into the most "iconic" word. Picks the longest word that
// isn't a stopword — a heuristic, but good enough for AAC vocab where most
// phrases have a clear head noun/verb ("I want food" → food).
const STOPWORDS = new Set([
  'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'you', 'your',
  'a', 'an', 'the', 'is', 'am', 'are', 'be', 'do', 'does',
  'to', 'of', 'in', 'on', 'at', 'and', 'or', 'but', 'with',
  'for', 'this', 'that', 'these', 'those', 'it', 'its', 'so',
]);
function pickHeadWord(phrase: string): string {
  const words = normalize(phrase).split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const content = words.filter((w) => !STOPWORDS.has(w));
  const pool = content.length > 0 ? content : words;
  return pool.reduce((a, b) => (b.length > a.length ? b : a));
}

// ── Synalux generated pictures ──────────────────────────────────────────────

async function fetchSynaluxAI(phrase: string, lang: string): Promise<Blob | null> {
  const t = timeoutSignal(5000);
  try {
    const res = await fetch(`${SYNALUX_API}/prism-aac/pictogram`, {
      method: 'POST',
      // 'same-origin': credentials sent to synalux.ai but NOT on cross-origin
      // redirects to supabase.co (which returns ACAO:* — incompatible with
      // credentials:include and triggers a browser CORS block).
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phrase: phrase.slice(0, 100),
        lang,
        style: 'aac-pictogram',
        styleVersion: STYLE_VERSION,
      }),
      signal: t.signal,
    });
    if (!res.ok) {
      console.warn(`[pictogram] Synalux AI returned ${res.status} for "${phrase}" (${lang})`);
      return null;
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      console.warn(`[pictogram] Synalux AI returned non-image content-type "${ct}" for "${phrase}"`);
      return null;
    }
    const cl = res.headers.get('content-length');
    if (cl && parseInt(cl, 10) > MAX_IMAGE_BYTES) {
      console.warn(`[pictogram] Synalux AI response too large (${cl} bytes) for "${phrase}"; skipping`);
      return null;
    }
    const blob = await res.blob();
    if (blob.size > MAX_IMAGE_BYTES) {
      console.warn(`[pictogram] Synalux AI blob too large (${blob.size} bytes) for "${phrase}"; skipping`);
      return null;
    }
    return blob;
  } catch (e) {
    console.warn(`[pictogram] Synalux AI fetch failed for "${phrase}":`, e instanceof Error ? e.message : e);
    return null;
  } finally {
    t.cancel();
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface PictogramOptions {
  /**
   * Only the prediction bar sets this. Tiles, category icons and search
   * results show words and must never start paid generation.
   */
  generated?: boolean;
}

export async function getPictogramUrl(
  phrase: string,
  lang: string,
  mode: PictureMode,
  options: PictogramOptions = {},
): Promise<string | null> {
  if (mode !== 'symbols-ai' || !options.generated) return null;
  const token = pickHeadWord(phrase);
  if (!token) return null;
  const lowerToken = token.toLowerCase();
  if (PROFANITY.has(lowerToken) || SENSITIVE.has(lowerToken)) return null;

  const key = await sha256(`v${STYLE_VERSION}|${lang}|${mode}|${token}`);
  if (MEM_CACHE.has(key)) return MEM_CACHE.get(key) ?? null;
  const existingRequest = IN_FLIGHT.get(key);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const blob = await fetchSynaluxAI(phrase, lang);
    const url = blob ? URL.createObjectURL(blob) : null;
    memCacheSet(key, url);
    return url;
  })();
  IN_FLIGHT.set(key, request);
  try {
    return await request;
  } finally {
    if (IN_FLIGHT.get(key) === request) IN_FLIGHT.delete(key);
  }
}
