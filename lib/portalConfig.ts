/**
 * Shared Synalux portal configuration.
 *
 * One module owns the base URL + AbortSignal.timeout availability so
 * callers don't each grow their own copy of the env-var read +
 * polyfill check. Deduplicated 5 places that previously each had:
 *   const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API ?? '...';
 * along with their own raw fetch + timeout boilerplate.
 */

const PRODUCTION_PORTAL_ORIGIN = 'https://synalux.ai';
const DEFAULT_BASE_PATH = '/prism-aac';
const VERCEL_HOST_SUFFIX = '.vercel.app';

/**
 * Standalone deployments cannot safely receive the portal's credentialed
 * CORS responses because each Vercel preview has a different origin. Route
 * those browsers through this app's existing server-side API rewrite instead.
 * The canonical synalux.ai host stays direct and same-origin.
 */
export function resolveSynaluxApi(
  configuredBase?: string,
  runtimeOrigin?: string,
  runtimeHostname?: string,
  basePath = DEFAULT_BASE_PATH,
): string {
  if (!runtimeOrigin || !runtimeHostname) return `${PRODUCTION_PORTAL_ORIGIN}/api/v1`;
  if (runtimeHostname.endsWith(VERCEL_HOST_SUFFIX)) {
    const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return `${runtimeOrigin}${normalizedBasePath.replace(/\/$/, '')}/api/v1`;
  }
  if (configuredBase) return configuredBase;
  if (runtimeHostname === 'synalux.ai' || runtimeHostname === 'www.synalux.ai') {
    return `${PRODUCTION_PORTAL_ORIGIN}/api/v1`;
  }
  const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return `${runtimeOrigin}${normalizedBasePath.replace(/\/$/, '')}/api/v1`;
}

const runtimeLocation = typeof window !== 'undefined' ? window.location : undefined;
const configuredApiBase =
  typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SYNALUX_API : undefined;
export const SYNALUX_API: string = resolveSynaluxApi(
  configuredApiBase,
  runtimeLocation?.origin,
  runtimeLocation?.hostname,
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BASE_PATH
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : DEFAULT_BASE_PATH,
);
export const SYNALUX_PORTAL_ORIGIN: string = (() => {
  if (!configuredApiBase) return PRODUCTION_PORTAL_ORIGIN;
  try {
    return new URL(configuredApiBase).origin;
  } catch {
    return PRODUCTION_PORTAL_ORIGIN;
  }
})();

/** Hard cap on any single portal response body. A hostile or buggy
 *  portal returning a 100 MB JSON would otherwise OOM the AAC client.
 *  1 MB fits every legitimate AAC payload (50 inbox messages or 500
 *  contact rows) with 4-5× headroom. Tunable here so other portal
 *  consumers can pick this up via `import { MAX_PORTAL_RESPONSE_BYTES }`. */
export const MAX_PORTAL_RESPONSE_BYTES = 1_048_576;

/** True when the runtime supports AbortSignal.timeout (Safari 16+,
 *  Chrome 103+, Firefox 100+). All current browsers we ship to qualify,
 *  but old WKWebViews on aging tablets do not — fall back to a manually-
 *  controlled AbortController in that case. */
export const HAS_ABORT_SIGNAL_TIMEOUT: boolean =
  typeof AbortSignal !== 'undefined' &&
  typeof (AbortSignal as { timeout?: unknown }).timeout === 'function';

/** Returns an AbortSignal that fires after `ms` and a `cancel()` to
 *  release the underlying timer (for promise-resolved-first paths).
 *  Works even on runtimes missing AbortSignal.timeout. */
export function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  if (HAS_ABORT_SIGNAL_TIMEOUT) {
    // Native signal — no manual timer to clear; GC handles it.
    return { signal: (AbortSignal as { timeout: (n: number) => AbortSignal }).timeout(ms), cancel: () => {} };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) };
}
