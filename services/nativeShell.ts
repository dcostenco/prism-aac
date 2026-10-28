/**
 * True when one of the Prism iOS shells hosts this page (Prism AAC, Prism AAC
 * Browser). Each injects window.prismNativeBridge at document start, before any
 * page script runs, so the answer is fixed for the life of the page.
 *
 * The shells expose different capabilities: only Prism AAC offers Sign in with
 * Apple and purchases, only the Browser navigates. Code that needs a capability
 * must test that method itself; this answers only "is a native shell hosting
 * this page?". Like any client-side check it is a UI distinction, never an
 * entitlement.
 */
export function isPrismNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = (window as { prismNativeBridge?: unknown }).prismNativeBridge;
  return typeof bridge === 'object' && bridge !== null;
}

/** True inside the Prism AAC Browser app: the only shell whose bridge navigates. */
export function isPrismBrowserShell(): boolean {
  if (!isPrismNativeShell()) return false;
  const bridge = (window as { prismNativeBridge?: { navigateTo?: unknown } }).prismNativeBridge;
  return typeof bridge?.navigateTo === 'function';
}

/** Tells the app's bundled offline page what it may show: whether the
 *  paid-only policy has been seen in force, and until when this device's
 *  offline lease is valid (ms since 1970). Builds without the capability
 *  ignore it, and their offline page stays as it was. */
export function reportOfflineAccess(state: { policySeen: boolean; leaseUntil: number | null }): void {
  if (typeof window === 'undefined') return;
  const bridge = (window as { prismNativeBridge?: { offlineAccess?: (value: unknown) => void } }).prismNativeBridge;
  if (typeof bridge?.offlineAccess === 'function') bridge.offlineAccess(state);
}
