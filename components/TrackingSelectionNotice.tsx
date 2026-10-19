'use client';

import { useT } from '@/engine/useT';

/** Reserve space for inactive camera status instead of covering AAC controls. */
export default function TrackingSelectionNotice({ title, message, testId, paused, onRetry }: {
  title: string;
  message?: string;
  testId: string;
  paused: boolean;
  onRetry: () => void;
}) {
  const { t } = useT();
  return (
    <div className="shrink-0 surface-bar px-3 py-1 flex items-center gap-2"
      role="status" aria-live="polite" data-testid={testId} data-scan-group={testId}>
      <span className="min-w-0 flex-1 text-primary text-sm">
        {message ?? `${title}: ${t(paused ? 'camera_selection_paused' : 'tracking_unavailable')}`}
      </span>
      {!paused && <button type="button" onClick={onRetry}
        className="aac-btn min-h-[48px] min-w-[96px] px-3 rounded-xl surface-key font-bold border border-theme">
        {t('try_again')}
      </button>}
    </div>
  );
}
