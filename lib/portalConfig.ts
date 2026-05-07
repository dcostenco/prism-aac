/**
 * Shared Synalux portal configuration.
 *
 * One module owns the base URL + AbortSignal.timeout availability so
 * callers don't each grow their own copy of the env-var read +
 * polyfill check. Deduplicated 5 places that previously each had:
 *   const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API ?? '...';
 * along with their own raw fetch + timeout boilerplate.
 */

export const SYNALUX_API: string =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API)
    ? process.env.NEXT_PUBLIC_SYNALUX_API
    : 'https://synalux.ai/api/v1';

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
