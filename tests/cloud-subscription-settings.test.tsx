import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
const state = vi.hoisted(() => ({ native: false, nativePurchases: false,
  profile: { email: 'tester@example.com', plan: 'free', isPlatformAdmin: false }, fetch: vi.fn(), product: vi.fn(), apple: vi.fn(),
  stripe: vi.fn(), restore: vi.fn(), manage: vi.fn(), ddAction: vi.fn(), refresh: vi.fn(), resume: vi.fn() }));
vi.mock('@/services/aiService', () => ({ isNativeiOS: () => state.native }));
vi.mock('@/services/predictionMemoryService', () => ({ resumeCloudPrediction: state.resume }));
vi.mock('@/lib/datadog', () => ({ ddAction: state.ddAction }));
type ProfileSlice = { profile: typeof state.profile };
vi.mock('@/store/authStore', () => ({ useAuthStore: Object.assign((selector: (s: ProfileSlice) => unknown) => selector({ profile: state.profile }),
  { getState: () => ({ profile: state.profile, refresh: state.refresh }) }) }));
vi.mock('@/services/aacBillingService', () => ({
  AAC_BILLING_UPDATED: 'prismAacBillingUpdated',
  AAC_INTRODUCTORY_TRIAL_DAYS: 14,
  fetchAacBillingStatus: state.fetch, hasNativePurchases: () => state.nativePurchases,
  nativeSubscription: state.product, purchaseAacWithApple: state.apple, purchaseAacWithStripe: state.stripe,
  restoreAacApplePurchases: state.restore, manageAacSubscription: state.manage,
}));
import CloudSubscriptionSettings from '@/components/CloudSubscriptionSettings';
import { resetMonetizationTelemetry } from '@/services/monetizationTelemetry';
import { useSettingsStore } from '@/store/settingsStore';

const free = { userId: 'account-test', hasCloudAccess: false, betaExempt: false,
  transitionEndsAt: null, channels: [], manageChannel: null, enabled: true,
  offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly',
    monthlySpeechCharacters: 50_000, monthlyAiRequests: 100, version: 'test-offer-v1' } };

beforeEach(() => {
  vi.clearAllMocks(); state.native = false; state.nativePurchases = false;
  // Tests that simulate an account change mutate this; without the reset the
  // next test starts as a different visitor and impressions look duplicated.
  state.profile = { email: 'tester@example.com', plan: 'free', isPlatformAdmin: false };
  resetMonetizationTelemetry();
  state.fetch.mockResolvedValue(free);
  state.restore.mockImplementation(() => state.fetch());
  state.product.mockResolvedValue({ id: free.offer.appleProductId, displayPrice: '$4.99' });
  state.apple.mockResolvedValue({ status: 'pending' });
  useSettingsStore.setState({ language: 'en' });
});

const planEvents = () => state.ddAction.mock.calls
  .filter(([name]) => name === 'aac_cloud_plan')
  .map(([, ctx]) => `${(ctx as { event: string }).event}:${(ctx as { platform: string }).platform}`);

// A person sees the offer before they can press it. The impression is recorded
// in an effect after the render that shows the button, so a click fired the
// instant the button appears could run first on a loaded CI runner and file
// purchase_started before offer_shown. Still fails if the offer is never recorded.
async function subscribeWithAppleOnceShown() {
  const button = await screen.findByRole('button', { name: /Subscribe with Apple/ });
  await waitFor(() => expect(planEvents()).toContain('offer_shown:ios'));
  fireEvent.click(button);
}

describe('AAC account purchase settings', () => {
  it('discloses a verified 14-day web trial and card requirement before explicit checkout', async () => {
    state.fetch.mockResolvedValue({ ...free, stripeTrialDays: 14 });
    render(<CloudSubscriptionSettings />);
    const buy = await screen.findByRole('button', { name: 'Start 14-day trial · US$4.99/month after' });
    expect(screen.getByTestId('cloud-offer-terms')).toHaveTextContent('Payment details are required');
    expect(screen.getByTestId('cloud-offer-terms')).toHaveTextContent('first charge date before you confirm');
    expect(state.stripe).not.toHaveBeenCalled();
    fireEvent.click(buy);
    await waitFor(() => expect(state.stripe).toHaveBeenCalledWith(free.userId, free.offer.version));
  });
  it('uses Apple eligibility rather than the web trial and retains its localized price', async () => {
    state.native = true; state.nativePurchases = true;
    state.fetch.mockResolvedValue({ ...free, stripeTrialDays: 0 });
    state.product.mockResolvedValue({ id: free.offer.appleProductId, displayPrice: '€5.99',
      introductoryOfferEligible: true, introductoryTrialDays: 14 });
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: 'Start 14-day trial with Apple · €5.99/month after' })).toBeVisible();
    expect(screen.getByTestId('cloud-offer-terms')).toHaveTextContent('at least 24 hours');
    expect(state.product).toHaveBeenCalledWith('product', { accountToken: free.userId });
    expect(state.apple).not.toHaveBeenCalled();
  });
  it.each([
    { eligible: false, days: 14 }, { eligible: undefined, days: undefined }, { eligible: true, days: 7 },
  ])('does not invent the agreed Apple trial for an ineligible, older or different offer: %j', async ({ eligible, days }) => {
    state.native = true; state.nativePurchases = true;
    state.fetch.mockResolvedValue({ ...free, stripeTrialDays: 14 });
    state.product.mockResolvedValue({ id: free.offer.appleProductId, displayPrice: '$4.99',
      introductoryOfferEligible: eligible, introductoryTrialDays: days });
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: 'Subscribe with Apple · $4.99/month' })).toBeVisible();
    expect(screen.queryByText(/Eligible accounts can start/)).not.toBeInTheDocument();
    expect(screen.getByTestId('cloud-offer-terms')).toHaveTextContent('Apple shows eligibility');
  });
  it('does not reuse the last account\'s Apple price or trial eligibility while loading another account', async () => {
    state.native = true; state.nativePurchases = true;
    state.product.mockResolvedValueOnce({ id: free.offer.appleProductId, displayPrice: '€5.99',
      introductoryOfferEligible: true, introductoryTrialDays: 14 });
    const view = render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Start 14-day trial with Apple/ })).toBeVisible();
    state.profile = { ...state.profile, email: 'next-account@example.invalid' };
    state.product.mockReturnValue(new Promise(() => {}));
    view.rerender(<CloudSubscriptionSettings />);
    expect(screen.queryByRole('button', { name: /€5.99/ })).not.toBeInTheDocument();
    expect(state.apple).not.toHaveBeenCalled();
  });
  it.each([false, true])('shows the original trial end and scheduled cancellation=%s without creating a new trial', async cancelsAtEnd => {
    const endsAt = '2099-11-01T12:34:00Z';
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['stripe'], manageChannel: 'stripe',
      purchaseBlocked: true, stripeTrial: { endsAt, cancelsAtEnd } });
    render(<CloudSubscriptionSettings />);
    const date = await screen.findByTestId('cloud-trial-date');
    expect(date).toHaveTextContent(new Date(endsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
    if (cancelsAtEnd) expect(date).toHaveTextContent('Cancellation is scheduled');
    expect(state.stripe).not.toHaveBeenCalled();
  });
  it('offers AAC terms and separate Apple terms even while billing is unavailable', async () => {
    state.fetch.mockRejectedValue(new Error('Offline'));
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByText('Subscription status unavailable')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Terms of use', exact: true })).toHaveAttribute('href', '/prism-aac/terms');
    expect(screen.getByRole('link', { name: 'Terms of use (Apple)' })).toHaveAttribute('href', 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
    expect(state.apple).not.toHaveBeenCalled();
    expect(state.stripe).not.toHaveBeenCalled();
  });

  it.each(['apple', 'stripe'])('shows verified %s access instead of the legacy Free plan', async channel => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: [channel], manageChannel: channel });
    render(<CloudSubscriptionSettings />);
    const summary = within(screen.getByTestId('subscription-summary'));
    expect(await summary.findByText('Cloud subscription · Active')).toBeVisible();
    expect(summary.queryByText('Free')).not.toBeInTheDocument();
    expect(summary.queryByText(/19\/mo/)).not.toBeInTheDocument();
    state.fetch.mockRejectedValueOnce(new Error('Billing refresh failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh cloud plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Billing refresh failed');
    expect(summary.getByText('Cloud subscription · Active')).toBeVisible();
  });
  it.each([
    { betaExempt: true, transitionEndsAt: null, label: 'Beta cloud access · Included' },
    { betaExempt: false, transitionEndsAt: '2099-10-07T00:00:00Z', label: 'Transition cloud access · Included' },
  ])('describes $label without implying a paid subscription', async ({ label, ...access }) => {
    state.fetch.mockResolvedValue({ ...free, ...access, hasCloudAccess: true });
    render(<CloudSubscriptionSettings />);
    const summary = within(screen.getByTestId('subscription-summary'));
    expect(await summary.findByText(label)).toBeVisible();
    expect(summary.queryByText('Cloud subscription · Active')).not.toBeInTheDocument();
    expect(summary.queryByText('Free')).not.toBeInTheDocument();
  });
  it('does not guess Free while billing is loading or unavailable', async () => {
    let reject!: (reason: Error) => void;
    state.fetch.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    render(<CloudSubscriptionSettings />);
    const summary = within(screen.getByTestId('subscription-summary'));
    expect(summary.getByText('Checking subscription…')).toBeVisible();
    expect(summary.queryByText('Free')).not.toBeInTheDocument();
    await act(async () => { reject(new Error('Billing unavailable')); });
    expect(summary.getByText('Subscription status unavailable')).toBeVisible();
    expect(summary.queryByText('Free')).not.toBeInTheDocument();
  });
  it('updates the summary after purchase, entitlement expiry and restore', async () => {
    state.native = true; state.nativePurchases = true;
    const paid = { ...free, hasCloudAccess: true, channels: ['apple'], manageChannel: 'apple' };
    state.apple.mockResolvedValue({ status: 'purchased', billing: paid });
    render(<CloudSubscriptionSettings />);
    const summary = within(screen.getByTestId('subscription-summary'));
    fireEvent.click(await screen.findByRole('button', { name: 'Subscribe with Apple · $4.99/month' }));
    expect(await summary.findByText('Cloud subscription · Active')).toBeVisible();
    await act(async () => { window.dispatchEvent(new Event('prismAacBillingUpdated')); });
    expect(await summary.findByText('Free')).toBeVisible();
    state.restore.mockResolvedValueOnce(paid);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Apple purchases' }));
    expect(await summary.findByText('Cloud subscription · Active')).toBeVisible();
    expect(summary.queryByText('Free')).not.toBeInTheDocument();
  });
  it('retries unfinished Apple delivery when Settings opens', async () => {
    state.native = true; state.nativePurchases = true;
    render(<CloudSubscriptionSettings />);
    await waitFor(() => expect(state.restore).toHaveBeenCalledWith(false, state.profile.email));
  });
  it('offers management instead of a second purchase during Apple billing retry', async () => {
    state.fetch.mockResolvedValue({ ...free, purchaseBlocked: true, manageChannel: 'apple' });
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: 'Manage subscription' })).toBeVisible();
    expect(screen.getByTestId('subscription-summary')).toHaveTextContent('Cloud subscription · Needs attention');
    expect(screen.queryByRole('button', { name: /Subscribe/ })).not.toBeInTheDocument();
  });
  it('shows the price and included allowance before starting web Checkout', async () => {
    render(<CloudSubscriptionSettings />);
    const buy = await screen.findByRole('button', { name: 'Subscribe · US$4.99/month' });
    expect(screen.getByText(/50,000 newly generated speech characters and 100 cloud AI/)).toBeInTheDocument();
    fireEvent.click(buy);
    await waitFor(() => expect(state.stripe).toHaveBeenCalledTimes(1));
    expect(state.stripe).toHaveBeenCalledWith(free.userId, free.offer.version);
    expect(state.apple).not.toHaveBeenCalled();
  });
  it('uses Apple and its actual localized price inside the native app', async () => {
    state.native = true; state.nativePurchases = true;
    state.product.mockResolvedValue({ id: free.offer.appleProductId, displayPrice: '€5.99' });
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Subscribe with Apple · €5.99/month' }));
    expect(await screen.findByText(/Waiting for Apple approval/)).toBeInTheDocument();
    expect(state.apple).toHaveBeenCalledWith(free.userId, free.offer.version);
    expect(state.stripe).not.toHaveBeenCalled();
    expect(screen.getByText(/Boards, saved content, cached speech/)).toBeInTheDocument();
  });
  it('while the paid-only policy is in force, never promises free use', async () => {
    const { usePaidPlanStore } = await import('@/store/paidPlanStore');
    usePaidPlanStore.setState({ active: true });
    try {
      state.native = true; state.nativePurchases = true;
      state.product.mockResolvedValue({ id: free.offer.appleProductId, displayPrice: '€5.99' });
      render(<CloudSubscriptionSettings />);
      fireEvent.click(await screen.findByRole('button', { name: 'Subscribe with Apple · €5.99/month' }));
      expect(await screen.findByText('Waiting for Apple approval.')).toBeInTheDocument();
      expect(screen.getByText(/A trial or subscription includes the whole app/)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/remain free|remains free|stay available|stays available/);
    } finally { usePaidPlanStore.setState({ active: false }); }
  });
  it('suppresses payment prompts for verified beta access on iOS', async () => {
    state.native = true; state.nativePurchases = true;
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, betaExempt: true });
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByText(/Verified beta access/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subscribe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore Apple/ })).not.toBeInTheDocument();
    expect(state.product).not.toHaveBeenCalled();
  });
  it('does not send an older native app to Stripe when StoreKit is unavailable', async () => {
    state.native = true;
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByText(/Update Prism AAC from the App Store/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subscribe/ })).not.toBeInTheDocument();
  });
  it('does not offer another subscription to an existing Apple subscriber on web', async () => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['apple'], manageChannel: 'apple' });
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: 'Manage subscription' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subscribe/ })).not.toBeInTheDocument();
  });
  it('does not sell the plan until the included allowances are configured', async () => {
    state.fetch.mockResolvedValue({ ...free, offer: { usdMonthly: 4.99, appleProductId: free.offer.appleProductId } });
    render(<CloudSubscriptionSettings />);
    await screen.findByRole('button', { name: 'Refresh cloud plan' });
    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Subscribe/ })).not.toBeInTheDocument();
  });
});

describe('cloud plan funnel telemetry', () => {
  it('reports a visible offer once per account session, tagged web', async () => {
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    await act(async () => { fireEvent(window, new Event('prismAacBillingUpdated')); });
    expect(planEvents().filter(e => e.startsWith('offer_shown'))).toEqual(['offer_shown:web']);
  });

  it('counts one visitor once even when a refresh withdraws and restores the offer', async () => {
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    state.fetch.mockResolvedValue({ ...free, enabled: false });
    await act(async () => { fireEvent(window, new Event('prismAacBillingUpdated')); });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Subscribe/ })).not.toBeInTheDocument());
    state.fetch.mockResolvedValue(free);
    await act(async () => { fireEvent(window, new Event('prismAacBillingUpdated')); });
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    expect(planEvents().filter(e => e.startsWith('offer_shown'))).toEqual(['offer_shown:web']);
  });

  // Collapsing the Account accordion unmounts this panel. A per-mount flag
  // counted the same visitor again on every expand.
  it('counts one visitor once across a collapse and re-expand of the section', async () => {
    const first = render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    first.unmount();
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    expect(planEvents().filter(e => e.startsWith('offer_shown'))).toEqual(['offer_shown:web']);
  });

  // The redirect is the declared web conversion. Counting it before the call
  // inflated it by every rejected checkout and every blocked destination.
  it('does not count a redirect when checkout never redirected', async () => {
    state.stripe.mockRejectedValue(new Error('Payment processing failed'));
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_failed:web'));
    expect(planEvents()).not.toContain('purchase_redirected:web');
  });

  it('does not count a manage handoff that failed', async () => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['stripe'], manageChannel: 'stripe' });
    state.manage.mockRejectedValue(new Error('Payment processing failed'));
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Manage/ }));
    await waitFor(() => expect(planEvents()).toContain('manage_failed:web'));
    expect(planEvents()).not.toContain('manage_opened:web');
    // No follow-up refresh: it would spend a request on a handoff that never
    // happened, and a successful one clears the error the user needs to read.
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Payment processing failed')).toBeVisible();
  });

  // The sheet opened over the app and the page stayed put. A flaky status fetch
  // afterwards must not turn one success into both an open and a failure.
  it('does not fail a manage handoff its follow-up refresh could not confirm', async () => {
    state.native = true; state.nativePurchases = true;
    state.fetch.mockResolvedValueOnce({ ...free, hasCloudAccess: true, channels: ['apple'], manageChannel: 'apple' })
      .mockRejectedValue(new Error('Network request failed'));
    state.manage.mockResolvedValue(undefined);
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Manage subscription/ }));
    await waitFor(() => expect(planEvents()).toContain('refresh_failed:ios'));
    expect(planEvents()).toEqual(['manage_opened:ios', 'refresh_failed:ios']);
  });

  // Every web handoff navigates away. A fetch issued into an unloading document
  // aborts, which would have reported a failure on every successful manage.
  it('does not chase a web manage handoff that has already left the page', async () => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['stripe'], manageChannel: 'stripe' });
    state.manage.mockResolvedValue(undefined);
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Manage subscription/ }));
    await waitFor(() => expect(planEvents()).toEqual(['manage_opened:web']));
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });

  it('counts a manage handoff that succeeded', async () => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['stripe'], manageChannel: 'stripe' });
    state.manage.mockResolvedValue(undefined);
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Manage/ }));
    await waitFor(() => expect(planEvents()).toContain('manage_opened:web'));
  });

  // A stale offer refreshes instead of buying, so its failure is a refresh
  // failure. Otherwise failures could outnumber starts.
  it('reports a drifted-identity press as a refresh, never as a failed purchase', async () => {
    render(<CloudSubscriptionSettings />);
    const subscribe = await screen.findByRole('button', { name: /Subscribe/ });
    // The signed-in account changes under the rendered panel: the press must
    // refresh instead of buying, so its failure is a refresh failure.
    state.profile = { email: 'someone.else@example.com', plan: 'free', isPlatformAdmin: false };
    state.fetch.mockRejectedValue(new Error('Cloud plan details are temporarily unavailable.'));
    fireEvent.click(subscribe);
    await waitFor(() => expect(planEvents()).toContain('refresh_failed:web'));
    expect(planEvents()).not.toContain('purchase_failed:web');
    expect(planEvents()).not.toContain('purchase_started:web');
    expect(state.stripe).not.toHaveBeenCalled();
  });

  it('reports an Apple purchase that delivered nothing as none, not complete', async () => {
    state.native = true; state.nativePurchases = true;
    state.apple.mockResolvedValue({ status: 'purchased', billing: { ...free, hasCloudAccess: false } });
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe with Apple/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_none:ios'));
    expect(planEvents()).not.toContain('purchase_complete:ios');
  });

  it('reports a failed restore', async () => {
    state.native = true; state.nativePurchases = true;
    state.restore.mockRejectedValue(new Error('Purchase verification is temporarily unavailable.'));
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Restore/ }));
    await waitFor(() => expect(planEvents()).toContain('restore_failed:ios'));
    expect(planEvents()).not.toContain('restore_complete:ios');
  });

  it('counts an account only once even when the visitor alternates between two', async () => {
    const a = render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    a.unmount();
    state.profile = { email: 'second@example.com', plan: 'free', isPlatformAdmin: false };
    const b = render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    b.unmount();
    state.profile = { email: 'tester@example.com', plan: 'free', isPlatformAdmin: false };
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    expect(planEvents().filter(e => e.startsWith('offer_shown'))).toEqual(['offer_shown:web', 'offer_shown:web']);
  });

  // Private browsing can refuse sessionStorage. The impression must still be
  // deduplicated for the page rather than counted on every expand.
  it('still counts one impression when session storage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
    const first = render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    first.unmount();
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Subscribe/ })).toBeVisible();
    expect(planEvents().filter(e => e.startsWith('offer_shown'))).toEqual(['offer_shown:web']);
    getItem.mockRestore(); setItem.mockRestore();
  });

  // Apple charged the card. Reporting that start as abandoned because the
  // signed-in account changed would understate real revenue, so the funnel
  // records the purchase even though the entitlement is not applied here.
  it('reports a real charge as complete when the account changes mid-flight', async () => {
    state.native = true; state.nativePurchases = true;
    state.apple.mockImplementation(async () => {
      state.profile = { email: 'someone.else@example.com', plan: 'free', isPlatformAdmin: false };
      // A status that would unmistakably read as an active paid subscription.
      return { status: 'purchased', billing: { ...free, hasCloudAccess: true, channels: ['apple'], manageChannel: 'apple' } };
    });
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe with Apple/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_complete:ios'));
    expect(planEvents()).toContain('purchase_started:ios');
    // The buyer's entitlement and confirmation never reach the account that
    // did not buy it, however loudly the purchase result announces access.
    expect(screen.queryByText('Your cloud subscription is ready.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage subscription/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Cloud subscription . Active/)).not.toBeInTheDocument();
  });

  // The status belongs to the account it was fetched for. On a shared device a
  // stale one both shows the wrong entitlement and counts an offer against
  // someone who was never shown it.
  it('does not carry one account offer or entitlement into the next', async () => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['stripe'], manageChannel: 'stripe' });
    const view = render(<CloudSubscriptionSettings />);
    expect(await screen.findByRole('button', { name: /Manage subscription/ })).toBeVisible();
    state.fetch.mockImplementation(() => new Promise(() => {}));
    state.profile = { email: 'next.person@example.com', plan: 'free', isPlatformAdmin: false };
    view.rerender(<CloudSubscriptionSettings />);
    expect(screen.queryByRole('button', { name: /Manage subscription/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Cloud subscription . Active/)).not.toBeInTheDocument();
    expect(planEvents()).toEqual([]);
  });

  // StoreKit's own 'pending' is Ask to Buy: a guardian has to approve, and
  // nothing was charged. It is not a failure and must never be filed as one.
  // The charged-but-undelivered case is a different status with its own test
  // below — do not merge the two, the funnel needs to tell them apart.
  it('does not report an Ask to Buy purchase as failed', async () => {
    state.native = true; state.nativePurchases = true;
    state.apple.mockResolvedValue({ status: 'pending' });
    render(<CloudSubscriptionSettings />);
    await subscribeWithAppleOnceShown();
    await waitFor(() => expect(planEvents()).toContain('purchase_pending:ios'));
    expect(planEvents()).toEqual(['offer_shown:ios', 'purchase_started:ios', 'purchase_pending:ios']);
    expect(planEvents()).not.toContain('purchase_failed:ios');
  });

  // A charged purchase that could not be delivered must not look like Ask to Buy,
  // in the funnel or on screen. Conflating them hid the single most expensive
  // failure mode behind the most benign one.
  it('separates a charged-but-undelivered purchase from Ask to Buy', async () => {
    state.native = true; state.nativePurchases = true;
    state.apple.mockResolvedValue({ status: 'undelivered' });
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe with Apple/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_undelivered:ios'));
    expect(planEvents()).not.toContain('purchase_pending:ios');
    expect(await screen.findByText(/could not confirm it with Synalux/i)).toBeVisible();
    expect(screen.queryByText(/Waiting for Apple approval/i)).not.toBeInTheDocument();
  });

  it('still reports Ask to Buy as pending, with its own wording', async () => {
    state.native = true; state.nativePurchases = true;
    state.apple.mockResolvedValue({ status: 'pending' });
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe with Apple/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_pending:ios'));
    expect(planEvents()).not.toContain('purchase_undelivered:ios');
    expect(await screen.findByText(/Waiting for Apple approval/i)).toBeVisible();
  });

  // manage_failed is the metric a whole review round was spent de-duplicating.
  it('labels a failing refresh button as a refresh, not a manage', async () => {
    state.fetch.mockResolvedValueOnce({ ...free, hasCloudAccess: true, channels: ['stripe'], manageChannel: 'stripe' })
      .mockRejectedValue(new Error('Network request failed'));
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Refresh cloud plan/ }));
    await waitFor(() => expect(planEvents()).toEqual(['refresh_failed:web']));
  });

  it('separates a completed Apple purchase from a cancelled one, tagged ios', async () =>{
    state.native = true; state.nativePurchases = true;
    state.apple.mockResolvedValue({ status: 'cancelled' });
    render(<CloudSubscriptionSettings />);
    await subscribeWithAppleOnceShown();
    await waitFor(() => expect(planEvents()).toContain('purchase_cancelled:ios'));
    expect(planEvents()).toEqual(['offer_shown:ios', 'purchase_started:ios', 'purchase_cancelled:ios']);
  });

  it('reports a delivered Apple purchase as complete', async () => {
    state.native = true; state.nativePurchases = true;
    state.apple.mockResolvedValue({ status: 'purchased', billing: { ...free, hasCloudAccess: true, channels: ['apple'] } });
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe with Apple/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_complete:ios'));
  });

  it('reports the web purchase as a redirect, since Stripe owns what follows', async () => {
    state.stripe.mockResolvedValue(undefined);
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_redirected:web'));
  });

  it('reports a failed purchase without hiding the error from the user', async () => {
    state.stripe.mockRejectedValue(new Error('Payment processing failed'));
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe/ }));
    await waitFor(() => expect(planEvents()).toContain('purchase_failed:web'));
    expect(await screen.findByText('Payment processing failed')).toBeVisible();
  });

  it('reports both ends of a restore', async () => {
    state.native = true; state.nativePurchases = true;
    render(<CloudSubscriptionSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Restore/ }));
    await waitFor(() => expect(planEvents()).toContain('restore_complete:ios'));
    expect(planEvents()).toContain('restore_started:ios');
  });

  // AGPL-3.0 asks anyone running a modified copy to offer its users the
  // Corresponding Source. We hold the copyright so we are not bound by our own
  // licence, but the offer is what makes that term credible against a fork —
  // and an unlinked licence is not an offer.
  it('offers the source alongside the other legal links', async () => {
    render(<CloudSubscriptionSettings />);
    const link = await screen.findByRole('link', { name: /source code/i });
    expect(link).toHaveAttribute('href', 'https://github.com/dcostenco/prism-aac');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

});

// The plan the rest of the app reads (paid features such as generated pictures)
// comes from the account profile, refreshed only when Settings opens or every 30
// minutes. A purchase, a restore or a subscription bought on another device must
// update it as soon as billing shows it.
describe('the account profile follows the subscription', () => {
  it.each(['apple', 'stripe'])('refreshes a Free profile once a %s subscription is active', async channel => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: [channel], manageChannel: channel });
    render(<CloudSubscriptionSettings />);
    await waitFor(() => expect(state.refresh).toHaveBeenCalled());
  });
  it('after an App Store purchase completes', async () => {
    state.native = true; state.nativePurchases = true;
    state.apple.mockResolvedValue({ status: 'purchased',
      billing: { ...free, hasCloudAccess: true, channels: ['apple'], manageChannel: 'apple' } });
    render(<CloudSubscriptionSettings />);
    await subscribeWithAppleOnceShown();
    await waitFor(() => expect(state.refresh).toHaveBeenCalled());
  });
  it('not when the profile already shows the plan', async () => {
    state.profile = { ...state.profile, plan: 'standard' };
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['apple'], manageChannel: 'apple' });
    render(<CloudSubscriptionSettings />);
    expect(await screen.findByText('Cloud subscription · Active')).toBeVisible();
    expect(state.refresh).not.toHaveBeenCalled();
  });
  // A subscription that lapsed and was renewed: the cached profile still says
  // Standard, but a refusal during the lapse paused cloud prediction.
  it('resumes cloud prediction for an active subscription even when the profile already shows the plan', async () => {
    state.profile = { ...state.profile, plan: 'standard' };
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, channels: ['stripe'], manageChannel: 'stripe' });
    render(<CloudSubscriptionSettings />);
    await waitFor(() => expect(state.resume).toHaveBeenCalled());
  });
  it('does not resume cloud prediction without a paid subscription', async () => {
    state.fetch.mockResolvedValue({ ...free, hasCloudAccess: true, betaExempt: true });
    render(<CloudSubscriptionSettings />);
    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(state.resume).not.toHaveBeenCalled();
  });
  it.each([
    ['no subscription', { ...free }],
    ['beta access, which is not a purchase', { ...free, hasCloudAccess: true, betaExempt: true }],
  ])('not for %s', async (_name, billing) => {
    state.fetch.mockResolvedValue(billing);
    render(<CloudSubscriptionSettings />);
    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(state.refresh).not.toHaveBeenCalled();
  });
});
