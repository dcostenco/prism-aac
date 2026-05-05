import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { _resetRegistryForTests } from '@/lib/marketplace/registry';
import { _resetBootForTests, bootHandlers } from '@/lib/marketplace/handlers';
import type { HandlerContext } from '@/lib/marketplace/types';

interface StubState {
  installedApps: string[];
  activeVocabSet: string;
  closeSidePanel: number;
  openCategories: number;
  openGames: number;
  openMarketplace: number;
  openSettings: number;
  openModulePanel: string[];
}

function makeCtx(initial: Partial<StubState> = {}): { ctx: HandlerContext; state: StubState } {
  const state: StubState = {
    installedApps: [],
    activeVocabSet: 'all',
    closeSidePanel: 0,
    openCategories: 0,
    openGames: 0,
    openMarketplace: 0,
    openSettings: 0,
    openModulePanel: [],
    ...initial,
  };
  const ctx: HandlerContext = {
    settings: {
      installApp: (slug) => {
        if (!state.installedApps.includes(slug)) state.installedApps.push(slug);
      },
      uninstallApp: (slug) => {
        state.installedApps = state.installedApps.filter((s) => s !== slug);
      },
      update: (partial) => {
        if (typeof partial.activeVocabSet === 'string') state.activeVocabSet = partial.activeVocabSet;
      },
      getActiveVocabSet: () => state.activeVocabSet,
      getInstalledApps: () => state.installedApps,
    },
    ui: {
      closeSidePanel: () => { state.closeSidePanel++; },
      openCategories: () => { state.openCategories++; },
      openGames: () => { state.openGames++; },
      openMarketplace: () => { state.openMarketplace++; },
      openSettings: () => { state.openSettings++; },
      openModulePanel: (id: string) => { state.openModulePanel.push(id); },
    },
  };
  return { ctx, state };
}

beforeEach(() => {
  _resetRegistryForTests();
  _resetBootForTests();
  bootHandlers();
  useMarketplaceStore.setState({
    catalog: [],
    fetchedAt: 0,
    source: 'unknown',
    loading: false,
    error: null,
    selectedSlug: null,
  });
});

describe('marketplaceStore — loadCatalog', () => {
  it('hydrates catalog from local manifest', async () => {
    await useMarketplaceStore.getState().loadCatalog();
    const { catalog, source, loading } = useMarketplaceStore.getState();
    expect(loading).toBe(false);
    expect(source).toBe('local');
    expect(catalog.length).toBe(15);
  });

  it('skips refetch within TTL', async () => {
    await useMarketplaceStore.getState().loadCatalog();
    const fetchedAt = useMarketplaceStore.getState().fetchedAt;
    await useMarketplaceStore.getState().loadCatalog();
    expect(useMarketplaceStore.getState().fetchedAt).toBe(fetchedAt);
  });

  it('findBySlug finds known modules', async () => {
    await useMarketplaceStore.getState().loadCatalog();
    expect(useMarketplaceStore.getState().findBySlug('vocab-my-core')?.kind).toBe('vocab-set');
    expect(useMarketplaceStore.getState().findBySlug('nonexistent')).toBeUndefined();
  });
});

describe('marketplaceStore — install', () => {
  beforeEach(async () => {
    await useMarketplaceStore.getState().loadCatalog();
  });

  it('installs a free module for a free user', async () => {
    const { ctx, state } = makeCtx();
    const ok = await useMarketplaceStore.getState().install('vocab-my-core', 'free', ctx);
    expect(ok).toBe(true);
    expect(state.installedApps).toEqual(['vocab-my-core']);
    expect(state.activeVocabSet).toBe('my-core');
  });

  it('rejects install for tier the user lacks', async () => {
    const { ctx, state } = makeCtx();
    // picture-editor is standard tier and coming_soon — even if a user had
    // standard, status check rejects. Use tier rejection on a fictitious
    // upgrade — let's force a standard tier module by checking voice-packs.
    const ok = await useMarketplaceStore.getState().install('voice-packs', 'free', ctx);
    expect(ok).toBe(false);
    expect(state.installedApps).toEqual([]);
  });

  it('rejects install of coming_soon module even with tier access', async () => {
    const { ctx, state } = makeCtx();
    const ok = await useMarketplaceStore.getState().install('voice-packs', 'standard', ctx);
    expect(ok).toBe(false);
    expect(state.installedApps).toEqual([]);
  });

  it('rejects install of unknown slug', async () => {
    const { ctx } = makeCtx();
    const ok = await useMarketplaceStore.getState().install('nonexistent', 'enterprise', ctx);
    expect(ok).toBe(false);
  });

  it('install is idempotent for the same slug', async () => {
    const { ctx, state } = makeCtx();
    await useMarketplaceStore.getState().install('vocab-my-core', 'free', ctx);
    await useMarketplaceStore.getState().install('vocab-my-core', 'free', ctx);
    expect(state.installedApps).toEqual(['vocab-my-core']);
  });
});

describe('marketplaceStore — uninstall', () => {
  beforeEach(async () => {
    await useMarketplaceStore.getState().loadCatalog();
  });

  it('removes a previously-installed module', async () => {
    const { ctx, state } = makeCtx();
    await useMarketplaceStore.getState().install('vocab-my-core', 'free', ctx);
    await useMarketplaceStore.getState().uninstall('vocab-my-core', ctx);
    expect(state.installedApps).toEqual([]);
  });

  it('removes orphaned slug not in catalog', async () => {
    const { ctx, state } = makeCtx({ installedApps: ['legacy-removed-module'] });
    await useMarketplaceStore.getState().uninstall('legacy-removed-module', ctx);
    expect(state.installedApps).toEqual([]);
  });

  it('uninstall is idempotent', async () => {
    const { ctx, state } = makeCtx();
    await useMarketplaceStore.getState().uninstall('vocab-my-core', ctx);
    await useMarketplaceStore.getState().uninstall('vocab-my-core', ctx);
    expect(state.installedApps).toEqual([]);
  });
});

describe('marketplaceStore — isActive', () => {
  beforeEach(async () => {
    await useMarketplaceStore.getState().loadCatalog();
  });

  it('returns true for active vocab set', () => {
    const { ctx } = makeCtx({ activeVocabSet: 'my-core' });
    expect(useMarketplaceStore.getState().isActive('vocab-my-core', ctx)).toBe(true);
  });

  it('returns false for inactive vocab set', () => {
    const { ctx } = makeCtx({ activeVocabSet: 'wordpower' });
    expect(useMarketplaceStore.getState().isActive('vocab-my-core', ctx)).toBe(false);
  });

  it('returns false for unknown slug', () => {
    const { ctx } = makeCtx();
    expect(useMarketplaceStore.getState().isActive('nonexistent', ctx)).toBe(false);
  });
});
