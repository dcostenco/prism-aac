/**
 * Marketplace catalog client.
 *
 * Phase 3 wires this to the synalux portal endpoints under
 * `/api/v1/marketplace/*`. Always falls back to the bundled LOCAL_CATALOG
 * when the network call fails — the marketplace must work offline.
 *
 * Endpoints (defined in synalux-platform/portal/src/app/api/v1/marketplace/):
 *   GET  /catalog                 — public, returns published modules
 *   GET  /module/[slug]           — public, returns full detail + screenshots
 *   POST /install                 — auth, body { slug }, tier-gated
 *   GET  /installed               — auth, returns user's active installs
 *   POST /uninstall               — auth, body { slug }, soft delete
 */
import { LOCAL_CATALOG } from './manifests/local';
import type { ModuleInstallRecord, ModuleManifest } from './types';
import { isValidManifest } from './types';
import { portalFetch } from '@/services/portalClient';

const FETCH_TIMEOUT_MS = 5000;
/** Hard ceiling on the modules array we'll iterate before slicing. A
 *  malicious portal pushing 1 MB of valid-looking manifests would
 *  otherwise consume O(n) cycles in filterValid + downstream filters
 *  on every catalog re-render. portalFetch already enforces a 1 MB
 *  body cap; this complements it at the array level. */
const MAX_REMOTE_MODULES = 1000;
const MAX_REMOTE_INSTALLS = 1000;
const MAX_SLUG_LEN = 80;
const MAX_VERSION_LEN = 32;

export interface CatalogFetchResult {
  modules: ModuleManifest[];
  source: 'local' | 'remote' | 'cache';
  fetchedAt: number;
}

/** Drop manifests that fail schema validation; warn so issues surface. */
function filterValid(rows: unknown[]): ModuleManifest[] {
  const kept: ModuleManifest[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isValidManifest(row)) {
      kept.push(row);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[marketplace] dropping invalid manifest at index ${i}`, row);
    }
  }
  return kept;
}

/**
 * Try the portal first. On any failure (network, 4xx/5xx, parse error,
 * payload too large), silently fall back to the bundled local catalog.
 * The marketplace must always render — never blank out on transient
 * outages. portalFetch handles timeout, response-size cap, offline
 * short-circuit, and JSON parsing.
 */
export async function fetchCatalog(): Promise<CatalogFetchResult> {
  const result = await portalFetch<{ modules?: unknown; fetched_at?: number }>({
    path: '/marketplace/catalog',
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn('[marketplace] catalog fetch fell back to local:', result.error);
    return {
      modules: filterValid(LOCAL_CATALOG),
      source: 'local',
      fetchedAt: Date.now(),
    };
  }
  const body = result.data;
  if (!Array.isArray(body?.modules)) {
    return { modules: filterValid(LOCAL_CATALOG), source: 'local', fetchedAt: Date.now() };
  }
  // Cap before validating — a portal pushing tens of thousands of
  // manifests must not bloat the cache or stall filterValid.
  const capped = body.modules.slice(0, MAX_REMOTE_MODULES);
  const modules = filterValid(capped);
  if (modules.length === 0) {
    return { modules: filterValid(LOCAL_CATALOG), source: 'local', fetchedAt: Date.now() };
  }
  const fetchedAt = typeof body.fetched_at === 'number' && Number.isFinite(body.fetched_at)
    ? body.fetched_at
    : Date.now();
  return { modules, source: 'remote', fetchedAt };
}

/**
 * Pull the user's server-side install records. Returns an empty array on
 * any failure (signed-out, offline, server error) — the caller treats the
 * server as additive over local state.
 */
export async function fetchInstalled(): Promise<ModuleInstallRecord[]> {
  const result = await portalFetch<{ installs?: unknown }>({
    path: '/marketplace/installed',
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (!result.ok) return [];
  const installs = result.data?.installs;
  if (!Array.isArray(installs)) return [];
  return installs
    .slice(0, MAX_REMOTE_INSTALLS)
    .filter((r: unknown): r is ModuleInstallRecord => {
      if (!r || typeof r !== 'object') return false;
      const x = r as Record<string, unknown>;
      return typeof x.slug === 'string' && !!x.slug && x.slug.length <= MAX_SLUG_LEN
        && typeof x.version === 'string' && !!x.version && x.version.length <= MAX_VERSION_LEN;
    });
}

/** Defensive slug shape for install/uninstall mirror calls. The local
 *  caller controls these but a future caregiver-note action might pass
 *  through user-derived input. */
function safeSlug(slug: string): string | null {
  if (typeof slug !== 'string') return null;
  const trimmed = slug.trim();
  if (!trimmed || trimmed.length > MAX_SLUG_LEN) return null;
  return trimmed;
}

/**
 * Mirror an install to the portal. Best-effort — never throws. The local
 * install in settings.installedApps is the immediate user-facing source of
 * truth; this call brings the server in sync so the install roams to other
 * devices via Hivemind.
 */
export async function installRemote(slug: string): Promise<{ ok: boolean; status?: number }> {
  const cleanSlug = safeSlug(slug);
  if (!cleanSlug) return { ok: false };
  const result = await portalFetch({
    path: '/marketplace/install',
    method: 'POST',
    body: { slug: cleanSlug },
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  return { ok: result.ok, status: result.status };
}

export async function uninstallRemote(slug: string): Promise<{ ok: boolean }> {
  const cleanSlug = safeSlug(slug);
  if (!cleanSlug) return { ok: false };
  const result = await portalFetch({
    path: '/marketplace/uninstall',
    method: 'POST',
    body: { slug: cleanSlug },
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  return { ok: result.ok };
}
