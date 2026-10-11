import { AAC_CORE_NAVIGATION_CACHE, AAC_LEGACY_CORE_NAVIGATION_CACHES, AAC_OFFLINE_NAVIGATION_LOCK, documentAssets } from './offlinePrecacheRetention';

export { AAC_OFFLINE_NAVIGATION_LOCK } from './offlinePrecacheRetention';
const NAVIGATION_TIMEOUT_MS = 3_000;

export type OfflineNavigationLocks = Pick<LockManager, 'request'>;

export interface CanonicalNavigationResult {
  response: Response;
  stored: boolean;
}

export interface CanonicalNavigationState {
  outcome: 'saved' | 'network-unavailable' | 'not-html' | 'incomplete-static' | 'storage-failed';
  precacheName: string;
  requiredCount?: number;
  missingAssets?: string[];
  errorName?: string;
}

export async function handleCanonicalNavigation(options: {
  request: Request;
  canonicalUrl: string;
  precacheName: string;
  precacheAssets?: string[];
  storage: CacheStorage;
  locks?: OfflineNavigationLocks | null;
  fetchResponse: (request: Request) => Promise<Response>;
  timeoutMs?: number;
  reportState?: (state: CanonicalNavigationState) => void;
}): Promise<CanonicalNavigationResult> {
  const { request, canonicalUrl, precacheName, precacheAssets = [], storage, locks, fetchResponse } = options;
  const timeoutMs = options.timeoutMs ?? NAVIGATION_TIMEOUT_MS;
  const report = (state: Omit<CanonicalNavigationState, 'precacheName'>) => {
    try { options.reportState?.({ ...state, precacheName }); }
    catch { console.warn('[service-worker] navigation state report unavailable'); }
  };
  const savedDocument = async () => {
    try {
      for (const cacheName of [AAC_CORE_NAVIGATION_CACHE, ...AAC_LEGACY_CORE_NAVIGATION_CACHES]) {
        const response = await storage.match(canonicalUrl, { cacheName });
        if (response) return response;
      }
      return undefined;
    }
    catch { return undefined; }
  };
  const fallback = async () => (await savedDocument()) ?? Response.error();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const network = Promise.resolve().then(() => fetchResponse(request)).then(
    response => ({ kind: 'response' as const, response }),
    () => ({ kind: 'failure' as const }),
  );
  const timed = new Promise<{ kind: 'timeout' }>(resolve => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
  });
  const result = await Promise.race([network, timed]);
  if (timer) clearTimeout(timer);
  if (result.kind !== 'response') {
    report({ outcome: 'network-unavailable' });
    return { response: await fallback(), stored: false };
  }
  const response = result.response;
  if (response.status >= 500) {
    report({ outcome: 'network-unavailable' });
    return { response: await fallback(), stored: false };
  }
  if (response.status !== 200 || !response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    report({ outcome: 'not-html' });
    return { response, stored: false };
  }

  const html = await response.clone().text();
  const assets = [...new Set([...documentAssets(html, canonicalUrl), ...precacheAssets])];
  const safeLockManager = locks && typeof locks.request === 'function' ? locks : null;

  try {
    const storeCompleteDocument = async () => {
      const matches = await Promise.all(assets.map(asset =>
        storage.match(asset, { cacheName: precacheName, ignoreSearch: true, ignoreVary: true }),
      ));
      const complete = assets.length > 0 && matches.every(Boolean);
      if (!complete) {
        report({ outcome: 'incomplete-static', requiredCount: assets.length,
          missingAssets: assets.filter((_, index) => !matches[index]).slice(0, 8).map(asset => new URL(asset).pathname) });
        const previous = await savedDocument();
        return { stored: false, previous };
      }
      await (await storage.open(AAC_CORE_NAVIGATION_CACHE)).put(canonicalUrl, response.clone());
      return { stored: true };
    };
    // Without cross-worker locks retirement is disabled, so all complete
    // asset graphs remain available whichever valid document is saved last.
    const stored = safeLockManager
      ? await safeLockManager.request(AAC_OFFLINE_NAVIGATION_LOCK, { mode: 'exclusive' }, storeCompleteDocument)
      : await storeCompleteDocument();
    if (stored.stored) {
      report({ outcome: 'saved', requiredCount: assets.length });
      return { response, stored: true };
    }
    return { response: stored.previous ?? response, stored: false };
  } catch (error) {
    report({ outcome: 'storage-failed', requiredCount: assets.length,
      errorName: error && typeof error === 'object' && 'name' in error ? String(error.name).slice(0, 40) : 'Error' });
    return { response: (await savedDocument()) ?? response, stored: false };
  }
}
