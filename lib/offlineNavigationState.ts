import { AAC_CORE_NAVIGATION_CACHE, AAC_LEGACY_CORE_NAVIGATION_CACHES, AAC_OFFLINE_NAVIGATION_LOCK, documentAssets } from './offlinePrecacheRetention';

export { AAC_OFFLINE_NAVIGATION_LOCK } from './offlinePrecacheRetention';
const NAVIGATION_TIMEOUT_MS = 3_000;
const CSP_NONCE = /'nonce-([^']+)'/g;
const SCRIPT_NONCE = /<script\b[^>]*\bnonce=(?:"([^"]*)"|'([^']*)')/gi;

/** Detach bytes from the network/cache backing resource while retaining CSP. */
function snapshotDocument(response: Response, html: string): Response | null {
  const allowed = new Set(Array.from((response.headers.get('content-security-policy') ?? '').matchAll(CSP_NONCE), match => match[1]));
  if (allowed.size) {
    const nonces = Array.from(html.matchAll(SCRIPT_NONCE), match => match[1] ?? match[2]);
    if (!nonces.length || nonces.some(nonce => !allowed.has(nonce))) return null;
  }
  const headers = new Headers(response.headers);
  // Fetch has already decoded the body. Its old transport lengths/encoding
  // must not describe the newly constructed UTF-8 representation.
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export type OfflineNavigationLocks = Pick<LockManager, 'request'>;

export interface CanonicalNavigationResult {
  response: Response;
  stored: boolean;
}

export interface CanonicalNavigationState {
  outcome: 'saved' | 'network-unavailable' | 'not-html' | 'nonce-mismatch' | 'incomplete-static' | 'storage-failed';
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
        if (response) {
          const snapshot = snapshotDocument(response, await response.text());
          if (snapshot) return snapshot;
        }
      }
      return undefined;
    }
    catch { return undefined; }
  };
  const fallback = async () => (await savedDocument()) ?? Response.error();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const network = Promise.resolve().then(() => fetchResponse(request)).then(async response => {
    if (timedOut) {
      void response.body?.cancel().catch(() => console.warn('[service-worker] abandoned navigation body cancellation failed'));
      return { kind: 'failure' as const };
    }
    let html = '';
    if (response.status === 200 && response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
      const reader = response.body?.getReader();
      bodyReader = reader;
      const decoder = new TextDecoder();
      try {
        while (reader) {
          const chunk = await reader.read();
          if (chunk.done) break;
          html += decoder.decode(chunk.value, { stream: true });
        }
        html += decoder.decode();
      } finally {
        reader?.releaseLock();
        bodyReader = undefined;
      }
    }
    return { kind: 'response' as const, response, html };
  }).catch(() => ({ kind: 'failure' as const }));
  const timed = new Promise<{ kind: 'timeout' }>(resolve => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve({ kind: 'timeout' });
      // Cancel the original reader, rather than a tee created by clone(), so
      // an unfinished body cannot outlive the fallback and retain resources.
      void bodyReader?.cancel().catch(() => console.warn('[service-worker] stalled navigation body cancellation failed'));
    }, timeoutMs);
  });
  const result = await Promise.race([network, timed]);
  if (timer) clearTimeout(timer);
  if (result.kind !== 'response') {
    report({ outcome: 'network-unavailable' });
    return { response: await fallback(), stored: false };
  }
  let response = result.response;
  if (response.status >= 500) {
    report({ outcome: 'network-unavailable' });
    return { response: await fallback(), stored: false };
  }
  if (response.status !== 200 || !response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    report({ outcome: 'not-html' });
    return { response, stored: false };
  }

  const html = result.html;
  const snapshot = snapshotDocument(response, html);
  if (!snapshot) {
    report({ outcome: 'nonce-mismatch' });
    return { response: await fallback(), stored: false };
  }
  response = snapshot;
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
