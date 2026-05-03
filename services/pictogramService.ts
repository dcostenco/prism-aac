'use client';

/**
 * Pictogram service — fetches an AAC-style picture for a phrase.
 *
 * Two-stage lookup:
 *   1. ARASAAC pictogram search (free, ~12.9k symbols, CC BY-NC-SA — fine for
 *      this AGPL-licensed AAC app; paid Synalux tier requires a commercial
 *      ARASAAC license which is negotiated separately).
 *   2. Synalux portal AI generation fallback (paid tiers only) — produces a
 *      flat-vector pictogram via the model selected server-side.
 *
 * Results are cached in IndexedDB keyed by sha256(normalized_phrase + lang +
 * style_version). The cache is content-addressed (no user_id in the key) so
 * common phrases share blobs across users — a privacy + bandwidth win.
 */

import { PictureMode } from '@/store/settingsStore';
import { SynaluxProfile } from '@/services/aiService';

/**
 * Picture mode is derived from the user's Synalux plan, not from a user
 * preference. Free signed-in users get the free ARASAAC symbol library;
 * paid subscribers (Standard / Advanced / Enterprise) additionally get
 * AI-generated pictograms for phrases ARASAAC doesn't cover.
 *
 * Profile-load race: profile is null for ~1-2s after page load while
 * `fetchSynaluxProfile()` runs. If we default to 'symbols' during that
 * window, paid users miss the AI fallback — and the result gets cached
 * `null` in MEM_CACHE, so even when profile loads they never see icons
 * for ARASAAC-miss tokens. Default to 'symbols-ai' optimistically; the
 * portal route returns 403 for actual free-tier users (and we cache the
 * null gracefully).
 */
export function pictureModeForProfile(profile: SynaluxProfile | null): PictureMode {
  if (profile && profile.plan === 'free') return 'symbols';
  return 'symbols-ai';
}

const STYLE_VERSION = 1;
const ARASAAC_API = 'https://api.arasaac.org/v1';
const ARASAAC_CDN = 'https://static.arasaac.org/pictograms';
const MAX_MEM_CACHE = 100;
const MEM_CACHE = new Map<string, string | null>();

function memCacheSet(key: string, value: string | null) {
  if (MEM_CACHE.size >= MAX_MEM_CACHE) {
    const oldest = MEM_CACHE.keys().next().value;
    if (oldest !== undefined) {
      const oldUrl = MEM_CACHE.get(oldest);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      MEM_CACHE.delete(oldest);
    }
  }
  MEM_CACHE.set(key, value);
}

interface ArasaacHit {
  _id: number;
  keywords?: { keyword: string }[];
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

// Tokenize a phrase into the most "iconic" word for symbol lookup. Picks the
// longest word that isn't a stopword — a heuristic, but good enough for AAC
// vocab where most phrases have a clear head noun/verb ("I want food" → food).
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

// ── IndexedDB cache ─────────────────────────────────────────────────────────

const DB_NAME = 'prism-aac-pictograms';
const STORE = 'blobs';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function cacheGet(key: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function cachePut(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* eviction / quota — best effort */ }
}

// ── ARASAAC lookup ──────────────────────────────────────────────────────────

async function fetchArasaac(token: string, lang: string): Promise<Blob | null> {
  const langCode = lang.split('-')[0] || 'en';
  try {
    const res = await fetch(`${ARASAAC_API}/pictograms/${langCode}/search/${encodeURIComponent(token)}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: ArasaacHit[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const id = data[0]._id;
    const imgRes = await fetch(`${ARASAAC_CDN}/${id}/${id}_500.png`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!imgRes.ok) return null;
    return await imgRes.blob();
  } catch {
    return null;
  }
}

// ── Synalux AI fallback ─────────────────────────────────────────────────────

async function fetchSynaluxAI(phrase: string, lang: string): Promise<Blob | null> {
  const base = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API)
    ? process.env.NEXT_PUBLIC_SYNALUX_API
    : 'https://synalux.ai/api/v1';
  try {
    const res = await fetch(`${base}/prism-aac/pictogram`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phrase: phrase.slice(0, 100),
        lang,
        style: 'aac-pictogram',
        styleVersion: STYLE_VERSION,
      }),
      signal: AbortSignal.timeout(5000),
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
    return await res.blob();
  } catch (e) {
    console.warn(`[pictogram] Synalux AI fetch failed for "${phrase}":`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getPictogramUrl(
  phrase: string,
  lang: string,
  mode: PictureMode,
): Promise<string | null> {
  if (mode === 'off') return null;
  const token = pickHeadWord(phrase);
  if (!token) return null;

  const key = await sha256(`v${STYLE_VERSION}|${lang}|${mode}|${token}`);

  if (MEM_CACHE.has(key)) return MEM_CACHE.get(key) ?? null;

  const cached = await cacheGet(key);
  if (cached) {
    const url = URL.createObjectURL(cached);
    memCacheSet(key, url);
    return url;
  }

  // Single-character tokens are prepositions / articles / pronouns ("у",
  // "и", "a", "I"). ARASAAC returns "letter X" alphabet pictograms for
  // these, which is misleading in an AAC context. Skip pictogram fetch
  // entirely for these short tokens.
  if (token.length <= 1) {
    memCacheSet(key, null);
    return null;
  }

  const fullPhrase = normalize(phrase);
  let blob = fullPhrase !== token ? await fetchArasaac(fullPhrase, lang) : null;
  if (!blob) blob = await fetchArasaac(token, lang);
  // English fallback — but ONLY when the token is itself ASCII-Latin. For
  // Cyrillic / Arabic / CJK tokens, the English ARASAAC endpoint can't
  // make sense of them and often returns a generic "letter X" pictogram
  // (e.g. Cyrillic "у" → English "letter U" image).
  const isLatinToken = /^[\x20-\x7e]+$/.test(token);
  if (!blob && lang !== 'en' && lang !== 'en-US' && isLatinToken) {
    if (fullPhrase !== token) blob = await fetchArasaac(fullPhrase, 'en');
    if (!blob) blob = await fetchArasaac(token, 'en');
  }
  if (!blob && mode === 'symbols-ai') {
    blob = await fetchSynaluxAI(phrase, lang);
  }
  if (!blob) {
    memCacheSet(key, null);
    return null;
  }
  await cachePut(key, blob);
  const url = URL.createObjectURL(blob);
  memCacheSet(key, url);
  return url;
}
