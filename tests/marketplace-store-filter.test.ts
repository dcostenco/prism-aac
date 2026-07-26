import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { _resetRegistryForTests } from '@/lib/marketplace/registry';
import { _resetBootForTests, bootHandlers } from '@/lib/marketplace/handlers';
import { LOCAL_CATALOG } from '@/lib/marketplace/manifests/local';
import type { HandlerContext } from '@/lib/marketplace/types';

function makeCtx() {
  const state = {
    installedApps: [] as string[],
    activeVocabSet: 'all',
  };
  const ctx: HandlerContext = {
    settings: {
      installApp: (slug) => { if (!state.installedApps.includes(slug)) state.installedApps.push(slug); },
      uninstallApp: (slug) => { state.installedApps = state.installedApps.filter((s) => s !== slug); },
      update: (partial) => { if (typeof partial.activeVocabSet === 'string') state.activeVocabSet = partial.activeVocabSet; },
      getActiveVocabSet: () => state.activeVocabSet,
      getInstalledApps: () => state.installedApps,
    },
    ui: {
      closeSidePanel: () => {},
      openCategories: () => {},
      openGames: () => {},
      openMarketplace: () => {},
      openSettings: () => {},
      openModulePanel: () => {},
    },
  };
  return { ctx, state };
}

beforeEach(() => {
  _resetRegistryForTests();
  _resetBootForTests();
  bootHandlers();
  useMarketplaceStore.setState({
    // Filtering is a pure store concern. Seed the bundled fixture directly
    // instead of calling the live portal from a unit test.
    catalog: LOCAL_CATALOG,
    fetchedAt: Date.now(),
    source: 'local',
    loading: false,
    error: null,
    selectedSlug: null,
    installs: {},
  });
});

describe('marketplaceStore — filterCatalog', () => {
  it('all + empty query returns full catalog', () => {
    const out = useMarketplaceStore.getState().filterCatalog('all', '', []);
    expect(out).toHaveLength(LOCAL_CATALOG.length);
  });

  it('vocab category returns vocab-set + board-template + the explicit vocab entries', () => {
    const out = useMarketplaceStore.getState().filterCatalog('vocab', '', []);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((m) => m.category === 'vocab')).toBe(true);
  });

  it('games category returns only game-pack entries', () => {
    const out = useMarketplaceStore.getState().filterCatalog('games', '', []);
    expect(out.every((m) => m.category === 'games')).toBe(true);
    expect(out.find((m) => m.slug === 'game-packs')).toBeDefined();
  });

  it('voices category returns voice-packs', () => {
    const out = useMarketplaceStore.getState().filterCatalog('voices', '', []);
    expect(out.find((m) => m.slug === 'voice-packs')).toBeDefined();
  });

  it('symbols category returns symbol-libraries', () => {
    const out = useMarketplaceStore.getState().filterCatalog('symbols', '', []);
    expect(out.find((m) => m.slug === 'symbol-libraries')).toBeDefined();
  });

  it('tools category returns the panel-kind modules + the AAC Chat builtin shortcut', () => {
    const out = useMarketplaceStore.getState().filterCatalog('tools', '', []);
    const slugs = out.map((m) => m.slug).sort();
    const expected = LOCAL_CATALOG
      .filter((module) => module.category === 'tools')
      .map((module) => module.slug)
      .sort();
    expect(slugs).toEqual(expected);
    expect(slugs).toContain('aac-chat');
  });

  it('installed tab with empty installedSlugs returns empty', () => {
    const out = useMarketplaceStore.getState().filterCatalog('installed', '', []);
    expect(out).toEqual([]);
  });

  it('installed tab returns only the supplied installed slugs', () => {
    const out = useMarketplaceStore
      .getState()
      .filterCatalog('installed', '', ['vocab-my-core', 'game-packs']);
    expect(out.map((m) => m.slug).sort()).toEqual(['game-packs', 'vocab-my-core']);
  });

  it('query matches slug case-insensitively', () => {
    const out = useMarketplaceStore.getState().filterCatalog('all', 'CORE', []);
    expect(out.find((m) => m.slug === 'vocab-my-core')).toBeDefined();
  });

  it('query matches nameKey', () => {
    const out = useMarketplaceStore.getState().filterCatalog('all', 'wordpower', []);
    expect(out.find((m) => m.slug === 'vocab-wordpower')).toBeDefined();
  });

  it('combines category + query', () => {
    const out = useMarketplaceStore.getState().filterCatalog('vocab', 'aphasia', []);
    expect(out.length).toBe(1);
    expect(out[0].slug).toBe('vocab-aphasia');
  });

  it('returns empty when no match', () => {
    const out = useMarketplaceStore.getState().filterCatalog('all', 'this-does-not-exist', []);
    expect(out).toEqual([]);
  });
});

describe('marketplaceStore — hasUpdate', () => {
  it('returns false when slug not installed', () => {
    expect(useMarketplaceStore.getState().hasUpdate('vocab-my-core', [])).toBe(false);
  });

  it('returns false when no install record exists yet', () => {
    expect(
      useMarketplaceStore.getState().hasUpdate('vocab-my-core', ['vocab-my-core']),
    ).toBe(false);
  });

  it('returns false when install version equals catalog version', async () => {
    const { ctx } = makeCtx();
    await useMarketplaceStore.getState().install('vocab-my-core', 'free', ctx);
    expect(
      useMarketplaceStore.getState().hasUpdate('vocab-my-core', ['vocab-my-core']),
    ).toBe(false);
  });

  it('returns true when catalog has a newer version than the install record', async () => {
    const { ctx } = makeCtx();
    await useMarketplaceStore.getState().install('vocab-my-core', 'free', ctx);
    // Bump the catalog version artificially to simulate a new release.
    useMarketplaceStore.setState((s) => ({
      catalog: s.catalog.map((m) =>
        m.slug === 'vocab-my-core' ? { ...m, version: '2.0.0' } : m,
      ),
    }));
    expect(
      useMarketplaceStore.getState().hasUpdate('vocab-my-core', ['vocab-my-core']),
    ).toBe(true);
  });

  it('uninstall clears the install record so update flag goes away', async () => {
    const { ctx } = makeCtx();
    await useMarketplaceStore.getState().install('vocab-my-core', 'free', ctx);
    useMarketplaceStore.setState((s) => ({
      catalog: s.catalog.map((m) =>
        m.slug === 'vocab-my-core' ? { ...m, version: '2.0.0' } : m,
      ),
    }));
    await useMarketplaceStore.getState().uninstall('vocab-my-core', ctx);
    expect(
      useMarketplaceStore.getState().hasUpdate('vocab-my-core', []),
    ).toBe(false);
  });
});
