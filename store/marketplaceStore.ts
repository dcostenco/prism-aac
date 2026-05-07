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
import type {
  HandlerContext,
  ModuleCategory,
  ModuleInstallRecord,
  ModuleManifest,
  ModuleTier,
} from '@/lib/marketplace/types';
import { isValidManifest, tierAllows } from '@/lib/marketplace/types';

/** Caps applied at hydration. Catalog comes from the server but is cached
 *  in localStorage where a hostile browser ext / sibling tab / devtools edit
 *  could tamper with it before the next page load. install records feed
 *  compareVersions, which is used to flag updates — a tampered version
 *  string with non-numeric content could false-positive the update badge
 *  forever. */
const MAX_CATALOG_SIZE = 500;
const MAX_INSTALL_RECORDS = 500;
const MAX_SLUG_LEN = 80;
const MAX_VERSION_LEN = 32;
const VALID_SOURCES = new Set<MarketplaceState['source']>(['local', 'remote', 'cache', 'unknown']);

export interface MarketplaceState {
  catalog: ModuleManifest[];
  fetchedAt: number;
  source: 'local' | 'remote' | 'cache' | 'unknown';
  loading: boolean;
  error: string | null;
  /** Last user-selected detail view — Phase 2 wires the UI. */
  selectedSlug: string | null;
  /**
   * Per-slug install records — captures the version that was installed so we
   * can flag updates when a newer manifest version appears in the catalog.
   * The user-facing source of truth for "is X installed?" remains
   * settings.installedApps[]; this map is supplementary version metadata.
   */
  installs: Record<string, ModuleInstallRecord>;

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

  /**
   * Filter the catalog to a category + free-text query. Pass category='all'
   * for no category filter; query is matched (case-insensitive) against
   * slug + nameKey + descKey. Filtering by 'installed' returns only installed
   * slugs (intersect with the supplied installedSlugs param).
   */
  filterCatalog: (
    category: ModuleCategory | 'all' | 'installed',
    query: string,
    installedSlugs: string[],
  ) => ModuleManifest[];

  /**
   * True if the slug is installed AND the current catalog version is greater
   * than the recorded install version. Phase 2 surfaces this via the update
   * badge.
   */
  hasUpdate: (slug: string, installedSlugs: string[]) => boolean;
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
      installs: {},

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
          // Record the version we installed — used by hasUpdate() later.
          set((s) => ({
            installs: {
              ...s.installs,
              [slug]: { slug, version: manifest.version, installedAt: Date.now() },
            },
          }));
          return true;
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'install failed' });
          return false;
        }
      },

      uninstall: async (slug, ctx) => {
        const manifest = get().findBySlug(slug);
        const dropInstallRecord = () =>
          set((s) => {
            const next = { ...s.installs };
            delete next[slug];
            return { installs: next };
          });
        if (!manifest) {
          // If the catalog no longer carries this slug (e.g. server pulled
          // it), still let the user remove it from their installed list.
          ctx.settings.uninstallApp(slug);
          dropInstallRecord();
          return;
        }
        const handler = getHandler(manifest.kind);
        if (!handler) {
          ctx.settings.uninstallApp(slug);
          dropInstallRecord();
          return;
        }
        try {
          await handler.uninstall(manifest, ctx);
          dropInstallRecord();
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

      filterCatalog: (category, query, installedSlugs) => {
        const q = query.trim().toLowerCase();
        const installed = new Set(installedSlugs);
        const all = get().catalog;
        return all.filter((m) => {
          if (category === 'installed') {
            if (!installed.has(m.slug)) return false;
          } else if (category !== 'all') {
            if (m.category !== category) return false;
          }
          if (q) {
            const hay = `${m.slug} ${m.nameKey} ${m.descKey}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
      },

      hasUpdate: (slug, installedSlugs) => {
        if (!installedSlugs.includes(slug)) return false;
        const manifest = get().findBySlug(slug);
        if (!manifest) return false;
        const record = get().installs[slug];
        if (!record) return false;
        return compareVersions(manifest.version, record.version) > 0;
      },
    }),
    {
      name: 'prism-aac-marketplace',
      version: 2,
      // Persist catalog cache + per-slug install records. Selection state
      // and loading flags start fresh on every page load. Phase 3 will
      // mirror installs to the server; Phase 1-2 keep them local.
      partialize: (s) => ({
        catalog: s.catalog,
        fetchedAt: s.fetchedAt,
        source: s.source,
        installs: s.installs,
      }),
      migrate: (persisted: unknown, version: number) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          s.installs = (s.installs as Record<string, ModuleInstallRecord> | undefined) ?? {};
        }
        return s;
      },
      // Hydration validator. Catalog cache + install records are read from
      // localStorage on every page load and consumed by handler dispatch
      // (getHandler(manifest.kind)) and the update-badge calculation
      // (compareVersions). A tampered catalog could inject a manifest with
      // a kind that points to an unexpected handler; a tampered install
      // record with a non-numeric version could false-positive hasUpdate
      // forever. Drop malformed rows, cap counts, force enum types.
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Partial<MarketplaceState>;

        const cleanCatalog = (Array.isArray(incoming.catalog) ? incoming.catalog : [])
          .filter((m): m is ModuleManifest => isValidManifest(m))
          .slice(0, MAX_CATALOG_SIZE);

        const cleanInstalls: Record<string, ModuleInstallRecord> = {};
        if (incoming.installs && typeof incoming.installs === 'object' && !Array.isArray(incoming.installs)) {
          let count = 0;
          for (const [key, value] of Object.entries(incoming.installs as Record<string, unknown>)) {
            if (count >= MAX_INSTALL_RECORDS) break;
            if (typeof key !== 'string' || !key || key.length > MAX_SLUG_LEN) continue;
            if (!value || typeof value !== 'object') continue;
            const r = value as Record<string, unknown>;
            if (typeof r.slug !== 'string' || !r.slug || r.slug.length > MAX_SLUG_LEN) continue;
            if (typeof r.version !== 'string' || !r.version || r.version.length > MAX_VERSION_LEN) continue;
            if (typeof r.installedAt !== 'number' || !Number.isFinite(r.installedAt) || r.installedAt < 0) continue;
            cleanInstalls[key] = { slug: r.slug, version: r.version, installedAt: r.installedAt };
            count++;
          }
        }

        const fetchedAt = typeof incoming.fetchedAt === 'number'
          && Number.isFinite(incoming.fetchedAt)
          && incoming.fetchedAt >= 0
          ? incoming.fetchedAt
          : 0;

        const source = typeof incoming.source === 'string' && VALID_SOURCES.has(incoming.source as MarketplaceState['source'])
          ? incoming.source as MarketplaceState['source']
          : 'unknown';

        return {
          ...currentState,
          catalog: cleanCatalog,
          fetchedAt,
          source,
          installs: cleanInstalls,
        };
      },
    },
  ),
);

/**
 * Lexical-by-numeric-segments version compare. Returns >0 if `a` is newer,
 * <0 if `b` is newer, 0 if equal. Tolerates pre-release suffixes by stripping
 * anything after the first non-numeric character on a segment.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(parseSegment);
  const pb = b.split('.').map(parseSegment);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function parseSegment(seg: string): number {
  const m = /^(\d+)/.exec(seg);
  return m ? parseInt(m[1], 10) : 0;
}
