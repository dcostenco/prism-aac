/**
 * AAC Gotcha Recorder — feeds the Prism v14.0.0 audit-hooks postflight corpus
 * from the browser side.
 *
 * What it does
 * ────────────
 * Every successful caregiver action (add_phrase, remove_phrase, reorder, etc.)
 * is a signal: the model's prior output didn't match what the caregiver wanted.
 * Each correction becomes one Experience row with:
 *   - fingerprint  (caregiver-action verb + categoryId)
 *   - level        ("failed" — the model's prior suggestion needed correction)
 *   - gotcha       (a short distilled string — what should have happened)
 *   - session_date (now)
 *
 * After ~50 sessions, the corpus is large enough for the v14.0.0 gate to
 * surface clarifying questions. Until then it accumulates silently.
 *
 * Storage
 * ───────
 * IndexedDB (via a simple persist wrapper), per-user, no cloud upload by
 * default. A future sync job can ship batches to the Synalux portal endpoint
 * for paid tiers — that path is gated on user consent. Free tier stays
 * fully local: HIPAA-safe, no PHI off device.
 *
 * NOT IN SCOPE FOR THIS PR
 * ────────────────────────
 * - Cloud sync (later, behind explicit consent)
 * - Spreading-activation phrase ranking from the corpus (#80, separate task)
 * - Gate UI surfacing (uses the corpus once warm)
 *
 * This module is a write-only sink for now. Reads come later.
 */
import { NoteAction } from '@/types';
import { sanitizeString } from '@/lib/safeStrings';

/** One Experience row, mirroring the Python postflight shape. */
export interface AacGotchaRecord {
  id: string;
  fingerprint: string;
  level: 'failed' | 'success' | 'partial' | 'lesson';
  summary: string;
  gotchas: string[];
  session_date: number;  // unix epoch seconds
  metadata: {
    action_type: NoteAction['type'];
    category_id?: string;
    user_lang?: string;
  };
}

const DB_NAME = 'aac-gotcha-corpus';
const STORE_NAME = 'experiences';
const DB_VERSION = 1;
/** Cap to keep IndexedDB bounded. 5,000 ≈ 5MB at ~1KB/row. */
const MAX_RECORDS = 5_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('fingerprint', 'fingerprint', { unique: false });
        store.createIndex('session_date', 'session_date', { unique: false });
      }
    };
  });
  return dbPromise;
}

/** Build a fingerprint hash from action + category. Used by the gate later
 *  to look up similar prior corrections. Must be stable across sessions. */
function fingerprintFor(action: NoteAction): string {
  const cat = (action.payload as Record<string, unknown>)?.categoryId ?? 'unknown';
  return `aac-caregiver-${action.type}-${cat}`;
}

/** Distill a caregiver action into a short gotcha string the gate can match
 *  against future similar prompts. Mirrors the Python postflight.distill_gotcha
 *  pattern: take the actionable detail, cap at 200 chars. */
function distillGotcha(action: NoteAction): string {
  const p = action.payload as Record<string, unknown>;
  switch (action.type) {
    case 'add_phrase':
      return `caregiver added phrase "${String(p.text ?? '').slice(0, 200)}" to ${String(p.categoryId ?? '').slice(0, 80)} — model's previous suggestion was incomplete`;
    case 'remove_phrase':
      return `caregiver removed phrase "${String(p.phraseText ?? '').slice(0, 200)}" from ${String(p.categoryId ?? '').slice(0, 80)} — model previously surfaced the wrong phrase`;
    case 'reorder_phrase':
      return `caregiver reordered phrase ${String(p.phraseId ?? '').slice(0, 80)} in ${String(p.categoryId ?? '').slice(0, 80)} — model's ordering was suboptimal`;
    case 'boost_word':
      return `caregiver boosted word "${String(p.word ?? '').slice(0, 100)}" — model under-weighted user vocab`;
    case 'add_sequence':
      return `caregiver added ordering sequence "${String(p.name ?? '').slice(0, 200)}" in ${String(p.categoryId ?? '').slice(0, 80)}`;
    case 'remove_sequence':
      return `caregiver removed ordering sequence "${String(p.sequenceName ?? '').slice(0, 200)}"`;
    case 'note_only':
      return '';  // not actionable — skip
    default:
      return '';
  }
}

/** Public API: record a caregiver-action gotcha. Best-effort, never throws.
 *  The AAC UX must NEVER block on corpus persistence. */
export async function recordCaregiverGotcha(
  action: NoteAction,
  ok: boolean,
  userLang?: string,
): Promise<boolean> {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return false;
  if (!ok) return false;  // failed actions don't tell us what the user wanted
  const gotcha = sanitizeString(distillGotcha(action), 500);
  if (!gotcha) return false;  // note_only and unknowns are not corpus-worthy

  const record: AacGotchaRecord = {
    id: crypto.randomUUID(),
    fingerprint: fingerprintFor(action),
    level: 'failed',
    summary: sanitizeString(action.description ?? action.type, 500),
    gotchas: [gotcha],
    session_date: Math.floor(Date.now() / 1000),
    metadata: {
      action_type: action.type,
      category_id: (action.payload as Record<string, unknown>)?.categoryId as string | undefined,
      user_lang: userLang,
    },
  };

  try {
    const db = await openDB();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);

      // Trim if over cap
      const countReq = store.count();
      countReq.onsuccess = () => {
        const count = countReq.result;
        if (count > MAX_RECORDS) {
          // Drop oldest. Walk session_date index, delete count - MAX_RECORDS + 100.
          const cursorReq = store.index('session_date').openCursor();
          let dropped = 0;
          const toDrop = count - MAX_RECORDS + 100;
          cursorReq.onsuccess = () => {
            const cur = cursorReq.result;
            if (cur && dropped < toDrop) {
              cur.delete();
              dropped += 1;
              cur.continue();
            }
          };
          cursorReq.onerror = () => { /* cursor failed — overflow not trimmed this cycle, acceptable */ };
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Read API — used by the gate (when wired). Returns most-recent N records
 *  matching a fingerprint. */
export async function findCorrectionsByFingerprint(
  fingerprint: string,
  limit = 50,
): Promise<AacGotchaRecord[]> {
  try {
    const db = await openDB();
    return await new Promise<AacGotchaRecord[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const idx = tx.objectStore(STORE_NAME).index('fingerprint');
      const range = IDBKeyRange.only(fingerprint);
      const req = idx.openCursor(range, 'prev');
      const out: AacGotchaRecord[] = [];
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur || out.length >= limit) {
          resolve(out);
          return;
        }
        out.push(cur.value as AacGotchaRecord);
        cur.continue();
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Diagnostic for the dashboard / settings page. */
export async function corpusHealth(): Promise<{
  available: boolean;
  total: number;
  byFingerprint?: Record<string, number>;
}> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => {
        resolve({ available: true, total: countReq.result });
      };
      countReq.onerror = () => resolve({ available: false, total: 0 });
    });
  } catch {
    return { available: false, total: 0 };
  }
}
