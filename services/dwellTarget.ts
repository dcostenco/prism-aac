// Camera selection resolves eligible controls, never bare label forwarding.
const DWELL_TARGET_SELECTOR = 'button, a, summary, input:not([type="hidden"]), select, textarea, ' +
  '[role="button"], [role="switch"], [role="checkbox"], [role="radio"], [data-dwell-target], .aac-btn';
export function resolveDwellTarget(element: Element | null): Element | null {
  const target = element?.closest(DWELL_TARGET_SELECTOR) ?? null;
  if (!target?.isConnected || target.matches(':disabled') ||
      target.closest('[inert], [hidden], [aria-hidden="true"], [aria-disabled="true"]')) return null;
  for (let node: Element | null = target; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return null;
  }
  return target;
}
