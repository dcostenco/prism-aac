'use client';
import type { ModuleManifest, ModuleTier } from '@/lib/marketplace/types';
import { tierAllows } from '@/lib/marketplace/types';
import { useT } from '@/engine/useT';

interface Props {
  manifest: ModuleManifest;
  userTier: ModuleTier;
  active: boolean;
  hasUpdate?: boolean;
  onInstall: (m: ModuleManifest) => void;
  onLocked: (m: ModuleManifest) => void;
}

/**
 * One marketplace catalog tile. Renders 4 visual states:
 *   active    — installed AND currently the active vocab/voice/etc.
 *   available — tier OK + status === 'available' + not active
 *   locked    — tier OK but status === 'coming_soon'
 *   gated     — tier insufficient (regardless of status)
 *
 * Phase 1 used this layout inline in MarketplacePanel; Phase 2 extracts it
 * so the panel can compose it with tabs / search / detail without a 1800-LOC
 * single file.
 */
export default function MarketplaceCard({ manifest, userTier, active, hasUpdate, onInstall, onLocked }: Props) {
  const { t } = useT();
  const hasAccess = tierAllows(userTier, manifest.tier);
  const canInstall = hasAccess && manifest.status === 'available';

  const badgeText = active
    ? t('mp_active')
    : manifest.status === 'available'
    ? t('mp_tap_install')
    : t('coming_soon');

  const badgeClass = active
    ? 'bg-[#4CAF50] text-white'
    : manifest.status === 'available'
    ? 'bg-[#2196F3] text-white'
    : 'bg-[#FF9800] text-white';

  return (
    <button
      key={manifest.slug}
      data-testid={`mp-card-${manifest.slug}`}
      aria-label={t(manifest.nameKey)}
      className={`aac-btn min-h-[clamp(100px,18vw,140px)] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 p-3 select-none relative ${
        active ? 'bg-[#E8F5E9] border-[#4CAF50] dark:bg-[#1a3a1a]' : 'surface-key border-theme'
      } ${!canInstall ? 'opacity-50' : ''}`}
      onClick={() => (canInstall ? onInstall(manifest) : onLocked(manifest))}
    >
      <span className="absolute top-2 right-2 text-sm" aria-hidden="true">
        {active ? '✅' : canInstall ? '➕' : '🔒'}
      </span>
      {hasUpdate && (
        <span
          className="absolute top-2 left-2 bg-[#FF5722] text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
          aria-label={t('mp_update_available')}
          data-testid={`mp-update-badge-${manifest.slug}`}
        >
          {t('mp_update_available')}
        </span>
      )}
      <span className="text-3xl md:text-4xl">{manifest.icon}</span>
      <span className="text-primary font-bold text-xs md:text-sm text-center leading-tight">
        {t(manifest.nameKey)}
      </span>
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>{badgeText}</span>
    </button>
  );
}
