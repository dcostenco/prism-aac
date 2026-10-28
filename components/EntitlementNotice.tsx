'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/engine/useT';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchWebAccess, type AacEntitlement } from '@/services/webAccessService';
import { fetchAacBillingStatus, manageAacSubscription } from '@/services/aacBillingService';

const RECHECK_MS = 5 * 60_000;
const DAY_MS = 86_400_000;
export const PAID_NOTICE_DISMISS_KEY = 'prism-aac-paid-notice-dismissed';

/** The local calendar day, so "until tomorrow" follows the user's clock. */
function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** An opaque tag for the account, so a shared device's storage does not hold the email. */
function accountTag(account: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < account.length; i++) hash = Math.imul(hash ^ account.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(36);
}

function dismissedToday(account: string): boolean {
  try {
    const value = JSON.parse(localStorage.getItem(PAID_NOTICE_DISMISS_KEY) ?? 'null') as { account?: string; day?: string } | null;
    return value?.account === accountTag(account) && value.day === localDay();
  } catch { return false; }
}

function formatDate(language: string, date: Date): string {
  try { return new Intl.DateTimeFormat(language || 'en', { dateStyle: 'long' }).format(date); }
  catch { return new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(date); }
}

/**
 * The paid-plan notices above the board: a countdown to the paid plan, which
 * can be hidden until tomorrow, and a payment-failed notice during a billing
 * grace, which stays until payment is fixed. Nothing else is shown, and nothing
 * here locks or changes communication. No build flag: the server decides. It
 * sends an entitlement only while its paid-only policy is in force
 * (AAC_PAID_ONLY_POLICY on or cohort, with AAC_PAID_ONLY_CUTOVER_AT set), so
 * the notices appear for everyone the moment that is switched on, and vanish
 * the moment it is switched off.
 */
export default function EntitlementNotice() {
  const account = useAuthStore(s => s.profile?.email)?.toLowerCase() ?? '';
  const language = useSettingsStore(s => s.language);
  const { t, rtl } = useT();
  // Bound to the account it was read for, so a switched account never sees another's notice.
  const [read, setRead] = useState<{ account: string; entitlement: AacEntitlement | null; at: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [details, setDetails] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);
  const updating = useRef(false);

  useEffect(() => {
    if (!account) return;
    let active = true;
    const check = async () => {
      try {
        const access = await fetchWebAccess();
        if (!active) return;
        setRead({ account, entitlement: access.entitlement ?? null, at: Date.now() });
        // A device left open for days shows the countdown again the next day.
        setHidden(dismissedToday(account));
      } catch { /* Keep the last answer: a failed check never invents a notice. */ }
    };
    // Deferred out of the effect body; the async answer owns the state change.
    queueMicrotask(() => { if (active) setHidden(dismissedToday(account)); });
    void check();
    const focus = () => { void check(); };
    window.addEventListener('focus', focus);
    const refresh = setInterval(focus, RECHECK_MS);
    return () => { active = false; clearInterval(refresh); window.removeEventListener('focus', focus); };
  }, [account]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(PAID_NOTICE_DISMISS_KEY, JSON.stringify({ account: accountTag(account), day: localDay() })); } catch { /* hidden for this session */ }
    setHidden(true);
  }, [account]);

  const update = useCallback(async () => {
    // A second tap while one is opening must not open a second billing session.
    if (updating.current) return;
    updating.current = true;
    setUpdateFailed(false);
    try {
      const billing = await fetchAacBillingStatus();
      if (!billing.manageChannel) throw new Error('No subscription to manage');
      await manageAacSubscription(billing.manageChannel);
    } catch { setUpdateFailed(true); } finally { updating.current = false; }
  }, []);

  const entitlement = read?.account === account ? read.entitlement : null;
  if (!account || !entitlement?.accessUntil) return null;
  const until = new Date(entitlement.accessUntil);
  const date = formatDate(language, until);

  if (entitlement.state === 'grace') {
    return <div dir={rtl ? 'rtl' : 'ltr'} data-testid="aac-grace-notice"
      className="shrink-0 flex flex-col items-center justify-center sm:flex-row sm:gap-x-3 text-center text-xs px-3 py-1 bg-amber-100 text-amber-950">
      <p role="status" aria-live="polite">{t('aac_grace_notice')}</p>
      <button type="button" onClick={() => { void update(); }} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 font-semibold underline">{t('aac_grace_update')}</button>
      {updateFailed && <p role="alert">{t('aac_grace_update_failed')}</p>}
    </div>;
  }

  if (entitlement.state !== 'pre_cutover_free' || hidden) return null;
  // Counted from the last check (every five minutes and on focus), not during render.
  const days = Math.max(0, Math.ceil((until.getTime() - (read?.at ?? until.getTime())) / DAY_MS));
  return <div dir={rtl ? 'rtl' : 'ltr'} data-testid="aac-paid-notice"
    className="shrink-0 flex flex-col items-center justify-center text-center text-xs px-3 py-1 bg-slate-900 text-white">
    <div className="flex flex-wrap items-center justify-center gap-x-3">
      <p role="status" aria-live="polite">
        {t('aac_paid_notice').replace('{date}', date).replace('{days}', String(days))}
      </p>
      <button type="button" aria-expanded={details} onClick={() => setDetails(open => !open)} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 underline">
        {details ? t('aac_paid_notice_hide') : t('aac_paid_notice_see')}
      </button>
      <button type="button" onClick={dismiss} aria-label={t('aac_paid_notice_dismiss')} title={t('aac_paid_notice_dismiss')}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-lg leading-none">×</button>
    </div>
    {details && <p className="mt-1 max-w-prose">{t('aac_paid_notice_details').replace('{date}', date)}</p>}
  </div>;
}
