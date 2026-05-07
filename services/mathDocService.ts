'use client';
/**
 * Math Document Service — Phase 5B (local-first).
 *
 * Persists math grid documents to localStorage so the user's work
 * survives across sessions. Each doc is keyed by a slug + a name.
 * The store schema is intentionally compatible with a future portal
 * sync endpoint (Phase 5C) — when that lands, the same JSON shape
 * round-trips through `${SYNALUX_API}/prism-aac/math-doc/{slug}`.
 *
 * Storage layout:
 *   localStorage["prism-aac-math-docs"] → JSON array of MathDoc
 *
 * Cap on saved docs: 100 (sane upper bound for an AAC user's
 * cumulative homework). Hitting the cap rotates out the oldest
 * doc by `updatedAt`.
 */
import {
  type SerializedMathGrid,
} from '@/engine/mathGrid';

export interface MathDoc {
  /** Slug — generated from name + timestamp; URL-safe + deterministic. */
  slug: string;
  /** User-facing display name. */
  name: string;
  /** ms since epoch. */
  createdAt: number;
  updatedAt: number;
  body: SerializedMathGrid;
}

const STORAGE_KEY = 'prism-aac-math-docs';
const MAX_DOCS = 100;
/** Per-doc body cap — paranoia against a runaway grid that fills up
 *  cells beyond reason. 200 KB is plenty for any sane math doc. */
const MAX_BODY_BYTES = 200 * 1024;

function readAll(): MathDoc[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMathDoc);
  } catch {
    return [];
  }
}

function writeAll(docs: MathDoc[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch {
    // Quota errors etc. — silently swallow; the user's CURRENT doc is
    // still in the live store, just not persisted.
  }
}

function isMathDoc(x: unknown): x is MathDoc {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.slug === 'string'
    && typeof o.name === 'string'
    && typeof o.createdAt === 'number'
    && typeof o.updatedAt === 'number'
    && !!o.body && typeof o.body === 'object';
}

/** Generate a stable URL-safe slug from a name + timestamp. Two docs
 *  saved with the same name in the same minute will collide unless we
 *  include enough timestamp granularity. ms is plenty. */
export function makeSlug(name: string, at = Date.now()): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled';
  return `${base}-${at}`;
}

/** Save a doc. Returns the saved MathDoc (with slug + timestamps).
 *  If a doc with the same slug already exists, it's UPDATED (and
 *  updatedAt bumped). Otherwise a new doc is created. Caps the
 *  total number of docs at MAX_DOCS by evicting the oldest by
 *  updatedAt. */
export function saveDoc(name: string, body: SerializedMathGrid, slug?: string): MathDoc | null {
  if (typeof window === 'undefined') return null;
  // Body size check.
  let serialized: string;
  try {
    serialized = JSON.stringify(body);
  } catch {
    return null;
  }
  if (serialized.length > MAX_BODY_BYTES) return null;

  const now = Date.now();
  const docs = readAll();
  const existingIdx = slug ? docs.findIndex((d) => d.slug === slug) : -1;
  let saved: MathDoc;
  if (existingIdx >= 0) {
    saved = {
      ...docs[existingIdx],
      name: name || docs[existingIdx].name,
      updatedAt: now,
      body,
    };
    docs[existingIdx] = saved;
  } else {
    saved = {
      slug: slug || makeSlug(name, now),
      name: name || 'Untitled',
      createdAt: now,
      updatedAt: now,
      body,
    };
    docs.push(saved);
  }

  // Eviction policy: keep newest MAX_DOCS by updatedAt.
  if (docs.length > MAX_DOCS) {
    docs.sort((a, b) => b.updatedAt - a.updatedAt);
    docs.length = MAX_DOCS;
  }
  writeAll(docs);
  return saved;
}

/** Load a doc by slug. Returns null if not found. */
export function loadDoc(slug: string): MathDoc | null {
  return readAll().find((d) => d.slug === slug) ?? null;
}

/** List all saved docs sorted by updatedAt (newest first). Light-weight —
 *  body is included but consumers should avoid rendering body in lists. */
export function listDocs(): MathDoc[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Delete a doc by slug. Returns true if removed. */
export function deleteDoc(slug: string): boolean {
  const docs = readAll();
  const before = docs.length;
  const next = docs.filter((d) => d.slug !== slug);
  if (next.length === before) return false;
  writeAll(next);
  return true;
}

/** Clear ALL math docs. Caller should confirm with the user — this
 *  is destructive. */
export function clearAllDocs(): void {
  writeAll([]);
}
