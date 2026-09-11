import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
const state = vi.hoisted(() => ({ native: false, nativePurchases: false,
  profile: { email: 'tester@example.com', plan: 'free', isPlatformAdmin: false }, fetch: vi.fn(), product: vi.fn(), apple: vi.fn(),
  stripe: vi.fn(), restore: vi.fn(), manage: vi.fn(), ddAction: vi.fn() }));
vi.mock('@/services/aiService', () => ({ isNativeiOS: () => state.native }));
vi.mock('@/lib/datadog', () => ({ ddAction: state.ddAction }));
type ProfileSlice = { profile: typeof state.profile };
vi.mock('@/store/authStore', () => ({ useAuthStore: Object.assign((selector: (s: ProfileSlice) => unknown) => selector({ profile: state.profile }),
  { getState: () => ({ profile: state.profile }) }) }));
vi.mock('@/services/aacBillingService', () => ({
  AAC_BILLING_UPDATED: 'prismAacBillingUpdated',
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

describe('AAC account purchase settings', () => {
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
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe with Apple/ }));
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
    fireEvent.click(await screen.findByRole('button', { name: /Subscribe with Apple/ }));
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
