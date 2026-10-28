'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '@/engine/useT';
import { useAuthStore } from '@/store/authStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { fetchWebAccess } from '@/services/webAccessService';
import { clearLease, storeLease, storedLease, storedLeaseAccount } from '@/services/aacLease';
import { decideLock, isEntitledState, type LockDecision } from '@/services/paidPlanLock';
import { AAC_BILLING_UPDATED, hasNativePurchases } from '@/services/aacBillingService';
import { usePaidPlanStore } from '@/store/paidPlanStore';
import { isPrismBrowserShell, isPrismNativeShell, reportOfflineAccess } from '@/services/nativeShell';
import { synaluxSignInUrl } from '@/services/aiService';
import { copyBoardExport } from '@/services/boardExport';
import { speakComposedMessage } from '@/services/speakMessage';
import { loadCards } from '@/services/bedsideCards';
import { getConfig as getEmergencyConfig, triggerEmergency } from '@/services/emergencyService';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import CloudSubscriptionSettings from '@/components/CloudSubscriptionSettings';

const RECHECK_MS = 5 * 60_000;
/** Returning after this long away is a session boundary, like a launch. */
const IDLE_MS = 10 * 60_000;
export const POLICY_SEEN_KEY = 'prism-aac-paid-policy-seen';
const SAFETY_CATEGORY = 'help-needs';

function readPolicySeen(): boolean {
  try { return localStorage.getItem(POLICY_SEEN_KEY) === '1'; } catch { return false; }
}
function writePolicySeen(seen: boolean) {
  try { if (seen) localStorage.setItem(POLICY_SEEN_KEY, '1'); else localStorage.removeItem(POLICY_SEEN_KEY); } catch { /* memory only */ }
}

/**
 * The paid-plan lock (build flag NEXT_PUBLIC_AAC_PAID_ONLY_LOCK). A covering
 * layer, not a replacement: the app stays mounted underneath, so its emergency
 * countdown, alert confirmation and panic listeners keep running and draw above
 * this layer. A lock applies only at a session boundary (launch, sign-in or
 * account switch, return after IDLE_MS) and never while a message is being
 * composed; unlocking applies at once. The Safety panel speaks the Help / Needs
 * phrases and bedside cards through the normal speak path, so emergency
 * detection runs as it does on the board, and a critical phrase still starts
 * the critical countdown. The Emergency button starts the urgent countdown the
 * board starts for "I need help": a full countdown with Cancel, so a stray tap
 * on the largest target can be stopped, then the same dispatch, which falls
 * back to the phone's own email, SMS, WhatsApp and calling, so it reaches
 * someone on any plan. With emergency dispatch turned off in Settings it opens
 * the toolbar's caregiver alert instead, so a press always does something.
 */
export default function PaidPlanLock() {
  const enabled = process.env.NEXT_PUBLIC_AAC_PAID_ONLY_LOCK === '1';
  const account = useAuthStore(s => s.profile?.email)?.toLowerCase() ?? '';
  const authLoaded = useAuthStore(s => s.loaded);
  // Offline, the profile lookup cannot confirm who is signed in. That is not a
  // sign-out (signing out removes the lease), so the stored lease still counts.
  const identityUnknown = useAuthStore(s => s.identityUnknown);
  const language = useSettingsStore(s => s.language);
  const composing = useMessageStore(s => s.text.trim().length > 0);
  const { t, rtl } = useT();
  const [applied, setApplied] = useState<LockDecision>('unlocked');
  const [exported, setExported] = useState(false);
  const boundary = useRef(true);
  const pendingLock = useRef(false);
  const composingRef = useRef(composing);
  const layer = useRef<HTMLDivElement>(null);
  const lastAccount = useRef<string | null>(null);

  useEffect(() => { composingRef.current = composing; }, [composing]);

  // A decision at a session boundary consumes it. A lock outside one waits for
  // the next boundary, so a check later in a session never locks mid-use.
  const apply = useCallback((decision: LockDecision) => {
    if (decision !== 'locked') {
      boundary.current = false; pendingLock.current = false; setApplied(decision); return;
    }
    if (!boundary.current) return;
    if (composingRef.current) { pendingLock.current = true; return; }
    boundary.current = false; pendingLock.current = false; setApplied('locked');
  }, []);

  const check = useCallback(async (active: () => boolean, fresh = false) => {
    const native = isPrismNativeShell();
    let online: Parameters<typeof decideLock>[0]['online'] = 'unreachable';
    try {
      const access = await fetchWebAccess({ fresh });
      online = { entitlement: access.entitlement, paidPlan: access.paidPlan === true,
        unreadable: access.entitlementUnreadable === true };
      // The server says whether its policy is in force, signed in or not. A reply
      // without it means the policy is off: forget it was ever seen, so a
      // rolled-back policy cannot lock anyone offline.
      writePolicySeen(Boolean(access.paidPlan || access.entitlement || access.entitlementUnreadable));
      // Keep the lease for the account the server answered for. With identity
      // unknown (the profile lookup failed but the cookie works) it is kept
      // unbound, so it keeps renewing; the next confirmed account rebinds it.
      const storeAs = account || (identityUnknown ? '' : null);
      if (access.lease && storeAs !== null) await storeLease(access.lease, storeAs);
      // Another account's lease, or one the server now says is not entitled,
      // must not carry this device through the next offline launch.
      else if ((account && storedLeaseAccount() !== null && storedLeaseAccount() !== account)
        || (access.entitlement && !isEntitledState(access.entitlement.state))) clearLease();
      // The app's offline page mirrors this lock offline: tell it what holds now.
      if (native) {
        const kept = storeAs === null ? null : await storedLease(storeAs || null);
        reportOfflineAccess({ policySeen: readPolicySeen(), leaseUntil: kept ? kept.exp * 1000 : null });
      }
    } catch { /* decided from the stored lease below */ }
    const leaseAccount = account || (identityUnknown ? null : '');
    const lease = online === 'unreachable' && leaseAccount !== '' ? await storedLease(leaseAccount) : null;
    if (!active()) return;
    apply(decideLock({ enabled, native, nativePurchases: hasNativePurchases(),
      online, policySeen: readPolicySeen(), leaseState: lease?.st ?? null }));
  }, [account, identityUnknown, apply, enabled]);

  useEffect(() => {
    if (!enabled || !authLoaded) return;
    let alive = true;
    const active = () => alive;
    // A new account (or sign-in) is a session boundary, and the last account's
    // decision does not carry over. A passing identity hiccup (the profile
    // lookup failing for a moment) is neither: the board keeps its state.
    const accountChanged = lastAccount.current !== account;
    lastAccount.current = account;
    if (accountChanged) boundary.current = true;
    // Deferred out of the effect body, as the sign-in gate does.
    const initial = setTimeout(() => {
      if (!alive) return;
      if (accountChanged) setApplied('unlocked');
      void check(active);
    }, 0);
    let hiddenAt: number | null = null;
    const visibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt !== null && Date.now() - hiddenAt >= IDLE_MS) boundary.current = true;
      hiddenAt = null;
      void check(active);
    };
    const focus = () => { void check(active); };
    const purchased = () => { void check(active, true); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', focus);
    // A purchase or restore that lands unlocks at once, even where the native
    // purchase sheet returns without a focus event.
    window.addEventListener(AAC_BILLING_UPDATED, purchased);
    const refresh = setInterval(focus, RECHECK_MS);
    return () => {
      alive = false; clearTimeout(initial); clearInterval(refresh);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focus);
      window.removeEventListener(AAC_BILLING_UPDATED, purchased);
    };
  }, [enabled, authLoaded, account, identityUnknown, check]);

  // A lock that waited for a message to finish applies once it is cleared.
  useEffect(() => {
    if (!composing && pendingLock.current && boundary.current) apply('locked');
  }, [composing, apply]);

  useEffect(() => {
    if (applied === 'locked') layer.current?.querySelector<HTMLElement>('h1')?.focus();
    usePaidPlanStore.getState().setLocked(applied === 'locked');
  }, [applied]);
  useEffect(() => () => usePaidPlanStore.getState().setLocked(false), []);

  // Keep keyboard focus inside the lock; the app's own modals render above it.
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !layer.current) return;
    const items = [...layer.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (!enabled) return null;

  if (applied === 'update_app') {
    return <div dir={rtl ? 'rtl' : 'ltr'} data-testid="aac-update-app" role="status"
      className="shrink-0 px-3 py-2 text-center text-xs bg-amber-100 text-amber-950">
      {/* The Prism Browser app cannot buy in-app and no update gives it that:
          point to the Prism AAC app, where the subscription can be started. */}
      {t(isPrismBrowserShell() ? 'aac_lock_browser_subscribe' : 'aac_lock_update_app')}</div>;
  }
  if (applied !== 'locked') return null;

  const safetyPhrases = DEFAULT_PHRASES.filter(p => p.categoryId === SAFETY_CATEGORY && !p.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const speak = (text: string) => { void speakComposedMessage(text); };
  const emergency = () => {
    if (getEmergencyConfig().enabled) void triggerEmergency(t('aac_lock_emergency'), 'urgent', () => {}, () => {});
    else useUIStore.getState().triggerAlert();
  };
  const tile = 'aac-btn min-h-[56px] rounded-xl px-3 py-2 text-base font-semibold surface-key text-primary border border-theme';

  return <div ref={layer} dir={rtl ? 'rtl' : 'ltr'} data-testid="aac-paid-lock" role="dialog" aria-modal="true"
    aria-labelledby="aac-paid-lock-title" onKeyDown={trapFocus}
    className="fixed inset-0 z-40 overflow-y-auto surface-bar text-primary">
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <section className="space-y-3 text-center">
        <h1 id="aac-paid-lock-title" tabIndex={-1} className="text-2xl font-bold outline-none">{t('aac_lock_title')}</h1>
        <p className="text-sm text-muted">{t('aac_lock_saved')}</p>
        {account
          ? <div className="text-start"><CloudSubscriptionSettings key={account} /></div>
          : <a href={synaluxSignInUrl()} className="aac-btn inline-flex min-h-[44px] items-center rounded-xl px-4 font-semibold bg-[#4CAF50] text-white"
            data-testid="aac-lock-sign-in">{t('sign_in_with_synalux')}</a>}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="aac-btn min-h-[44px] rounded-xl px-4 font-semibold surface-key border border-theme"
            onClick={() => { void copyBoardExport().then(() => setExported(true), () => setExported(false)); }}>
            📋 {t('export_clipboard')}
          </button>
          <button type="button" className="aac-btn min-h-[44px] rounded-xl px-4 font-semibold surface-key border border-theme"
            onClick={() => { boundary.current = true; void check(() => true); }}>
            {t('aac_lock_check_again')}
          </button>
        </div>
        {exported && <p role="status" className="text-xs text-muted">{t('aac_lock_export_done')}</p>}
      </section>

      <section aria-labelledby="aac-lock-safety" className="space-y-3 rounded-2xl border border-theme p-3" data-testid="aac-lock-safety">
        <h2 id="aac-lock-safety" className="text-lg font-bold">{t('aac_lock_safety')}</h2>
        <h3 className="text-sm font-semibold">{t('cat_help_needs')}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {safetyPhrases.map(p => {
            const text = getPhraseText(p.id, language, p.text);
            return <button key={p.id} type="button" className={tile} onClick={() => speak(text)}>{text}</button>;
          })}
        </div>
        <h3 className="text-sm font-semibold">{t('aac_lock_bedside')}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="aac-lock-bedside">
          {loadCards().map(card => <button key={card.id} type="button" className={tile} onClick={() => speak(card.text)}>
            {card.icon} {card.text}
          </button>)}
        </div>
      </section>
      {/* Pinned to the bottom of the screen while the rest scrolls: Emergency is
          never below the fold, on any screen or in any language. */}
      <div className="sticky bottom-0 -mx-4 surface-bar px-4 pb-4 pt-2">
        <button type="button" data-testid="aac-lock-emergency" onClick={emergency}
          className="aac-btn w-full min-h-[64px] rounded-xl text-xl font-bold bg-red-600 text-white">🚨 {t('aac_lock_emergency')}</button>
      </div>
    </div>
  </div>;
}
