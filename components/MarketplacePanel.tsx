'use client';
import { useState, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';

/* ── Shell ── */
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

/* ── Tier hierarchy for access checks ── */
const TIER_RANK: Record<string, number> = {
  free: 0,
  standard: 1,
  advanced: 2,
  enterprise: 3,
};

type TierReq = 'free' | 'standard' | 'advanced' | 'enterprise';

interface CatalogItem {
  id: string;
  icon: string;
  nameKey: string;
  descKey: string;
  minTier: TierReq;
  status: 'available' | 'coming_soon';
}

const CATALOG: CatalogItem[] = [
  { id: 'symbol-libraries', icon: '📚', nameKey: 'mp_symbol_libraries', descKey: 'mp_symbol_libraries_desc', minTier: 'free', status: 'available' },
  { id: 'board-templates', icon: '📋', nameKey: 'mp_board_templates', descKey: 'mp_board_templates_desc', minTier: 'free', status: 'available' },
  { id: 'game-packs', icon: '🎮', nameKey: 'mp_game_packs', descKey: 'mp_game_packs_desc', minTier: 'standard', status: 'coming_soon' },
  { id: 'voice-packs', icon: '🎙', nameKey: 'mp_voice_packs', descKey: 'mp_voice_packs_desc', minTier: 'standard', status: 'coming_soon' },
  { id: 'picture-editor', icon: '🖼', nameKey: 'mp_picture_editor', descKey: 'mp_picture_editor_desc', minTier: 'standard', status: 'coming_soon' },
  { id: 'music-composer', icon: '🎵', nameKey: 'mp_music_composer', descKey: 'mp_music_composer_desc', minTier: 'standard', status: 'coming_soon' },
  { id: 'aac-designer', icon: '🎨', nameKey: 'mp_aac_designer', descKey: 'mp_aac_designer_desc', minTier: 'advanced', status: 'coming_soon' },
  { id: 'video-composer', icon: '🎬', nameKey: 'mp_video_composer', descKey: 'mp_video_composer_desc', minTier: 'advanced', status: 'coming_soon' },
];

/* ── Detail Modal ── */
function ItemModal({ item, userTier, onClose }: { item: CatalogItem; userTier: string; onClose: () => void }) {
  const { t } = useT();
  const hasAccess = TIER_RANK[userTier] >= TIER_RANK[item.minTier];

  return (
    <div
      className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t(item.nameKey)}
    >
      <div
        className="surface-bar rounded-2xl border border-theme max-w-md w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-5xl">{item.icon}</span>
          <div className="flex-1">
            <h3 className="text-primary font-bold text-xl">{t(item.nameKey)}</h3>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${
              item.status === 'available'
                ? 'bg-[#4CAF50] text-white'
                : 'bg-[#FF9800] text-white'
            }`}>
              {item.status === 'available' ? t('available') : t('coming_soon')}
            </span>
          </div>
        </div>

        <p className="text-primary text-base">{t(item.descKey)}</p>

        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">{t('required_tier')}:</span>
          <span className="text-primary font-bold capitalize">{t(`plan_${item.minTier}`)}</span>
        </div>

        {hasAccess ? (
          <div className="flex items-center gap-2 text-[#4CAF50]">
            <span className="text-xl">✅</span>
            <span className="font-bold">{t('tier_unlocked')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#F44336]">
            <span className="text-xl">🔒</span>
            <span className="font-bold">{t('upgrade_to_unlock')}</span>
          </div>
        )}

        <button
          className="aac-btn min-h-[56px] rounded-xl surface-key text-primary font-bold text-lg border border-theme mt-2"
          onClick={() => { tapFeedback(); onClose(); }}
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}

/* ── Main MarketplacePanel ── */
export default function MarketplacePanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel } = useUIStore();
  const profile = useAuthStore((s) => s.profile);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  if (sidePanel !== 'marketplace') return null;

  const userTier = profile?.plan ?? 'free';

  const closeBtn = 'aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme';
  const headerRow = 'flex items-center justify-between px-4 py-3 border-b border-theme shrink-0';
  const headerTitle = 'text-primary font-bold text-2xl md:text-3xl';

  return (
    <PanelShell>
      <div className={headerRow}>
        <span className={headerTitle}>🏪 {t('marketplace')}</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className={closeBtn}>
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATALOG.map((item) => {
            const hasAccess = TIER_RANK[userTier] >= TIER_RANK[item.minTier];
            return (
              <button
                key={item.id}
                className="aac-btn min-h-[120px] rounded-2xl surface-key border-2 border-theme flex flex-col items-center justify-center gap-2 p-4 select-none relative"
                onClick={() => { tapFeedback(); setSelectedItem(item); }}
              >
                {/* Tier badge */}
                <span className={`absolute top-2 right-2 text-lg ${hasAccess ? '' : 'opacity-60'}`}>
                  {hasAccess ? '✅' : '🔒'}
                </span>

                <span className={`text-4xl ${hasAccess ? '' : 'opacity-50'}`}>{item.icon}</span>
                <span className={`text-primary font-bold text-sm text-center ${hasAccess ? '' : 'opacity-60'}`}>
                  {t(item.nameKey)}
                </span>

                {/* Status badge */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  item.status === 'available'
                    ? 'bg-[#4CAF50] text-white'
                    : 'bg-[#FF9800] text-white'
                }`}>
                  {item.status === 'available' ? t('available') : t('coming_soon')}
                </span>
              </button>
            );
          })}
        </div>

        {selectedItem && (
          <ItemModal
            item={selectedItem}
            userTier={userTier}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </div>
    </PanelShell>
  );
}
