/**
 * Marketplace catalog client.
 *
 * Phase 1: returns the bundled LOCAL_CATALOG. The async signature is the
 * contract Phase 3 will preserve when it switches to fetching the remote
 * catalog from synalux.ai/api/v1/marketplace/catalog.
 *
 * Why async even when we just return a constant:
 *   - Lets MarketplacePanel render a loading state today; same code path
 *     handles real network latency tomorrow.
 *   - Validation runs through the same isValidManifest gate that the
 *     server response will run through.
 *   - Lets us layer caching (ETag, stale-while-revalidate) without UI
 *     changes when the remote catalog ships.
 */
import { LOCAL_CATALOG } from './manifests/local';
import type { ModuleManifest } from './types';
import { isValidManifest } from './types';

export interface CatalogFetchResult {
  modules: ModuleManifest[];
  /** 'local' until Phase 3, then 'remote' | 'cache'. */
  source: 'local' | 'remote' | 'cache';
  /** ms since epoch — for ttl decisions. */
  fetchedAt: number;
}

/**
 * Drop manifests that fail schema validation. Logs the reason so a malformed
 * server response or accidentally-broken local entry surfaces in the console
 * instead of silently disappearing from the marketplace.
 */
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

export async function fetchCatalog(): Promise<CatalogFetchResult> {
  return {
    modules: filterValid(LOCAL_CATALOG),
    source: 'local',
    fetchedAt: Date.now(),
  };
}
