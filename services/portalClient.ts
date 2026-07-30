/**
 * Synalux portal client — single fetch wrapper for every AAC chat /
 * inbox / contacts request. Owns:
 *   - base URL composition (via lib/portalConfig.SYNALUX_API)
 *   - credentials inclusion (cookie-based session)
 *   - timeout (with AbortSignal.timeout fallback for old WebViews)
 *   - JSON parsing with safe error mapping
 *   - online-state short-circuit (skip the round trip if offline)
 *
 * Returns a discriminated union: callers must handle both `ok: true`
 * and `ok: false` paths — never throws. The error string is short and
 * safe to surface to a toast (no portal internals leak past the first
 * 80 chars of any returned body).
 */
import { SYNALUX_API, timeoutSignal, MAX_PORTAL_RESPONSE_BYTES } from '@/lib/portalConfig';
import { sanitizeString } from '@/lib/safeStrings';

export type PortalResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status?: number };

export interface PortalRequest {
  /** Path relative to SYNALUX_API base, e.g. '/telegram/send'. */
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  /** JSON-serializable body for POST. */
  body?: unknown;
  /** Hard deadline. Defaults to 8s — most AAC paths shouldn't exceed
   *  this even on flaky school wifi. */
  timeoutMs?: number;
  /** Optional caller cancellation for latest-only UI work. The portal timeout
   * remains active as an independent upper bound. */
  signal?: AbortSignal;
  /** Skip the request when navigator.onLine === false. Default true.
   *  Set false for endpoints that intentionally exercise the offline
   *  warmup path (Service Workers etc.). */
  skipIfOffline?: boolean;
}

const DEFAULT_TIMEOUT_MS = 8_000;

function combineSignals(
  timeout: AbortSignal,
  external?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  if (!external) return { signal: timeout, cleanup: () => {} };

  const controller = new AbortController();
  const forwardAbort = (source: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(source.reason);
    }
  };
  const onTimeout = () => forwardAbort(timeout);
  const onExternal = () => forwardAbort(external);

  if (timeout.aborted) onTimeout();
  else timeout.addEventListener('abort', onTimeout, { once: true });
  if (external.aborted) onExternal();
  else external.addEventListener('abort', onExternal, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      timeout.removeEventListener('abort', onTimeout);
      external.removeEventListener('abort', onExternal);
    },
  };
}

/** Reads a Response body as text but caps total bytes — defense against
 *  a server that omits Content-Length and streams a huge response.
 *  Returns the decoded string, '' on read error, or null when the body
 *  exceeded `maxBytes` (caller treats null as payload_too_large).
 *
 *  Falls back to res.text() when the runtime doesn't expose
 *  `Response.body.getReader()` — the cap is then enforced post-buffer
 *  via length-check, which still bounds memory at roughly 2× maxBytes
 *  but is the best we can do without streaming primitives. */
async function readCappedText(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body || typeof res.body.getReader !== 'function') {
    let txt = '';
    if (typeof res.text === 'function') {
      try { txt = await res.text(); } catch { return ''; }
    } else if (typeof (res as { json?: () => Promise<unknown> }).json === 'function') {
      // Last-resort fallback for Response polyfills / test mocks that
      // expose only `json()` — re-stringify so the caller's JSON.parse
      // path stays uniform.
      try {
        const parsed = await (res as { json: () => Promise<unknown> }).json();
        txt = JSON.stringify(parsed);
      } catch { return ''; }
    } else {
      return '';
    }
    return txt.length > maxBytes ? null : txt;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let out = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        try { await reader.cancel(); } catch { /* */ }
        return null;
      }
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode(); // flush any trailing partial code unit
  } catch {
    return out;
  }
  return out;
}

export async function portalFetch<T = unknown>(req: PortalRequest): Promise<PortalResult<T>> {
  if (req.skipIfOffline !== false && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'offline' };
  }
  // Serialize body up front so a JSON.stringify failure (circular ref,
  // BigInt) is reported as a normal error result instead of an
  // unhandled exception. Caller almost certainly built bad input.
  let serialized: string | undefined;
  if (req.body !== undefined) {
    try {
      serialized = JSON.stringify(req.body);
    } catch {
      return { ok: false, error: 'invalid_request_body' };
    }
  }
  const deadline = timeoutSignal(req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const combined = combineSignals(deadline.signal, req.signal);
  let res: Response;
  try {
    res = await fetch(`${SYNALUX_API}${req.path}`, {
      method: req.method ?? 'GET',
      credentials: 'include',
      headers: serialized !== undefined
        ? { 'Content-Type': 'application/json', Accept: 'application/json' }
        : { Accept: 'application/json' },
      ...(serialized !== undefined ? { body: serialized } : {}),
      signal: combined.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') return { ok: false, error: 'timeout' };
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, error: 'aborted' };
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 80) : 'network error' };
  } finally {
    combined.cleanup();
    deadline.cancel();
  }
  // Content-Length pre-check stops a hostile portal from even starting
  // to stream gigabytes. Most servers send it; if missing OR the
  // runtime doesn't expose `res.headers.get` (some test mocks, old
  // WebViews), the streaming reader below enforces the same cap
  // chunk-by-chunk so a malicious server that omits the header AND
  // streams a huge body still hits the 1 MB ceiling without OOM.
  const declaredLenRaw = typeof res.headers?.get === 'function'
    ? res.headers.get('content-length')
    : null;
  const declaredLen = Number(declaredLenRaw ?? '');
  if (Number.isFinite(declaredLen) && declaredLen > MAX_PORTAL_RESPONSE_BYTES) {
    return { ok: false, error: 'payload_too_large', status: res.status };
  }
  if (!res.ok) {
    const errText = await readCappedText(res, MAX_PORTAL_RESPONSE_BYTES);
    if (errText === null) {
      return { ok: false, error: `HTTP ${res.status}: payload_too_large`, status: res.status };
    }
    // Read at most 80 chars of body so a logging endpoint dumping a stack
    // trace doesn't end up in the AAC user's toast notification.
    const safe = sanitizeString(errText, 80);
    return { ok: false, error: `HTTP ${res.status}${safe ? ': ' + safe : ''}`, status: res.status };
  }
  // 204 No Content — return undefined as data
  if (res.status === 204) return { ok: true, data: undefined as T, status: 204 };
  const raw = await readCappedText(res, MAX_PORTAL_RESPONSE_BYTES);
  if (raw === null) return { ok: false, error: 'payload_too_large', status: res.status };
  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    return { ok: false, error: 'invalid_json', status: res.status };
  }
  return { ok: true, data, status: res.status };
}
