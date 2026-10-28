import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  access: vi.fn(), storeLease: vi.fn(), storedLease: vi.fn(), speak: vi.fn(), exportBoards: vi.fn(),
  trigger: vi.fn(), emergencyEnabled: true, reportOffline: vi.fn(), browser: false, storedLeaseAccount: vi.fn(), clearLease: vi.fn(),
  native: false, purchases: false, profile: { email: 'Family@Example.com' } as null | { email: string }, identityUnknown: false,
}));
vi.mock('@/services/webAccessService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/webAccessService')>(), fetchWebAccess: mocks.access }));
vi.mock('@/services/aacLease', () => ({ storeLease: mocks.storeLease, storedLease: mocks.storedLease,
  storedLeaseAccount: mocks.storedLeaseAccount, clearLease: mocks.clearLease }));
vi.mock('@/services/speakMessage', () => ({ speakComposedMessage: mocks.speak }));
vi.mock('@/services/boardExport', () => ({ copyBoardExport: mocks.exportBoards }));
vi.mock('@/services/emergencyService', () => ({
  getConfig: () => ({ enabled: mocks.emergencyEnabled }), triggerEmergency: mocks.trigger }));
vi.mock('@/services/nativeShell', () => ({ isPrismNativeShell: () => mocks.native, isPrismBrowserShell: () => mocks.browser,
  reportOfflineAccess: mocks.reportOffline }));
vi.mock('@/services/aacBillingService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/aacBillingService')>(), hasNativePurchases: () => mocks.purchases }));
vi.mock('@/components/CloudSubscriptionSettings', () => ({ default: () => <div data-testid="cloud-subscription-settings" /> }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (select: (s: { profile: typeof mocks.profile; loaded: boolean; identityUnknown: boolean }) => unknown) =>
    select({ profile: mocks.profile, loaded: true, identityUnknown: mocks.identityUnknown }) }));
import PaidPlanLock, { POLICY_SEEN_KEY } from '@/components/PaidPlanLock';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { usePaidPlanStore } from '@/store/paidPlanStore';
import { AAC_BILLING_UPDATED } from '@/services/aacBillingService';

const reply = (state?: string, lease?: string) => ({ state: 'signed_in', remainingMs: 0,
  ...(state ? { paidPlan: true, entitlement: { state, accessUntil: null, policyVersion: 'v' } } : {}), ...(lease ? { lease } : {}) });
async function settle() { await act(async () => { await vi.advanceTimersByTimeAsync(1); }); }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'] });
  vi.stubEnv('NEXT_PUBLIC_AAC_PAID_ONLY_LOCK', '1');
  mocks.native = false; mocks.purchases = false; mocks.browser = false; mocks.profile = { email: 'Family@Example.com' }; mocks.identityUnknown = false;
  mocks.emergencyEnabled = true; mocks.trigger.mockResolvedValue(() => {}); mocks.storedLeaseAccount.mockReturnValue(null);
  mocks.storedLease.mockResolvedValue(null); mocks.storeLease.mockResolvedValue(true);
  mocks.speak.mockResolvedValue(undefined); mocks.exportBoards.mockResolvedValue(undefined);
  useMessageStore.setState({ text: '' });
  useSettingsStore.setState({ language: 'en' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('paid-plan lock screen', () => {
  it('does nothing and asks nothing when the build has the lock off', async () => {
    vi.stubEnv('NEXT_PUBLIC_AAC_PAID_ONLY_LOCK', '');
    mocks.access.mockResolvedValue(reply('expired'));
    const { container } = render(<PaidPlanLock />); await settle();
    expect(container).toBeEmptyDOMElement();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it('locks an expired account at launch, with purchase, export and the Safety panel', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    const lock = screen.getByTestId('aac-paid-lock');
    expect(lock).toHaveAttribute('role', 'dialog');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Prism AAC needs a trial or subscription');
    expect(screen.getByTestId('cloud-subscription-settings')).toBeInTheDocument();
    expect(screen.getByTestId('aac-lock-safety')).toBeInTheDocument();
    expect(localStorage.getItem(POLICY_SEEN_KEY)).toBe('1');
  });

  it.each(['included', 'beta', 'paid', 'grace', 'pre_cutover_free'])('%s is not locked', async state => {
    mocks.access.mockResolvedValue(reply(state));
    const { container } = render(<PaidPlanLock />); await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('the Emergency button starts the urgent countdown, which can be cancelled', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    const alert = vi.spyOn(useUIStore.getState(), 'triggerAlert').mockImplementation(() => {});
    render(<PaidPlanLock />); await settle();
    fireEvent.click(screen.getByTestId('aac-lock-emergency'));
    expect(mocks.trigger).toHaveBeenCalledWith('Emergency', 'urgent', expect.any(Function), expect.any(Function));
    expect(alert).not.toHaveBeenCalled();
  });

  it('with emergency dispatch turned off in Settings, it opens the caregiver alert instead', async () => {
    mocks.emergencyEnabled = false;
    mocks.access.mockResolvedValue(reply('expired'));
    const alert = vi.spyOn(useUIStore.getState(), 'triggerAlert').mockImplementation(() => {});
    render(<PaidPlanLock />); await settle();
    fireEvent.click(screen.getByTestId('aac-lock-emergency'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it('safety phrases and bedside cards speak through the normal speak path', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'I need help' }));
    expect(mocks.speak).toHaveBeenCalledWith('I need help');
    fireEvent.click(screen.getByRole('button', { name: /I can't breathe/ }));
    expect(mocks.speak).toHaveBeenCalledWith("I can't breathe");
  });

  it('copies the board export and says so', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard/ })); await settle();
    expect(mocks.exportBoards).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Copied\./)).toBeInTheDocument();
  });

  it('never locks while a message is being composed; it waits until the message is cleared', async () => {
    useMessageStore.setState({ text: 'I want to' });
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    expect(screen.queryByTestId('aac-paid-lock')).toBeNull();
    act(() => { useMessageStore.setState({ text: '' }); }); await settle();
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
  });

  it('a check later in a session never locks mid-use; returning after being away does', async () => {
    mocks.access.mockResolvedValue(reply('paid'));
    render(<PaidPlanLock />); await settle();
    mocks.access.mockResolvedValue(reply('expired'));
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByTestId('aac-paid-lock')).toBeNull();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
  });

  it('unlocks at once when a purchase lands', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    mocks.access.mockResolvedValue(reply('paid'));
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByTestId('aac-paid-lock')).toBeNull();
  });

  it('keeps a lease the server sends, for this account', async () => {
    mocks.access.mockResolvedValue(reply('paid', 'a.b.c'));
    render(<PaidPlanLock />); await settle();
    expect(mocks.storeLease).toHaveBeenCalledWith('a.b.c', 'family@example.com');
  });

  it('offline: a valid lease keeps the board; without one, a device that saw the policy locks', async () => {
    localStorage.setItem(POLICY_SEEN_KEY, '1');
    mocks.access.mockRejectedValue(new Error('offline'));
    mocks.storedLease.mockResolvedValue({ sub: 'u', st: 'paid', pv: 'v', iat: 0, exp: 9e9 });
    const first = render(<PaidPlanLock />); await settle();
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();
    mocks.storedLease.mockResolvedValue(null);
    render(<PaidPlanLock />); await settle();
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
  });

  it('offline launch with identity unknown: the stored lease still keeps a paying device unlocked', async () => {
    localStorage.setItem(POLICY_SEEN_KEY, '1');
    mocks.profile = null; mocks.identityUnknown = true;
    mocks.access.mockRejectedValue(new Error('offline'));
    mocks.storedLease.mockResolvedValue({ sub: 'u', st: 'paid', pv: 'v', iat: 0, exp: 9e9 });
    const { container } = render(<PaidPlanLock />); await settle();
    expect(mocks.storedLease).toHaveBeenCalledWith(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('offline after a confirmed sign-out: no lease is consulted and the device locks', async () => {
    localStorage.setItem(POLICY_SEEN_KEY, '1');
    mocks.profile = null; mocks.identityUnknown = false;
    mocks.access.mockRejectedValue(new Error('offline'));
    mocks.storedLease.mockResolvedValue({ sub: 'u', st: 'paid', pv: 'v', iat: 0, exp: 9e9 });
    render(<PaidPlanLock />); await settle();
    expect(mocks.storedLease).not.toHaveBeenCalled();
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
  });

  it('a failed profile lookup never locks an account the server says is paid', async () => {
    mocks.profile = null; mocks.identityUnknown = true;
    mocks.access.mockResolvedValue(reply('paid'));
    const { container } = render(<PaidPlanLock />); await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('a purchase that lands unlocks at once, without waiting for focus', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
    mocks.access.mockResolvedValue(reply('paid'));
    await act(async () => { window.dispatchEvent(new Event(AAC_BILLING_UPDATED)); await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByTestId('aac-paid-lock')).toBeNull();
  });

  it('tells the board it is covered while locked, and releases it on unlock', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    const { unmount } = render(<PaidPlanLock />); await settle();
    expect(usePaidPlanStore.getState().locked).toBe(true);
    unmount();
    expect(usePaidPlanStore.getState().locked).toBe(false);
  });

  it('a paying account on an App Store build that cannot buy in-app sees nothing', async () => {
    mocks.native = true; mocks.purchases = false;
    mocks.access.mockResolvedValue(reply('paid'));
    const { container } = render(<PaidPlanLock />); await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('a purchase that lands asks again, never reusing an answer requested before it', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    await act(async () => { window.dispatchEvent(new Event(AAC_BILLING_UPDATED)); await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.access).toHaveBeenLastCalledWith({ fresh: true });
  });

  it('identity unknown but the server answers: the lease is kept, unbound, so it keeps renewing', async () => {
    mocks.profile = null; mocks.identityUnknown = true;
    mocks.access.mockResolvedValue(reply('paid', 'a.b.c'));
    render(<PaidPlanLock />); await settle();
    expect(mocks.storeLease).toHaveBeenCalledWith('a.b.c', '');
  });

  it('drops a lease kept for another account, and one the server says is no longer entitled', async () => {
    mocks.storedLeaseAccount.mockReturnValue('other@example.com');
    mocks.access.mockResolvedValue(reply('paid'));
    const first = render(<PaidPlanLock />); await settle();
    expect(mocks.clearLease).toHaveBeenCalledTimes(1);
    first.unmount(); mocks.clearLease.mockClear();
    mocks.storedLeaseAccount.mockReturnValue('family@example.com');
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    expect(mocks.clearLease).toHaveBeenCalledTimes(1);
  });

  it('in the app, tells the offline page the policy was seen and when the lease ends', async () => {
    mocks.native = true; mocks.purchases = true;
    mocks.storedLease.mockResolvedValue({ sub: 'u', st: 'paid', pv: 'v', iat: 0, exp: 2_000_000_000 });
    mocks.access.mockResolvedValue(reply('paid', 'a.b.c'));
    render(<PaidPlanLock />); await settle();
    expect(mocks.reportOffline).toHaveBeenCalledWith({ policySeen: true, leaseUntil: 2_000_000_000_000 });
  });

  it('in the app, an expired account with no lease leaves the offline page the safety phrases only', async () => {
    mocks.native = true; mocks.purchases = true;
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    expect(mocks.reportOffline).toHaveBeenCalledWith({ policySeen: true, leaseUntil: null });
  });

  it('in a browser, nothing is reported', async () => {
    mocks.access.mockResolvedValue(reply('paid', 'a.b.c'));
    render(<PaidPlanLock />); await settle();
    expect(mocks.reportOffline).not.toHaveBeenCalled();
  });

  it('a passing sign-in hiccup never lifts the lock, even for a moment', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    const { rerender } = render(<PaidPlanLock />); await settle();
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
    mocks.access.mockImplementation(() => new Promise(() => {}));
    mocks.identityUnknown = true; rerender(<PaidPlanLock />); await settle();
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
  });

  it('a server answer without an entitlement forgets the policy, so nothing locks offline afterwards', async () => {
    localStorage.setItem(POLICY_SEEN_KEY, '1');
    mocks.access.mockResolvedValue(reply());
    const first = render(<PaidPlanLock />); await settle();
    expect(localStorage.getItem(POLICY_SEEN_KEY)).toBeNull();
    first.unmount();
    mocks.access.mockRejectedValue(new Error('offline'));
    const { container } = render(<PaidPlanLock />); await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('an App Store build that cannot buy in-app is asked to update, not locked', async () => {
    mocks.native = true; mocks.purchases = false;
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    expect(screen.getByTestId('aac-update-app')).toHaveTextContent('Update Prism AAC from the App Store');
    expect(screen.queryByTestId('aac-paid-lock')).toBeNull();
  });

  it('the Prism Browser app is pointed to the Prism AAC app, not told to update', async () => {
    mocks.native = true; mocks.purchases = false; mocks.browser = true;
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    expect(screen.getByTestId('aac-update-app')).toHaveTextContent('Start one in the Prism AAC app');
    expect(screen.getByTestId('aac-update-app')).not.toHaveTextContent('App Store');
  });

  it('signed out while the policy is on: locked, with a sign-in link instead of purchase controls', async () => {
    mocks.profile = null;
    mocks.access.mockResolvedValue({ state: 'sign_in_required', remainingMs: 0, paidPlan: true });
    render(<PaidPlanLock />); await settle();
    expect(screen.getByTestId('aac-paid-lock')).toBeInTheDocument();
    expect(screen.getByTestId('aac-lock-sign-in')).toHaveAttribute('href', expect.stringContaining('/auth?callbackUrl='));
    expect(screen.queryByTestId('cloud-subscription-settings')).toBeNull();
    expect(screen.getByTestId('aac-lock-safety')).toBeInTheDocument();
  });

  it('signed out while the policy is off: never locked', async () => {
    mocks.profile = null;
    localStorage.setItem(POLICY_SEEN_KEY, '1');
    mocks.access.mockResolvedValue({ state: 'sign_in_required', remainingMs: 0 });
    const { container } = render(<PaidPlanLock />); await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps keyboard focus inside the lock', async () => {
    mocks.access.mockResolvedValue(reply('expired'));
    render(<PaidPlanLock />); await settle();
    const buttons = screen.getByTestId('aac-paid-lock').querySelectorAll<HTMLElement>('a[href],button');
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
  });
});
