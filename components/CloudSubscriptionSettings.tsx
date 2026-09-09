'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/engine/useT';
import { useAuthStore } from '@/store/authStore';
import { isNativeiOS, type SynaluxProfile } from '@/services/aiService';
import { fetchAacBillingStatus, hasNativePurchases, manageAacSubscription, nativeSubscription,
  purchaseAacWithApple, purchaseAacWithStripe, restoreAacApplePurchases, AAC_BILLING_UPDATED, type AacBillingStatus } from '@/services/aacBillingService';
import { reportCloudPlan, type CloudPlanEvent } from '@/services/monetizationTelemetry';

export default function CloudSubscriptionSettings() {
  const { t } = useT();
  const profile = useAuthStore(s => s.profile);
  const account = profile?.email;
  const [billing, setBilling] = useState<AacBillingStatus | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const native = typeof window !== 'undefined' && isNativeiOS();
  // The panel is one component on both surfaces; the tag is what separates them.
  const platform = native ? 'ios' as const : 'web' as const;

  const refresh = useCallback(async () => {
    const identity = account;
    const result = await fetchAacBillingStatus();
    if (useAuthStore.getState().profile?.email === identity) setBilling(result);
    if (native && hasNativePurchases() && result.enabled && !result.betaExempt) {
      const product = await nativeSubscription('product');
      if (useAuthStore.getState().profile?.email === identity && product.id === result.offer.appleProductId && product.displayPrice) {
        setPrice(product.displayPrice);
      }
    }
  }, [account, native]);

  useEffect(() => {
    let active = true;
    if (!account) return;
    void fetchAacBillingStatus().then(result => {
      if (active) setBilling(result);
      if (active && native && hasNativePurchases() && !result.betaExempt && result.enabled) {
        void nativeSubscription('product').then(product => {
          if (active && product.id === result.offer.appleProductId && product.displayPrice) setPrice(product.displayPrice);
        }).catch(e => { if (active) setError(e.message); });
      }
    }).catch(e => { if (active) setError(e.message); });
    const sync = () => {
      if (!hasNativePurchases()) return;
      void restoreAacApplePurchases(false, account).then(value => { if (active) setBilling(value); })
        .catch(e => { if (active) setError(e.message); });
    };
    if (native) sync();
    const updated = () => { void refresh().catch(e => { if (active) setError(e.message); }); };
    window.addEventListener(AAC_BILLING_UPDATED, updated);
    return () => { active = false; window.removeEventListener(AAC_BILLING_UPDATED, updated); };
  }, [account, native, refresh]);

  const act = async (failure: CloudPlanEvent, operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (e) {
      reportCloudPlan(failure, platform);
      setError(e instanceof Error ? e.message : t('cloud_plan_unavailable'));
    }
    finally { setBusy(false); }
  };

  const purchase = () => act('purchase_failed', async () => {
    if (!billing?.offer.version || useAuthStore.getState().profile?.email !== account) {
      await refresh();
      return;
    }
    reportCloudPlan('purchase_started', platform);
    if (native) {
      const result = await purchaseAacWithApple(billing.userId, billing.offer.version);
      if (useAuthStore.getState().profile?.email !== account) return;
      if (result.billing) setBilling(result.billing);
      // One expression decides both what the user is told and what is reported,
      // so the funnel cannot drift away from the visible outcome.
      const outcome: CloudPlanEvent = result.status === 'pending' ? 'purchase_pending'
        : result.status === 'cancelled' ? 'purchase_cancelled'
          : result.billing?.hasCloudAccess ? 'purchase_complete' : 'purchase_none';
      reportCloudPlan(outcome, platform);
      setNotice(t(outcome === 'purchase_pending' ? 'cloud_purchase_pending'
        : outcome === 'purchase_cancelled' ? 'cloud_purchase_cancelled'
          : outcome === 'purchase_complete' ? 'cloud_purchase_complete' : 'cloud_no_active_subscription'));
    } else {
      // Stripe owns everything after the redirect; this is the web terminal event.
      reportCloudPlan('purchase_redirected', platform);
      await purchaseAacWithStripe(billing.userId, billing.offer.version);
    }
  });

  const quotedPrice = native ? price : billing ? `US$${billing.offer.usdMonthly.toFixed(2)}` : null;
  const canPurchase = Boolean(billing?.enabled && !billing.betaExempt && !billing.purchaseBlocked && billing.channels.length === 0
    && quotedPrice && billing.offer.version && (!native || hasNativePurchases())
    && (billing.offer.monthlySpeechCharacters ?? 0) > 0 && (billing.offer.monthlyAiRequests ?? 0) > 0);
  // Once per mount. A billing refresh can briefly withdraw the offer and
  // restore it (a slow product lookup, a status poll); without this the funnel
  // would count one visitor as several.
  const offerReported = useRef(false);
  useEffect(() => {
    if (!canPurchase || offerReported.current) return;
    offerReported.current = true;
    reportCloudPlan('offer_shown', platform);
  }, [canPurchase, platform]);

  if (!account) return null;
  // The legacy profile plan does not include Apple/Stripe AAC entitlements.
  // Keep the summary on the same verified state as purchase and restore.
  let summaryKey = error ? 'cloud_subscription_unknown' : 'cloud_subscription_checking';
  if (billing) {
    if (billing.hasCloudAccess && billing.channels.length > 0) summaryKey = 'cloud_subscription_active';
    else if (billing.betaExempt) summaryKey = 'cloud_subscription_beta';
    else if (billing.hasCloudAccess && billing.transitionEndsAt) summaryKey = 'cloud_subscription_transition';
    else if (billing.hasCloudAccess) summaryKey = 'cloud_subscription_included';
    else if (billing.purchaseBlocked) summaryKey = 'cloud_subscription_attention';
    else if (!billing.enabled) summaryKey = PLAN_LABEL_KEYS[profile!.plan];
    else summaryKey = 'plan_free';
  }
  const button = 'aac-btn w-full rounded-xl px-3 py-3 text-sm surface-key text-primary border border-theme disabled:opacity-50';
  return <div className="space-y-2" data-testid="cloud-subscription-settings">
    <div className="surface-key rounded-lg px-3 py-2 border border-theme" data-testid="subscription-summary">
      <span className="text-muted text-xs uppercase tracking-wider">{t('subscription')}</span>
      {profile?.isPlatformAdmin && <span className="text-[#FFD700] text-xs ml-2">★ {t('admin')}</span>}
      <p className="text-primary font-semibold text-sm">{t(summaryKey)}</p>
    </div>
    <p className="font-semibold text-sm text-primary">{t('cloud_plan_title')}</p>
    <p className="text-xs text-muted">{t('cloud_core_free')}</p>
    {billing?.betaExempt && <p role="status" className="text-sm text-primary">{t('cloud_beta_access')}</p>}
    {billing?.hasCloudAccess && !billing.betaExempt && <p role="status" className="text-sm text-primary">{t('cloud_access_active')}</p>}
    {billing?.transitionEndsAt && !billing.betaExempt && <p className="text-xs text-muted">
      {t('cloud_transition_ends').replace('{date}', new Date(billing.transitionEndsAt).toLocaleDateString())}
    </p>}
    {billing?.offer.monthlySpeechCharacters && billing.offer.monthlyAiRequests && <p className="text-xs text-muted">
      {t('cloud_monthly_allowance').replace('{characters}', billing.offer.monthlySpeechCharacters.toLocaleString())
        .replace('{requests}', billing.offer.monthlyAiRequests.toLocaleString())}
    </p>}
    {billing?.offer.allowanceReset === 'utc_calendar_month' && <p className="text-xs text-muted">{t('cloud_allowance_reset')}</p>}
    {canPurchase && <>
      <p className="text-xs text-muted">{t(native ? 'cloud_subscription_terms_apple' : 'cloud_subscription_terms').replace('{price}', quotedPrice!)}</p>
      <button type="button" disabled={busy} className={button} onClick={() => void purchase()}>
        {t(native ? 'cloud_subscribe_apple' : 'cloud_subscribe_web').replace('{price}', quotedPrice!)}
      </button>
      <p className="text-xs text-muted"><a href="https://synalux.ai/legal/privacy" target="_blank" rel="noopener noreferrer">{t('cloud_privacy')}</a>
        {' · '}<a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener noreferrer">{t('cloud_terms')}</a></p>
    </>}
    {native && billing?.enabled && !hasNativePurchases() && !billing.betaExempt &&
      <p className="text-xs text-muted">{t('cloud_update_ios')}</p>}
    {native && hasNativePurchases() && billing && !billing.betaExempt && <button type="button" disabled={busy}
      className={button} onClick={() => void act('restore_failed', async () => {
        reportCloudPlan('restore_started', platform);
        // A rejected foreign transaction is reported, but the account's own
        // deliveries in the same restore must still be reflected in the summary.
        try { setBilling(await restoreAacApplePurchases()); reportCloudPlan('restore_complete', platform); }
        catch (error) { await refresh().catch(() => undefined); throw error; }
      })}>
      {t('cloud_restore_apple')}
    </button>}
    {billing?.manageChannel && <button type="button" disabled={busy} className={button}
      onClick={() => void act('manage_failed', async () => {
        reportCloudPlan('manage_opened', platform);
        await manageAacSubscription(billing.manageChannel!); await refresh();
      })}>
      {t('cloud_manage_subscription')}
    </button>}
    <button type="button" disabled={busy} className={button} onClick={() => void act('refresh_failed', refresh)}>{t('cloud_refresh_plan')}</button>
    {notice && <p role="status" className="text-xs text-muted">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
  </div>;
}

const PLAN_LABEL_KEYS: Record<SynaluxProfile['plan'], string> = {
  free: 'plan_free',
  standard: 'plan_standard',
  advanced: 'plan_advanced',
  enterprise: 'plan_enterprise',
};
