'use client';
/**
 * Math Document Service — Phase 5B (local-first) + Phase 5D (portal sync).
 *
 * Local: localStorage["prism-aac-math-docs"] → MathDoc[].
 * Remote: portal endpoints under /prism-aac/math-doc:
 *   GET  /prism-aac/math-doc           list (signed-in user's docs)
 *   POST /prism-aac/math-doc/{slug}    upsert (server tracks updatedAt)
 *   DELETE /prism-aac/math-doc/{slug}  remove
 *
 * Sync semantics:
 *   • Save flow: write local → fire-and-forget upsert to portal.
 *     If portal returns 401 / 404 / network error, local stays the
 *     source of truth.
 *   • Pull flow: pullFromPortal() merges every remote doc whose
 *     updatedAt is newer than the local copy with same slug. Local
 *     docs the portal doesn't know about are kept (will be pushed
 *     on next save). Portal-only docs are added locally.
 *   • Delete: local then portal best-effort.
 *
 * Caps:
 *   MAX_DOCS         100 local (oldest evicted by updatedAt on overflow)
 *   MAX_BODY_BYTES   200 KB per doc
 */
import {
  type SerializedMathGrid,
} from '@/engine/mathGrid';
import { portalFetch } from '@/services/portalClient';
import { reportSwallowedError } from '@/lib/devLog';

const reportSyncError = reportSwallowedError('mathDocService.portalSync');

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
  // Fire-and-forget portal sync. We deliberately don't await — the
  // local write is the source of truth, the portal is opportunistic.
  void pushToPortal(saved).catch(reportSyncError);
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
  void deleteFromPortal(slug).catch(reportSyncError);
  return true;
}

/** Clear ALL math docs. Caller should confirm with the user — this
 *  is destructive. */
export function clearAllDocs(): void {
  writeAll([]);
}

/* ------------------------------------------------------------------ */
/* Phase 5D — portal sync                                              */
/* ------------------------------------------------------------------ */

interface PortalDocPayload {
  slug: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  body: SerializedMathGrid;
}

interface PortalListResponse {
  docs?: PortalDocPayload[];
}

/** Best-effort upsert to the portal. Never throws — returns false on
 *  any non-2xx. Caller should treat the local store as the source of
 *  truth and call this fire-and-forget. */
export async function pushToPortal(doc: MathDoc): Promise<boolean> {
  const res = await portalFetch<unknown>({
    path: `/prism-aac/math-doc/${encodeURIComponent(doc.slug)}`,
    method: 'POST',
    body: {
      slug: doc.slug,
      name: doc.name,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      body: doc.body,
    } satisfies PortalDocPayload,
  });
  return res.ok;
}

/** Fetches every doc the signed-in user owns from the portal and
 *  merges into local store. Merge rules:
 *   • portal doc with newer updatedAt → overwrites local
 *   • local doc the portal doesn't know about → kept (will push on
 *     next save)
 *   • portal-only doc → added locally
 *  Returns the merged list (already written to localStorage), or
 *  null if the portal is unreachable / not signed in. */
export async function pullFromPortal(): Promise<MathDoc[] | null> {
  const res = await portalFetch<PortalListResponse | PortalDocPayload[]>({
    path: '/prism-aac/math-doc',
    method: 'GET',
  });
  if (!res.ok) return null;
  const remote: PortalDocPayload[] = Array.isArray(res.data)
    ? res.data
    : res.data?.docs ?? [];
  const local = readAll();
  const localBySlug = new Map(local.map((d) => [d.slug, d]));
  for (const r of remote) {
    if (!isPortalDoc(r)) continue;
    const existing = localBySlug.get(r.slug);
    if (!existing || r.updatedAt > existing.updatedAt) {
      localBySlug.set(r.slug, {
        slug: r.slug,
        name: r.name,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        body: r.body,
      });
    }
  }
  const merged = Array.from(localBySlug.values());
  if (merged.length > MAX_DOCS) {
    merged.sort((a, b) => b.updatedAt - a.updatedAt);
    merged.length = MAX_DOCS;
  }
  writeAll(merged);
  return merged.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Best-effort delete on the portal. Never throws. */
export async function deleteFromPortal(slug: string): Promise<boolean> {
  const res = await portalFetch<unknown>({
    path: `/prism-aac/math-doc/${encodeURIComponent(slug)}`,
    method: 'DELETE',
  });
  return res.ok;
}

function isPortalDoc(x: unknown): x is PortalDocPayload {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.slug === 'string'
    && typeof o.name === 'string'
    && typeof o.createdAt === 'number'
    && typeof o.updatedAt === 'number'
    && !!o.body && typeof o.body === 'object';
}
