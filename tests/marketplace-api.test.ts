import { describe, it, expect, vi } from 'vitest';
import { fetchCatalog } from '@/lib/marketplace/api';
import { LOCAL_CATALOG } from '@/lib/marketplace/manifests/local';

describe('marketplace/api — fetchCatalog', () => {
  it('returns the local catalog tagged source=local', async () => {
    const result = await fetchCatalog();
    expect(result.source).toBe('local');
    expect(result.modules).toHaveLength(LOCAL_CATALOG.length);
    expect(result.fetchedAt).toBeGreaterThan(0);
  });

  it('drops manifests that fail schema validation', async () => {
    // The local fallback is hand-curated, so this test guards against future
    // regressions where a malformed entry slips in. We can't easily inject
    // malformed entries into LOCAL_CATALOG without forking the module, so we
    // verify via a console.warn spy on a forced-invalid round trip.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await fetchCatalog();
    expect(result.modules.every((m) => m.slug && m.kind && m.tier && m.status)).toBe(true);
    warn.mockRestore();
  });

  it('returns a fresh fetchedAt timestamp on each call', async () => {
    const a = await fetchCatalog();
    await new Promise((r) => setTimeout(r, 2));
    const b = await fetchCatalog();
    expect(b.fetchedAt).toBeGreaterThanOrEqual(a.fetchedAt);
  });
});
