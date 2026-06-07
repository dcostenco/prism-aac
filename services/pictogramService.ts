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
import { timeoutSignal } from '@/lib/portalConfig';

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
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB cap — prevents OOM from oversized blobs
const ARASAAC_API = 'https://api.arasaac.org/v1';
const ARASAAC_CDN = 'https://static.arasaac.org/pictograms';
// Large enough to hold a full vocabulary board without eviction.
// We do NOT revoke on eviction — a PhraseTile component may still hold
// the old blob URL in its iconUrl state and revoking causes
// WebKitBlobResource error 1. Blob URLs are cleaned up by the browser
// when the page unloads; the memory cost is negligible.
const MAX_MEM_CACHE = 600;
const MEM_CACHE = new Map<string, string | null>();

function memCacheSet(key: string, value: string | null) {
  if (MEM_CACHE.size >= MAX_MEM_CACHE) {
    const oldest = MEM_CACHE.keys().next().value;
    if (oldest !== undefined) MEM_CACHE.delete(oldest);
    // No URL.revokeObjectURL — component may still hold the old URL.
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

// LocalStorage-backed negative cache — words ARASAAC doesn't have pictograms for.
// Prevents repeated 404 requests (and console errors) across sessions.
let arasaacMisses = new Set<string>();
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('prism-arasaac-misses');
    if (stored) arasaacMisses = new Set(JSON.parse(stored));
  } catch {}
}

function saveArasaacMisses() {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(arasaacMisses);
    if (arr.length > 5000) {
      const trimmed = arr.slice(-5000);
      arasaacMisses = new Set(trimmed);
      localStorage.setItem('prism-arasaac-misses', JSON.stringify(trimmed));
    } else {
      localStorage.setItem('prism-arasaac-misses', JSON.stringify(arr));
    }
  } catch {}
}

async function fetchArasaac(token: string, lang: string): Promise<Blob | null> {
  const langCode = lang.split('-')[0] || 'en';
  const missKey = `${langCode}:${token.toLowerCase()}`;
  if (arasaacMisses.has(missKey)) return null;

  const searchT = timeoutSignal(5000);
  let id: number | null = null;
  try {
    const res = await fetch(`${ARASAAC_API}/pictograms/${langCode}/search/${encodeURIComponent(token)}`, {
      headers: { 'Accept': 'application/json' },
      signal: searchT.signal,
    });
    if (!res.ok) {
      arasaacMisses.add(missKey);
      saveArasaacMisses();
      return null;
    }
    const data: ArasaacHit[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      arasaacMisses.add(missKey);
      saveArasaacMisses();
      return null;
    }
    id = data[0]._id;
  } catch {
    return null;
  } finally {
    searchT.cancel();
  }
  const imgT = timeoutSignal(5000);
  try {
    const imgRes = await fetch(`${ARASAAC_CDN}/${id}/${id}_500.png`, {
      signal: imgT.signal,
    });
    if (!imgRes.ok) return null;
    const cl = imgRes.headers.get('content-length');
    if (cl && parseInt(cl, 10) > MAX_IMAGE_BYTES) return null;
    const blob = await imgRes.blob();
    if (blob.size > MAX_IMAGE_BYTES) return null;
    return blob;
  } catch {
    return null;
  } finally {
    imgT.cancel();
  }
}

// ── Synalux AI fallback ─────────────────────────────────────────────────────

async function fetchSynaluxAI(phrase: string, lang: string): Promise<Blob | null> {
  const base = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API)
    ? process.env.NEXT_PUBLIC_SYNALUX_API
    : 'https://synalux.ai/api/v1';
  const t = timeoutSignal(5000);
  try {
    const res = await fetch(`${base}/prism-aac/pictogram`, {
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

  // Single-character tokens (pronouns like "I"/"я", articles like "a"/"и")
  // are valid AAC words across all 20 supported languages. Let ARASAAC
  // search determine the best pictogram — no length-based skip.

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

// ── Pre-cache: download all icons in background for offline use ───────────

let _precacheDone = false;

/**
 * Pre-download pictograms for all DEFAULT_PHRASES in the user's language.
 * Runs once per session, non-blocking, low priority. After this completes,
 * every phrase tile renders instantly offline — no network needed.
 */
export async function precacheAllPictograms(
  lang: string,
  mode: PictureMode,
): Promise<void> {
  if (_precacheDone || mode === 'off') return;
  _precacheDone = true;

  try {
    const { DEFAULT_PHRASES } = await import('@/constants/phrases');
    const { getPhraseText } = await import('@/constants/phraseTranslations');

    let cached = 0;
    let fetched = 0;

    for (const p of DEFAULT_PHRASES) {
      const text = getPhraseText(p.id, lang as any, p.text);
      const token = pickHeadWord(text);
      if (!token) continue;

      const key = await sha256(`v${STYLE_VERSION}|${lang}|${mode}|${token}`);
      if (MEM_CACHE.has(key)) { cached++; continue; }
      const existing = await cacheGet(key);
      if (existing) { cached++; continue; }

      // Not cached — fetch and store
      await getPictogramUrl(text, lang, mode);
      fetched++;

      // Yield to main thread every 10 fetches
      if (fetched % 10 === 0) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    if (typeof window !== 'undefined') {
      console.log(`[Pictogram] Pre-cached ${cached} existing + ${fetched} new icons for ${lang}`);
    }
  } catch (e) {
    // Non-critical — app works without pre-cache, just slower on first tap
    if (typeof window !== 'undefined') {
      console.warn('[Pictogram] Pre-cache failed:', e);
    }
  }
}
