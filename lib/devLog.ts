/**
 * Dev-only logger for unexpected promise rejections that we
 * deliberately swallow at runtime (poller dispatches, etc).
 *
 * In production we drop the error silently — it's defensive code
 * guarding against future refactors that might introduce a throw,
 * not normal error flow. In dev/test, surfacing helps catch the
 * regression early.
 */

export function reportSwallowedError(scope: string): (e: unknown) => void {
  return (e: unknown) => {
    if (process.env.NODE_ENV === 'production') return;
    // eslint-disable-next-line no-console
    console.error(`[${scope}] swallowed unexpected error:`, e);
  };
}
