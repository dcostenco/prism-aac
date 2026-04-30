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

const STYLE_VERSION = 1;
const ARASAAC_API = 'https://api.arasaac.org/v1';
const ARASAAC_CDN = 'https://static.arasaac.org/pictograms';
const MEM_CACHE = new Map<string, string | null>();

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
    });
    if (!res.ok) return null;
    const data: ArasaacHit[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const id = data[0]._id;
    const imgRes = await fetch(`${ARASAAC_CDN}/${id}/${id}_500.png`);
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
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    return await res.blob();
  } catch {
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
    MEM_CACHE.set(key, url);
    return url;
  }

  let blob = await fetchArasaac(token, lang);
  if (!blob && mode === 'symbols-ai') {
    blob = await fetchSynaluxAI(phrase, lang);
  }
  if (!blob) {
    MEM_CACHE.set(key, null);
    return null;
  }
  await cachePut(key, blob);
  const url = URL.createObjectURL(blob);
  MEM_CACHE.set(key, url);
  return url;
}
