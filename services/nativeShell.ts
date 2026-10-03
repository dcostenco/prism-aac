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
