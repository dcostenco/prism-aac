'use client';
import { useEffect, useMemo, useState, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import type { HandlerContext, ModuleManifest, ModuleTier } from '@/lib/marketplace/types';
import MarketplaceCard from './marketplace/MarketplaceCard';
import MarketplaceTabs, { type MarketplaceTab } from './marketplace/MarketplaceTabs';
import MarketplaceSearch from './marketplace/MarketplaceSearch';
import MarketplaceDetail from './marketplace/MarketplaceDetail';
import MarketplaceEmptyState from './marketplace/MarketplaceEmptyState';

function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section
      aria-label={t('marketplace')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      {children}
    </section>
  );
}

export default function MarketplacePanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel, openCategories, openGames, openMarketplace, openModulePanel, toggleSettings } = useUIStore();
  const profile = useAuthStore((s) => s.profile);
  const settings = useSettingsStore();
  const installedApps = useSettingsStore((s) => s.installedApps);
  const catalog = useMarketplaceStore((s) => s.catalog);
  const loading = useMarketplaceStore((s) => s.loading);
  const error = useMarketplaceStore((s) => s.error);
  const loadCatalog = useMarketplaceStore((s) => s.loadCatalog);
  const installModule = useMarketplaceStore((s) => s.install);
  const uninstallModule = useMarketplaceStore((s) => s.uninstall);
  const isActiveModule = useMarketplaceStore((s) => s.isActive);
  const filterCatalog = useMarketplaceStore((s) => s.filterCatalog);
  const hasUpdateModule = useMarketplaceStore((s) => s.hasUpdate);

  const [activeTab, setActiveTab] = useState<MarketplaceTab>('all');
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const ctx: HandlerContext = useMemo(() => ({
    settings: {
      installApp: settings.installApp,
      uninstallApp: settings.uninstallApp,
      update: (partial) => settings.update(partial),
      getActiveVocabSet: () => useSettingsStore.getState().activeVocabSet,
      getInstalledApps: () => useSettingsStore.getState().installedApps,
    },
    ui: {
      closeSidePanel,
      openCategories,
      openGames,
      openMarketplace,
      openSettings: () => { if (!useUIStore.getState().showSettings) toggleSettings(); },
      openModulePanel,
    },
  }), [settings, closeSidePanel, openCategories, openGames, openMarketplace, openModulePanel, toggleSettings]);

  if (sidePanel !== 'marketplace') return null;

  const userTier = (profile?.plan ?? 'free') as ModuleTier;
  const filtered = filterCatalog(activeTab, query, installedApps);
  const selectedManifest = selectedSlug ? catalog.find((m) => m.slug === selectedSlug) ?? null : null;

  const handleInstall = async (item: ModuleManifest) => {
    tapFeedback();
    await installModule(item.slug, userTier, ctx);
  };

  const handleUninstall = async (item: ModuleManifest) => {
    tapFeedback();
    await uninstallModule(item.slug, ctx);
    // After uninstall, leave detail open so the user can see the new state
    // (uninstalled). Tap close to dismiss.
  };

  const renderBody = () => {
    if (loading && catalog.length === 0) return <MarketplaceEmptyState variant="loading" />;
    if (error && catalog.length === 0) return <MarketplaceEmptyState variant="error" message={error} />;
    if (filtered.length === 0) {
      const variant = activeTab === 'installed' ? 'no-installed' : 'no-results';
      return <MarketplaceEmptyState variant={variant} />;
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map((item) => (
          <MarketplaceCard
            key={item.slug}
            manifest={item}
            userTier={userTier}
            active={isActiveModule(item.slug, ctx)}
            hasUpdate={hasUpdateModule(item.slug, installedApps)}
            onInstall={(m) => { void handleInstall(m); }}
            onLocked={(m) => { setSelectedSlug(m.slug); }}
          />
        ))}
      </div>
    );
  };

  return (
    <PanelShell>
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-2xl md:text-3xl">🏪 {t('marketplace')}</span>
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label={t('close_panel')}
          className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme"
        >
          ✕
        </button>
      </div>

      <MarketplaceTabs active={activeTab} installedCount={installedApps.length} onChange={setActiveTab} />
      <MarketplaceSearch value={query} onChange={setQuery} />

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-muted text-sm mb-3">{t('mp_browse_desc')}</p>
        {renderBody()}
      </div>

      {selectedManifest && (
        <MarketplaceDetail
          manifest={selectedManifest}
          userTier={userTier}
          installed={installedApps.includes(selectedManifest.slug)}
          active={isActiveModule(selectedManifest.slug, ctx)}
          hasUpdate={hasUpdateModule(selectedManifest.slug, installedApps)}
          onClose={() => setSelectedSlug(null)}
          onInstall={(m) => { void handleInstall(m); }}
          onUninstall={(m) => { void handleUninstall(m); }}
        />
      )}
    </PanelShell>
  );
}
