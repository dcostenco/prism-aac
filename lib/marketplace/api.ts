/**
 * Marketplace catalog client.
 *
 * Phase 3 wires this to the synalux portal endpoints under
 * `/api/v1/marketplace/*`. Always falls back to the bundled LOCAL_CATALOG
 * when the network call fails — the marketplace must work offline.
 *
 * Endpoints (defined in synalux-private/portal/src/app/api/v1/marketplace/):
 *   GET  /catalog                 — public, returns published modules
 *   GET  /module/[slug]           — public, returns full detail + screenshots
 *   POST /install                 — auth, body { slug }, tier-gated
 *   GET  /installed               — auth, returns user's active installs
 *   POST /uninstall               — auth, body { slug }, soft delete
 */
import { LOCAL_CATALOG } from './manifests/local';
import type { ModuleInstallRecord, ModuleManifest } from './types';
import { isValidManifest } from './types';

const SYNALUX_API =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API) ||
  'https://synalux.ai/api/v1';

const FETCH_TIMEOUT_MS = 5000;

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

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/**
 * Try the portal first. On any failure (network, 4xx/5xx, parse error),
 * silently fall back to the bundled local catalog. The marketplace must
 * always render — never blank out on transient outages.
 */
export async function fetchCatalog(): Promise<CatalogFetchResult> {
  try {
    const res = await fetchWithTimeout(`${SYNALUX_API}/marketplace/catalog`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body?.modules)) throw new Error('malformed response');
    const modules = filterValid(body.modules);
    if (modules.length === 0) throw new Error('empty catalog');
    return {
      modules,
      source: 'remote',
      fetchedAt: typeof body.fetched_at === 'number' ? body.fetched_at : Date.now(),
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[marketplace] catalog fetch fell back to local:', (e as Error).message);
    return {
      modules: filterValid(LOCAL_CATALOG),
      source: 'local',
      fetchedAt: Date.now(),
    };
  }
}

/**
 * Pull the user's server-side install records. Returns an empty array on
 * any failure (signed-out, offline, server error) — the caller treats the
 * server as additive over local state.
 */
export async function fetchInstalled(): Promise<ModuleInstallRecord[]> {
  try {
    const res = await fetchWithTimeout(`${SYNALUX_API}/marketplace/installed`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return [];
    const body = await res.json();
    if (!Array.isArray(body?.installs)) return [];
    return body.installs.filter((r: unknown): r is ModuleInstallRecord => {
      if (!r || typeof r !== 'object') return false;
      const x = r as Record<string, unknown>;
      return typeof x.slug === 'string' && typeof x.version === 'string';
    });
  } catch {
    return [];
  }
}

/**
 * Mirror an install to the portal. Best-effort — never throws. The local
 * install in settings.installedApps is the immediate user-facing source of
 * truth; this call brings the server in sync so the install roams to other
 * devices via Hivemind.
 */
export async function installRemote(slug: string): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetchWithTimeout(`${SYNALUX_API}/marketplace/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

export async function uninstallRemote(slug: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetchWithTimeout(`${SYNALUX_API}/marketplace/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
