'use client';
/**
 * AlertConfirmModal — Send/Cancel confirmation for the 🚨 alert button.
 *
 * Mirrors the Watch's confirmation dialog: tap Send → SMS dispatched to
 * the primary caregiver via sendAlertToCaregiver; tap Cancel → close.
 * Both buttons are oversized for AAC users with coarse motor control.
 */
import { useUIStore } from '@/store/uiStore';
import { useT } from '@/engine/useT';
import { resolvePrimaryCaregiver } from '@/services/sendAlertToCaregiver';
import { tapFeedback } from '@/services/feedback';

export default function AlertConfirmModal() {
  const open = useUIStore((s) => s.alertConfirmOpen);
  const status = useUIStore((s) => s.alertSendStatus);
  const confirmAlertSend = useUIStore((s) => s.confirmAlertSend);
  const dismissAlertConfirm = useUIStore((s) => s.dismissAlertConfirm);
  const { t } = useT();

  if (!open && !status) return null;

  // Resolve caregiver lazily so the modal can preview "Send to: Mom".
  // Falls back to a generic label when no contact configured (Send is
  // still tappable; the action surfaces the no_caregiver error state).
  const caregiver = open ? resolvePrimaryCaregiver() : null;
  const recipientLabel = caregiver
    ? caregiver.name
    : t('alert_no_caregiver_configured');

  if (open) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('alert_confirm_title')}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      >
        <div
          className="surface-bar border border-theme rounded-2xl p-6 max-w-md w-full space-y-4"
          data-testid="alert-confirm-modal"
        >
          <div className="text-center space-y-2">
            <div className="text-5xl">🚨</div>
            <h2 className="text-2xl font-bold text-primary">{t('alert_confirm_title')}</h2>
            <p className="text-base text-muted">
              {t('alert_confirm_body')}
              {' '}
              <span className="font-semibold text-primary">{recipientLabel}</span>
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { tapFeedback(); dismissAlertConfirm(); }}
              data-testid="alert-cancel"
              className="aac-btn flex-1 rounded-xl py-4 text-xl font-bold surface-key text-primary border border-theme"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => { tapFeedback(); void confirmAlertSend(); }}
              data-testid="alert-send"
              className="aac-btn flex-1 rounded-xl py-4 text-xl font-bold bg-[#F44336] text-white"
            >
              {t('send')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Status toast — shows briefly after confirm/cancel. Auto-clears in store.
  const statusText =
    status === 'sending' ? t('alert_status_sending')
    : status === 'sent' ? t('alert_status_sent')
    : status === 'failed_no_caregiver' ? t('alert_status_no_caregiver')
    : t('alert_status_failed');
  const statusColor =
    status === 'sent' ? 'bg-[#4CAF50]'
    : status === 'sending' ? 'bg-[#2563eb]'
    : 'bg-[#F44336]';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ${statusColor} text-white text-lg font-bold px-6 py-3 rounded-full shadow-lg`}
      data-testid="alert-status-toast"
    >
      {statusText}
    </div>
  );
}
