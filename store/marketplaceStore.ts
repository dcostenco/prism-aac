/**
 * Marketplace store.
 *
 * Catalog cache + selection state. Persists to localStorage so the catalog
 * survives reloads (the user can browse offline). Install state is NOT
 * persisted here — it lives in `settingsStore.installedApps` so the toolbar
 * keeps its existing source of truth and back-compat is automatic.
 *
 * Phase 3 will switch fetchCatalog to a real API call; the store interface
 * stays the same.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchCatalog } from '@/lib/marketplace/api';
import { bootHandlers } from '@/lib/marketplace/handlers';
import { getHandler } from '@/lib/marketplace/registry';
import type { HandlerContext, ModuleManifest, ModuleTier } from '@/lib/marketplace/types';
import { tierAllows } from '@/lib/marketplace/types';

export interface MarketplaceState {
  catalog: ModuleManifest[];
  fetchedAt: number;
  source: 'local' | 'remote' | 'cache' | 'unknown';
  loading: boolean;
  error: string | null;
  /** Last user-selected detail view — Phase 2 wires the UI. */
  selectedSlug: string | null;

  loadCatalog: () => Promise<void>;
  setSelected: (slug: string | null) => void;

  /**
   * Install a module. Resolves the handler, runs tier check + status check,
   * delegates to the handler. Returns false if the install was rejected.
   */
  install: (slug: string, userTier: ModuleTier, ctx: HandlerContext) => Promise<boolean>;
  uninstall: (slug: string, ctx: HandlerContext) => Promise<void>;
  isActive: (slug: string, ctx: HandlerContext) => boolean;

  findBySlug: (slug: string) => ModuleManifest | undefined;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour

export const useMarketplaceStore = create<MarketplaceState>()(
  persist(
    (set, get) => ({
      catalog: [],
      fetchedAt: 0,
      source: 'unknown',
      loading: false,
      error: null,
      selectedSlug: null,

      loadCatalog: async () => {
        bootHandlers();
        const { fetchedAt, catalog, loading } = get();
        const fresh = catalog.length > 0 && Date.now() - fetchedAt < TTL_MS;
        if (loading || fresh) return;
        set({ loading: true, error: null });
        try {
          const res = await fetchCatalog();
          set({
            catalog: res.modules,
            fetchedAt: res.fetchedAt,
            source: res.source,
            loading: false,
          });
        } catch (e) {
          // Keep whatever cached catalog we had — never blank the UI on fetch
          // failure. Surface the error for diagnostic display.
          set({
            loading: false,
            error: e instanceof Error ? e.message : 'catalog fetch failed',
          });
        }
      },

      setSelected: (slug) => set({ selectedSlug: slug }),

      install: async (slug, userTier, ctx) => {
        const manifest = get().findBySlug(slug);
        if (!manifest) return false;
        if (manifest.status !== 'available') return false;
        if (!tierAllows(userTier, manifest.tier)) return false;
        const handler = getHandler(manifest.kind);
        if (!handler) return false;
        if (!handler.validate(manifest)) return false;
        try {
          await handler.install(manifest, ctx);
          return true;
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'install failed' });
          return false;
        }
      },

      uninstall: async (slug, ctx) => {
        const manifest = get().findBySlug(slug);
        if (!manifest) {
          // If the catalog no longer carries this slug (e.g. server pulled
          // it), still let the user remove it from their installed list.
          ctx.settings.uninstallApp(slug);
          return;
        }
        const handler = getHandler(manifest.kind);
        if (!handler) {
          ctx.settings.uninstallApp(slug);
          return;
        }
        try {
          await handler.uninstall(manifest, ctx);
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'uninstall failed' });
        }
      },

      isActive: (slug, ctx) => {
        const manifest = get().findBySlug(slug);
        if (!manifest) return false;
        const handler = getHandler(manifest.kind);
        if (!handler) return false;
        return handler.isActive(manifest, ctx);
      },

      findBySlug: (slug) => get().catalog.find((m) => m.slug === slug),
    }),
    {
      name: 'prism-aac-marketplace',
      version: 1,
      // Persist only the catalog cache. Selection state and loading flags
      // start fresh on every page load.
      partialize: (s) => ({
        catalog: s.catalog,
        fetchedAt: s.fetchedAt,
        source: s.source,
      }),
    },
  ),
);
