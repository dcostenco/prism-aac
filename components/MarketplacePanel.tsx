'use client';
import { useState, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCategoryStore } from '@/store/categoryStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { VOCAB_SETS } from '@/constants/vocabularySets';

function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section aria-label={t('marketplace')} className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme">
      {children}
    </section>
  );
}

const TIER_RANK: Record<string, number> = { free: 0, standard: 1, advanced: 2, enterprise: 3 };
type TierReq = 'free' | 'standard' | 'advanced' | 'enterprise';

interface CatalogItem {
  id: string;
  icon: string;
  nameKey: string;
  descKey: string;
  minTier: TierReq;
  status: 'available' | 'coming_soon' | 'installed';
  action?: 'vocab-set' | 'open-panel' | 'settings';
  actionPayload?: string;
}

const CATALOG: CatalogItem[] = [
  { id: 'symbol-libraries', icon: '📚', nameKey: 'mp_symbol_libraries', descKey: 'mp_symbol_libraries_desc', minTier: 'free', status: 'available', action: 'settings' },
  { id: 'board-templates', icon: '📋', nameKey: 'mp_board_templates', descKey: 'mp_board_templates_desc', minTier: 'free', status: 'available', action: 'vocab-set' },
  { id: 'vocab-my-core', icon: '⚡', nameKey: 'vs_my_core', descKey: 'vs_my_core_desc', minTier: 'free', status: 'available', action: 'vocab-set', actionPayload: 'my-core' },
  { id: 'vocab-wordpower', icon: '💪', nameKey: 'vs_wordpower', descKey: 'vs_wordpower_desc', minTier: 'free', status: 'available', action: 'vocab-set', actionPayload: 'wordpower' },
  { id: 'vocab-gateway', icon: '🚪', nameKey: 'vs_gateway', descKey: 'vs_gateway_desc', minTier: 'free', status: 'available', action: 'vocab-set', actionPayload: 'gateway' },
  { id: 'vocab-aphasia', icon: '🧠', nameKey: 'vs_aphasia', descKey: 'vs_aphasia_desc', minTier: 'free', status: 'available', action: 'vocab-set', actionPayload: 'aphasia' },
  { id: 'vocab-social-chat', icon: '💬', nameKey: 'vs_social_chat', descKey: 'vs_social_chat_desc', minTier: 'free', status: 'available', action: 'vocab-set', actionPayload: 'social-chat' },
  { id: 'game-packs', icon: '🎮', nameKey: 'mp_game_packs', descKey: 'mp_game_packs_desc', minTier: 'standard', status: 'available', action: 'open-panel', actionPayload: 'games' },
  { id: 'voice-packs', icon: '🎙', nameKey: 'mp_voice_packs', descKey: 'mp_voice_packs_desc', minTier: 'standard', status: 'coming_soon' },
  { id: 'picture-editor', icon: '🖼', nameKey: 'mp_picture_editor', descKey: 'mp_picture_editor_desc', minTier: 'standard', status: 'coming_soon' },
  { id: 'music-composer', icon: '🎵', nameKey: 'mp_music_composer', descKey: 'mp_music_composer_desc', minTier: 'standard', status: 'coming_soon' },
  { id: 'aac-designer', icon: '🎨', nameKey: 'mp_aac_designer', descKey: 'mp_aac_designer_desc', minTier: 'advanced', status: 'coming_soon' },
  { id: 'video-composer', icon: '🎬', nameKey: 'mp_video_composer', descKey: 'mp_video_composer_desc', minTier: 'advanced', status: 'coming_soon' },
];

export default function MarketplacePanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel, openCategories, openGames } = useUIStore();
  const profile = useAuthStore((s) => s.profile);
  const settings = useSettingsStore();
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  if (sidePanel !== 'marketplace') return null;

  const userTier = profile?.plan ?? 'free';

  const handleInstall = (item: CatalogItem) => {
    tapFeedback();
    const hasAccess = TIER_RANK[userTier] >= TIER_RANK[item.minTier];
    if (!hasAccess || item.status === 'coming_soon') return;

    if (item.action === 'vocab-set' && item.actionPayload) {
      settings.update({ activeVocabSet: item.actionPayload });
      setInstalled((prev) => new Set(prev).add(item.id));
      closeSidePanel();
      setTimeout(() => openCategories(), 100);
    } else if (item.action === 'vocab-set') {
      closeSidePanel();
      // Open settings to vocab set selector
    } else if (item.action === 'open-panel') {
      closeSidePanel();
      if (item.actionPayload === 'games') setTimeout(() => openGames(), 100);
    } else if (item.action === 'settings') {
      setInstalled((prev) => new Set(prev).add(item.id));
    }
    setSelectedItem(null);
  };

  const isActive = (item: CatalogItem) => {
    if (item.action === 'vocab-set' && item.actionPayload) {
      return settings.activeVocabSet === item.actionPayload;
    }
    return installed.has(item.id);
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
          {CATALOG.map((item) => {
            const hasAccess = TIER_RANK[userTier] >= TIER_RANK[item.minTier];
            const active = isActive(item);
            const canInstall = hasAccess && item.status !== 'coming_soon';

            return (
              <button
                key={item.id}
                className={`aac-btn min-h-[clamp(100px,18vw,140px)] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 p-3 select-none relative ${
                  active ? 'bg-[#E8F5E9] border-[#4CAF50] dark:bg-[#1a3a1a]' : 'surface-key border-theme'
                } ${!canInstall ? 'opacity-50' : ''}`}
                onClick={() => {
                  tapFeedback();
                  if (canInstall) {
                    handleInstall(item);
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

      {/* Detail modal for locked/coming-soon items */}
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
              <span className="text-primary font-bold capitalize">{t(`plan_${selectedItem.minTier}`)}</span>
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
