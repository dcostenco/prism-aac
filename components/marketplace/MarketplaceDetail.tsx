'use client';
import { useState } from 'react';
import { useT } from '@/engine/useT';
import type { ModuleManifest, ModuleTier } from '@/lib/marketplace/types';
import { tierAllows } from '@/lib/marketplace/types';
import { tapFeedback } from '@/services/feedback';

interface Props {
  manifest: ModuleManifest;
  userTier: ModuleTier;
  installed: boolean;
  active: boolean;
  hasUpdate: boolean;
  onClose: () => void;
  onInstall: (m: ModuleManifest) => void;
  onUninstall: (m: ModuleManifest) => void;
}

/**
 * Detail modal — replaces the tiny upgrade-only popup from Phase 1.
 *
 * Shows: hero (icon + name + tier + status badge), description, screenshots
 * carousel (if any), changelog (if any), dependencies (if any), and a primary
 * action button (Install / Uninstall / Upgrade-required / Coming-soon).
 *
 * Uninstall has a 2-step confirm to avoid accidental taps on a single-tap
 * AAC interface.
 */
export default function MarketplaceDetail({
  manifest,
  userTier,
  installed,
  active,
  hasUpdate,
  onClose,
  onInstall,
  onUninstall,
}: Props) {
  const { t } = useT();
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);
  const [shotIdx, setShotIdx] = useState(0);
  const hasAccess = tierAllows(userTier, manifest.tier);
  const canInstall = hasAccess && manifest.status === 'available';
  const screenshots = manifest.screenshots ?? [];

  const primary = (() => {
    if (manifest.status === 'coming_soon') {
      return { label: t('coming_soon'), disabled: true, action: () => {} };
    }
    if (!hasAccess) {
      return { label: t('upgrade_to_unlock'), disabled: true, action: () => {} };
    }
    if (installed && confirmingUninstall) {
      return {
        label: t('mp_uninstall_confirm'),
        disabled: false,
        action: () => { tapFeedback(); onUninstall(manifest); setConfirmingUninstall(false); },
      };
    }
    if (installed) {
      return {
        label: t('mp_uninstall'),
        disabled: false,
        action: () => { tapFeedback(); setConfirmingUninstall(true); },
      };
    }
    return {
      label: t('mp_tap_install'),
      disabled: !canInstall,
      action: () => { tapFeedback(); onInstall(manifest); },
    };
  })();

  return (
    <div
      className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 p-4"
      onClick={() => { tapFeedback(); onClose(); }}
      role="dialog"
      aria-modal="true"
      data-testid="mp-detail"
    >
      <div
        className="surface-bar rounded-2xl border border-theme max-w-md w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="flex items-start gap-3">
          <span className="text-5xl" aria-hidden="true">{manifest.icon}</span>
          <div className="flex-1">
            <h3 className="text-primary font-bold text-xl">{t(manifest.nameKey)}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {active && (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-[#4CAF50] text-white">
                  {t('mp_active')}
                </span>
              )}
              {installed && !active && (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-[#9E9E9E] text-white">
                  {t('mp_installed')}
                </span>
              )}
              {hasUpdate && (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-[#FF5722] text-white">
                  {t('mp_update_available')}
                </span>
              )}
              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-[#2196F3] text-white capitalize">
                {t(`plan_${manifest.tier}`)}
              </span>
              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold surface-key text-muted border border-theme">
                v{manifest.version}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-primary text-base">{t(manifest.descKey)}</p>

        {/* Screenshots — if present */}
        {screenshots.length > 0 && (
          <div className="flex flex-col gap-2" data-testid="mp-screenshots">
            <div className="relative aspect-video surface-key rounded-xl overflow-hidden border border-theme">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshots[shotIdx]}
                alt={t(manifest.nameKey)}
                className="w-full h-full object-cover"
              />
            </div>
            {screenshots.length > 1 && (
              <div className="flex justify-center gap-1">
                {screenshots.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`screenshot ${i + 1}`}
                    onClick={() => { tapFeedback(); setShotIdx(i); }}
                    className={`w-2 h-2 rounded-full ${i === shotIdx ? 'bg-[#2196F3]' : 'bg-muted/40'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dependencies */}
        {manifest.deps && manifest.deps.length > 0 && (
          <div data-testid="mp-deps">
            <p className="text-muted text-sm font-bold mb-1">{t('mp_dependencies')}</p>
            <ul className="text-primary text-sm list-disc list-inside">
              {manifest.deps.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Changelog */}
        {manifest.changelog && manifest.changelog.length > 0 && (
          <div data-testid="mp-changelog">
            <p className="text-muted text-sm font-bold mb-1">{t('mp_changelog')}</p>
            <ul className="text-primary text-sm flex flex-col gap-1">
              {manifest.changelog.map((c) => (
                <li key={c.version}>
                  <span className="font-bold">v{c.version}</span> — {c.notes}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action */}
        <button
          data-testid="mp-detail-action"
          disabled={primary.disabled}
          onClick={primary.action}
          className={`aac-btn min-h-[56px] rounded-xl font-bold text-lg border ${
            primary.disabled
              ? 'surface-key text-muted border-theme opacity-60 cursor-not-allowed'
              : confirmingUninstall
              ? 'bg-[#F44336] text-white border-[#F44336]'
              : 'bg-[#2196F3] text-white border-[#2196F3]'
          }`}
        >
          {primary.label}
        </button>
        {confirmingUninstall && (
          <button
            data-testid="mp-detail-cancel-uninstall"
            onClick={() => { tapFeedback(); setConfirmingUninstall(false); }}
            className="aac-btn min-h-[44px] rounded-xl surface-key text-primary text-sm border border-theme"
          >
            {t('cancel')}
          </button>
        )}

        {/* Close */}
        <button
          data-testid="mp-detail-close"
          onClick={() => { tapFeedback(); onClose(); }}
          className="aac-btn min-h-[44px] rounded-xl surface-key text-muted text-base border border-theme"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
