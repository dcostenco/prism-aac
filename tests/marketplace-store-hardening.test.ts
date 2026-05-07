/**
 * marketplaceStore — hydration validator. Catalog cache + install records
 * are read from localStorage on every page load and consumed by handler
 * dispatch and the update-badge calculation. Tampered cache could inject
 * a manifest with a hostile kind/tier or break compareVersions, so the
 * merge step must drop malformed rows, cap counts, and force enum types.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketplaceStore } from '@/store/marketplaceStore';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
  useMarketplaceStore.setState({
    catalog: [],
    fetchedAt: 0,
    source: 'unknown',
    loading: false,
    error: null,
    selectedSlug: null,
    installs: {},
  });
});

function seedPersisted(state: Record<string, unknown>): void {
  window.localStorage.setItem('prism-aac-marketplace', JSON.stringify({ state, version: 2 }));
}

const goodManifest = {
  slug: 'vocab-x',
  version: '1.0.0',
  kind: 'vocab-set',
  tier: 'free',
  category: 'vocab',
  status: 'available',
  nameKey: 'vocab.x.name',
  descKey: 'vocab.x.desc',
  icon: '📚',
};

describe('marketplaceStore — hydration validator', () => {
  it('drops malformed catalog entries on rehydrate', () => {
    seedPersisted({
      catalog: [
        goodManifest,
        { ...goodManifest, slug: 'bad-kind', kind: 'evil-kind' },        // bad: unknown kind
        { ...goodManifest, slug: 'bad-tier', tier: 'godmode' },          // bad: unknown tier
        { ...goodManifest, slug: 'bad-status', status: 'free-money' },   // bad: unknown status
        { ...goodManifest, slug: 'bad-cat', category: 'malware' },       // bad: unknown category
        { ...goodManifest, slug: '' },                                   // bad: empty slug
        { slug: 'no-version', kind: 'vocab-set', tier: 'free' },         // bad: incomplete
        'string-not-object',                                             // bad
      ],
    });
    void useMarketplaceStore.persist.rehydrate();
    const catalog = useMarketplaceStore.getState().catalog;
    expect(catalog.map((m) => m.slug)).toEqual(['vocab-x']);
  });

  it('caps catalog at MAX_CATALOG_SIZE on rehydrate', () => {
    const huge = Array.from({ length: 1000 }, (_, i) => ({ ...goodManifest, slug: `vocab-${i}` }));
    seedPersisted({ catalog: huge });
    void useMarketplaceStore.persist.rehydrate();
    expect(useMarketplaceStore.getState().catalog.length).toBeLessThanOrEqual(500);
  });

  it('drops malformed install records on rehydrate', () => {
    seedPersisted({
      installs: {
        good: { slug: 'good', version: '1.0.0', installedAt: 100 },
        'no-slug': { slug: '', version: '1.0.0', installedAt: 100 },
        'no-version': { slug: 'x', version: '', installedAt: 100 },
        'bad-ts': { slug: 'x', version: '1.0.0', installedAt: 'yesterday' },
        'neg-ts': { slug: 'x', version: '1.0.0', installedAt: -1 },
        'huge-version': { slug: 'x', version: 'v'.repeat(500), installedAt: 100 },
        'string-not-object': 'oops',
      },
    });
    void useMarketplaceStore.persist.rehydrate();
    const installs = useMarketplaceStore.getState().installs;
    expect(Object.keys(installs)).toEqual(['good']);
  });

  it('rejects non-finite fetchedAt and falls back to 0', () => {
    seedPersisted({ fetchedAt: 'never' });
    void useMarketplaceStore.persist.rehydrate();
    expect(useMarketplaceStore.getState().fetchedAt).toBe(0);
  });

  it('rejects unknown source enum and falls back to "unknown"', () => {
    seedPersisted({ source: 'attacker-injected' });
    void useMarketplaceStore.persist.rehydrate();
    expect(useMarketplaceStore.getState().source).toBe('unknown');
  });

  it('preserves a well-formed cached catalog + install record', () => {
    seedPersisted({
      catalog: [goodManifest],
      installs: { 'vocab-x': { slug: 'vocab-x', version: '1.0.0', installedAt: 555 } },
      fetchedAt: 12345,
      source: 'remote',
    });
    void useMarketplaceStore.persist.rehydrate();
    const s = useMarketplaceStore.getState();
    expect(s.catalog.map((m) => m.slug)).toEqual(['vocab-x']);
    expect(s.installs['vocab-x']?.version).toBe('1.0.0');
    expect(s.fetchedAt).toBe(12345);
    expect(s.source).toBe('remote');
  });
});
