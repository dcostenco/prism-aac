'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { hasNativePurchases, restoreAacApplePurchases } from '@/services/aacBillingService';

const RETRY_MS = 30_000;
const REFRESH_MS = 5 * 60_000;
/**
 * Focus/online events are frequent on an AAC device. The portal meters delivery
 * separately from purchase (120/hour vs 10/hour) precisely so this loop cannot
 * spend the budget a person needs to subscribe; this interval keeps one device
 * well inside the delivery budget even with several sharing an account.
 */
const MIN_EVENT_INTERVAL_MS = 60_000;

/** App-lifetime delivery; StoreKit retains transactions until server acknowledgement. */
export default function ApplePurchaseRecovery() {
  const account = useAuthStore(s => s.profile?.email);
  useEffect(() => {
    if (!account || !hasNativePurchases()) return;
    let active = true;
    let running = false;
    let again = false;
    let failures = 0;
    let lastStartedAt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const sync = async () => {
      clearTimeout(timer);
      if (!active || useAuthStore.getState().profile?.email !== account) return;
      if (running) { again = true; return; }
      running = true;
      lastStartedAt = Date.now();
      let delay = REFRESH_MS;
      try { await restoreAacApplePurchases(false, account); failures = 0; }
      catch (error) {
        // Back off on repeated outages instead of hitting the portal every 30 s.
        delay = Math.min(REFRESH_MS, RETRY_MS * 2 ** Math.min(failures, 4));
        failures += 1;
        console.warn('[AAC billing] Purchase delivery deferred; will retry', error);
      }
      running = false;
      if (active) timer = setTimeout(sync, again ? 0 : delay);
      again = false;
    };
    // StoreKit changes are authoritative and sync immediately. Window events are
    // only a hint: after a successful sync they run at most once a minute, but a
    // failed delivery (for example, offline) may retry as soon as connectivity returns.
    const hint = () => { if (failures > 0 || Date.now() - lastStartedAt >= MIN_EVENT_INTERVAL_MS) void sync(); };
    timer = setTimeout(sync, 0);
    window.addEventListener('prismSubscriptionChanged', sync);
    window.addEventListener('online', hint);
    window.addEventListener('focus', hint);
    return () => {
      active = false; clearTimeout(timer);
      window.removeEventListener('prismSubscriptionChanged', sync);
      window.removeEventListener('online', hint);
      window.removeEventListener('focus', hint);
    };
  }, [account]);
  return null;
}
