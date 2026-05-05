/**
 * Marketplace type definitions.
 *
 * Modules are described by a {@link ModuleManifest}. Each manifest declares a
 * `kind` that selects the {@link ModuleHandler} responsible for installing,
 * uninstalling, and (eventually) launching the module. The handler is the
 * extension point — adding a new module type means adding a handler file
 * under `lib/marketplace/handlers/` and registering it in `index.ts`.
 *
 * Persistence in Phase 1 piggybacks on {@link SettingsState.installedApps}
 * (zustand persist) — the marketplace store is a derivation over that array
 * plus the catalog. Phase 3 introduces a server source of truth for installs;
 * the local list stays as an offline cache.
 */
import type { ReactNode } from 'react';

export const MODULE_KINDS = [
  'vocab-set',
  'board-template',
  'symbol-library',
  'game-pack',
  'voice-pack',
  'panel',
  // First-party Synalux apps (Mail, Drive, ...) installed alongside vocab/games
  // so users get a single "App Store" surface. Launches navigate to the live
  // Synalux URL, preserving the cookie session for sign-on.
  'synalux-app',
] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number];

export const MODULE_TIERS = ['free', 'standard', 'advanced', 'enterprise'] as const;
export type ModuleTier = (typeof MODULE_TIERS)[number];

export const TIER_RANK: Record<ModuleTier, number> = {
  free: 0,
  standard: 1,
  advanced: 2,
  enterprise: 3,
};

export const MODULE_STATUSES = ['available', 'coming_soon', 'deprecated'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const MODULE_CATEGORIES = ['vocab', 'games', 'voices', 'symbols', 'tools', 'apps'] as const;
export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export interface ModuleManifest {
  /** Stable id, e.g. "vocab-my-core". Unique across the catalog. */
  slug: string;
  /** Semver-ish version string, e.g. "1.0.0". Free-form for now. */
  version: string;
  /** Minimum subscription tier required to install. */
  tier: ModuleTier;
  /** Selects which handler runs install/uninstall/launch. */
  kind: ModuleKind;
  /** UI taxonomy bucket. Drives marketplace tabs / filters. */
  category: ModuleCategory;
  /** i18n key for the display name. Falls back to slug if missing. */
  nameKey: string;
  /** i18n key for the long description. */
  descKey: string;
  /** Display icon — emoji or URL. Phase 1 uses emoji only. */
  icon: string;
  /** Marketplace listing state. Coming-soon entries cannot be installed. */
  status: ModuleStatus;
  /** Optional CDN URLs for the listing detail view (Phase 2). */
  preview?: string;
  screenshots?: string[];
  /** Approximate disk footprint, kB. Informational only. */
  sizeKb?: number;
  /** Other slugs that must be installed first. */
  deps?: string[];
  /** Kind-specific config; the handler owns this shape. */
  handlerPayload?: Record<string, unknown>;
  /** When the manifest was last updated server-side; ISO-8601. */
  updatedAt?: string;
  /** Per-version notes shown in the detail view's "What's new" section. */
  changelog?: { version: string; notes: string }[];
  /** Aggregate rating (0-5). Phase 3 starts populating from module_reviews. */
  rating?: number;
  /** Number of reviews backing the rating. */
  reviewCount?: number;
}

export interface ModuleInstallRecord {
  slug: string;
  version: string;
  installedAt: number;
}

/**
 * Stores + actions exposed to handlers. Passed by value so handlers stay pure
 * and unit-testable — substitute a stub in tests.
 */
export interface HandlerContext {
  settings: {
    installApp: (slug: string) => void;
    uninstallApp: (slug: string) => void;
    update: (partial: { activeVocabSet?: string }) => void;
    getActiveVocabSet: () => string;
    getInstalledApps: () => string[];
  };
  ui: {
    closeSidePanel: () => void;
    openCategories: () => void;
    openGames: () => void;
    openMarketplace: () => void;
    /** Open a settings tab/section by id. Phase 1 just opens settings root. */
    openSettings: (section?: string) => void;
    /**
     * Open a marketplace-installed module panel by its panelId. The uiStore
     * decides whether the id maps to a known panel; unknown ids no-op.
     * Used by panelHandler.launch().
     */
    openModulePanel: (panelId: string) => void;
  };
}

/**
 * Handlers are looked up by `kind`. Each handler must be safe to call multiple
 * times (idempotent install/uninstall) and must not throw on partial state.
 */
export interface ModuleHandler {
  kind: ModuleKind;
  /**
   * Validate kind-specific payload. Return false to drop the manifest from
   * the catalog. Used at boot when the catalog is hydrated.
   */
  validate(manifest: ModuleManifest): boolean;
  /**
   * Apply install side-effects and persist. Called only after the caller has
   * verified tier access and that status === 'available'.
   */
  install(manifest: ModuleManifest, ctx: HandlerContext): Promise<void> | void;
  /** Reverse install side-effects. */
  uninstall(manifest: ModuleManifest, ctx: HandlerContext): Promise<void> | void;
  /**
   * "Active" is distinct from "installed". A vocab-set module is `installed`
   * when its slug is in installedApps, but only `active` when activeVocabSet
   * matches its payload. The marketplace UI shows the green check based on
   * isActive, not installed-ness.
   */
  isActive(manifest: ModuleManifest, ctx: HandlerContext): boolean;
  /**
   * Tap-to-launch from toolbar. Phase 8 wires Toolbar.tsx to call this. Phase
   * 1 falls back to opening the marketplace if launch is undefined.
   */
  launch?(manifest: ModuleManifest, ctx: HandlerContext): void;
  /**
   * Optional renderable panel. Phase 4-7 fill this in for picture-editor,
   * music-composer, video-composer, aac-designer.
   */
  renderPanel?(manifest: ModuleManifest, ctx: HandlerContext): ReactNode;
}

/**
 * Strict manifest schema check. Dropped rows are logged to console.warn so
 * a malformed server response doesn't poison the entire panel.
 */
export function isValidManifest(value: unknown): value is ModuleManifest {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  if (typeof m.slug !== 'string' || !m.slug) return false;
  if (typeof m.version !== 'string' || !m.version) return false;
  if (typeof m.kind !== 'string' || !MODULE_KINDS.includes(m.kind as ModuleKind)) return false;
  if (typeof m.tier !== 'string' || !MODULE_TIERS.includes(m.tier as ModuleTier)) return false;
  if (typeof m.status !== 'string' || !MODULE_STATUSES.includes(m.status as ModuleStatus)) return false;
  if (typeof m.category !== 'string' || !MODULE_CATEGORIES.includes(m.category as ModuleCategory)) return false;
  if (typeof m.nameKey !== 'string' || !m.nameKey) return false;
  if (typeof m.descKey !== 'string' || !m.descKey) return false;
  if (typeof m.icon !== 'string' || !m.icon) return false;
  return true;
}

export function tierAllows(userTier: ModuleTier, required: ModuleTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}
