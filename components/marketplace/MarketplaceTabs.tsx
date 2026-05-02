'use client';
import { useT } from '@/engine/useT';
import type { ModuleCategory } from '@/lib/marketplace/types';
import { MODULE_CATEGORIES } from '@/lib/marketplace/types';

export type MarketplaceTab = 'all' | 'installed' | ModuleCategory;

interface Props {
  active: MarketplaceTab;
  installedCount: number;
  onChange: (tab: MarketplaceTab) => void;
}

/**
 * Horizontal scrollable tab strip. Three groups:
 *   - "All"          — show entire catalog
 *   - "Installed (N)" — only show installed slugs (uninstall lives here)
 *   - 5 category tabs — vocab / games / voices / symbols / tools
 *
 * Tabs scroll horizontally on narrow screens so we don't crowd the toolbar.
 */
const CATEGORY_LABELS: Record<MarketplaceTab, string> = {
  all: 'mp_tab_all',
  installed: 'mp_tab_installed',
  vocab: 'mp_filter_vocab',
  games: 'mp_filter_games',
  voices: 'mp_filter_voices',
  symbols: 'mp_filter_symbols',
  tools: 'mp_filter_tools',
};

const ORDER: MarketplaceTab[] = ['all', 'installed', ...MODULE_CATEGORIES];

export default function MarketplaceTabs({ active, installedCount, onChange }: Props) {
  const { t } = useT();
  return (
    <div
      role="tablist"
      aria-label={t('marketplace')}
      className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-theme shrink-0"
    >
      {ORDER.map((tab) => {
        const labelKey = CATEGORY_LABELS[tab];
        const label = t(labelKey);
        const display = tab === 'installed' ? `${label} (${installedCount})` : label;
        const isActive = tab === active;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            data-testid={`mp-tab-${tab}`}
            onClick={() => onChange(tab)}
            className={`aac-btn px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap shrink-0 border ${
              isActive ? 'bg-[#2196F3] text-white border-[#2196F3]' : 'surface-key text-primary border-theme'
            }`}
          >
            {display}
          </button>
        );
      })}
    </div>
  );
}
