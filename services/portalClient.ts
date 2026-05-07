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
import { SYNALUX_API, timeoutSignal } from '@/lib/portalConfig';

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
  /** Skip the request when navigator.onLine === false. Default true.
   *  Set false for endpoints that intentionally exercise the offline
   *  warmup path (Service Workers etc.). */
  skipIfOffline?: boolean;
}

const DEFAULT_TIMEOUT_MS = 8_000;

export async function portalFetch<T = unknown>(req: PortalRequest): Promise<PortalResult<T>> {
  if (req.skipIfOffline !== false && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'offline' };
  }
  const { signal, cancel } = timeoutSignal(req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${SYNALUX_API}${req.path}`, {
      method: req.method ?? 'GET',
      credentials: 'include',
      headers: req.body !== undefined
        ? { 'Content-Type': 'application/json', Accept: 'application/json' }
        : { Accept: 'application/json' },
      ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
      signal,
    });
  } catch (e) {
    cancel();
    if (e instanceof DOMException && e.name === 'TimeoutError') return { ok: false, error: 'timeout' };
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, error: 'aborted' };
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 80) : 'network error' };
  } finally {
    cancel();
  }
  if (!res.ok) {
    // Read at most 200 chars of body so a logging endpoint dumping a stack
    // trace doesn't end up in the AAC user's toast notification.
    const errText = await res.text().catch(() => '');
    const safe = errText.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 80);
    return { ok: false, error: `HTTP ${res.status}${safe ? ': ' + safe : ''}`, status: res.status };
  }
  // 204 No Content — return undefined as data
  if (res.status === 204) return { ok: true, data: undefined as T, status: 204 };
  let data: T;
  try {
    data = await res.json() as T;
  } catch {
    return { ok: false, error: 'invalid_json', status: res.status };
  }
  return { ok: true, data, status: res.status };
}
