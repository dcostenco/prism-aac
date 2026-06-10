/**
 * Shared Ollama availability probe for E2E tests.
 *
 * Uses real Ollama if available, falls back to mock response.
 *
 * Call `probeOllama()` once in a `test.beforeAll` to cache the result,
 * then use `ollamaAvailable` in individual tests to decide whether to
 * install a page.route() mock or let the request hit the real service.
 */

let _cached: boolean | null = null;

export async function probeOllama(): Promise<boolean> {
  if (_cached !== null) return _cached;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    _cached = res.ok;
  } catch {
    _cached = false;
  }
  return _cached;
}

/** Reset the cache — only useful in unit tests of this helper. */
export function resetProbe(): void {
  _cached = null;
}
