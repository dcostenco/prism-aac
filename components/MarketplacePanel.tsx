'use client';
import { useEffect, useMemo, useState, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import type { HandlerContext, ModuleManifest, ModuleTier } from '@/lib/marketplace/types';
import { tierAllows } from '@/lib/marketplace/types';

function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section aria-label={t('marketplace')} className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme">
      {children}
    </section>
  );
}

export default function MarketplacePanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel, openCategories, openGames, openMarketplace, toggleSettings } = useUIStore();
  const profile = useAuthStore((s) => s.profile);
  const settings = useSettingsStore();
  const catalog = useMarketplaceStore((s) => s.catalog);
  const loadCatalog = useMarketplaceStore((s) => s.loadCatalog);
  const installModule = useMarketplaceStore((s) => s.install);
  const isActiveModule = useMarketplaceStore((s) => s.isActive);
  const [selectedItem, setSelectedItem] = useState<ModuleManifest | null>(null);

  // Always boot the catalog when the panel mounts, regardless of whether it
  // is visible. Cheap (1h TTL) and means the next open is instant.
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  // Build the handler context once per render — handlers are pure consumers.
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
    },
  }), [settings, closeSidePanel, openCategories, openGames, openMarketplace, toggleSettings]);

  if (sidePanel !== 'marketplace') return null;

  const userTier = (profile?.plan ?? 'free') as ModuleTier;

  const handleInstall = async (item: ModuleManifest) => {
    tapFeedback();
    const hasAccess = tierAllows(userTier, item.tier);
    if (!hasAccess || item.status !== 'available') return;
    await installModule(item.slug, userTier, ctx);
    setSelectedItem(null);
  };

  return (
    <PanelShell>
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-2xl md:text-3xl">🏪 {t('marketplace')}</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-muted text-sm mb-3">{t('mp_browse_desc')}</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {catalog.map((item) => {
            const hasAccess = tierAllows(userTier, item.tier);
            const active = isActiveModule(item.slug, ctx);
            const canInstall = hasAccess && item.status === 'available';

            return (
              <button
                key={item.slug}
                className={`aac-btn min-h-[clamp(100px,18vw,140px)] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 p-3 select-none relative ${
                  active ? 'bg-[#E8F5E9] border-[#4CAF50] dark:bg-[#1a3a1a]' : 'surface-key border-theme'
                } ${!canInstall ? 'opacity-50' : ''}`}
                onClick={() => {
                  tapFeedback();
                  if (canInstall) {
                    void handleInstall(item);
                  } else {
                    setSelectedItem(item);
                  }
                }}
              >
                <span className="absolute top-2 right-2 text-sm">
                  {active ? '✅' : canInstall ? '➕' : '🔒'}
                </span>

                <span className="text-3xl md:text-4xl">{item.icon}</span>
                <span className="text-primary font-bold text-xs md:text-sm text-center leading-tight">{t(item.nameKey)}</span>

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  active ? 'bg-[#4CAF50] text-white'
                    : item.status === 'available' ? 'bg-[#2196F3] text-white'
                    : 'bg-[#FF9800] text-white'
                }`}>
                  {active ? t('mp_active') : item.status === 'available' ? t('mp_tap_install') : t('coming_soon')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedItem && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 p-4" onClick={() => setSelectedItem(null)} role="dialog" aria-modal="true">
          <div className="surface-bar rounded-2xl border border-theme max-w-md w-full p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="text-5xl">{selectedItem.icon}</span>
              <div>
                <h3 className="text-primary font-bold text-xl">{t(selectedItem.nameKey)}</h3>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${
                  selectedItem.status === 'coming_soon' ? 'bg-[#FF9800] text-white' : 'bg-[#F44336] text-white'
                }`}>
                  {selectedItem.status === 'coming_soon' ? t('coming_soon') : t('upgrade_to_unlock')}
                </span>
              </div>
            </div>
            <p className="text-primary text-base">{t(selectedItem.descKey)}</p>
            <div className="flex items-center gap-2">
              <span className="text-muted text-sm">{t('required_tier')}:</span>
              <span className="text-primary font-bold capitalize">{t(`plan_${selectedItem.tier}`)}</span>
            </div>
            <button className="aac-btn min-h-[56px] rounded-xl surface-key text-primary font-bold text-lg border border-theme" onClick={() => { tapFeedback(); setSelectedItem(null); }}>
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </PanelShell>
  );
}
