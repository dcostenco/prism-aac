import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), billing: vi.fn(), manage: vi.fn(), profile: null as null | { email: string } }));
vi.mock('@/services/webAccessService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/webAccessService')>(), fetchWebAccess: mocks.access,
}));
vi.mock('@/services/aacBillingService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/aacBillingService')>(),
  fetchAacBillingStatus: mocks.billing, manageAacSubscription: mocks.manage,
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (select: (s: { profile: typeof mocks.profile }) => unknown) => select({ profile: mocks.profile }) }));
import EntitlementNotice, { PAID_NOTICE_DISMISS_KEY } from '@/components/EntitlementNotice';
import { useSettingsStore } from '@/store/settingsStore';
import { loadLanguage } from '@/engine/i18n';

const NOW = new Date('2026-12-01T10:00:00');
const CUTOVER = new Date('2026-12-31T10:00:00').toISOString();
const entitlement = (state: string, accessUntil: string | null = CUTOVER) => ({ state: 'signed_in', remainingMs: 0,
  entitlement: { state, accessUntil, policyVersion: '2026-10-27-v1' } });
async function settle() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'] });
  vi.setSystemTime(NOW);
  mocks.profile = { email: 'Family@Example.com' };
  useSettingsStore.setState({ language: 'en' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('paid-plan notices above the board', () => {
  it('shows nothing while the server\'s paid-only policy is off (no entitlement in its answer)', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    const { container } = render(<EntitlementNotice />); await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('needs no build flag: the countdown shows as soon as the server turns the policy on', async () => {
    vi.stubEnv('NEXT_PUBLIC_AAC_PAID_ONLY_NOTICES', '');
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    const { container } = render(<EntitlementNotice />); await settle();
    expect(container).toBeEmptyDOMElement();
    mocks.access.mockResolvedValue(entitlement('pre_cutover_free'));
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(0); });
    expect(container).not.toBeEmptyDOMElement();
  });

  it('shows nothing and asks nothing when signed out', async () => {
    mocks.profile = null;
    const { container } = render(<EntitlementNotice />); await settle();
    expect(container).toBeEmptyDOMElement();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it('counts down to the paid plan with the date and the days left', async () => {
    mocks.access.mockResolvedValue(entitlement('pre_cutover_free'));
    render(<EntitlementNotice />); await settle();
    expect(screen.getByTestId('aac-paid-notice')).toHaveTextContent('Prism AAC moves to a paid plan on December 31, 2026. Days left: 30.');
  });

  it('see changes expands the details and says so to assistive technology', async () => {
    mocks.access.mockResolvedValue(entitlement('pre_cutover_free'));
    render(<EntitlementNotice />); await settle();
    const toggle = screen.getByRole('button', { name: 'See changes' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide changes' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/requires an active trial or subscription/)).toHaveTextContent('After December 31, 2026');
  });

  it('hides until tomorrow for this account only, then returns', async () => {
    mocks.access.mockResolvedValue(entitlement('pre_cutover_free'));
    const { unmount } = render(<EntitlementNotice />); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Hide until tomorrow' }));
    expect(screen.queryByTestId('aac-paid-notice')).toBeNull();
    unmount();
    render(<EntitlementNotice />); await settle();
    expect(screen.queryByTestId('aac-paid-notice')).toBeNull();
    const stored = JSON.parse(localStorage.getItem(PAID_NOTICE_DISMISS_KEY)!);
    expect(stored.day).toBe('2026-12-01');
    expect(JSON.stringify(stored)).not.toContain('example.com');
    // Left open overnight: the next check shows it again without a reload.
    vi.setSystemTime(new Date('2026-12-02T09:00:00'));
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId('aac-paid-notice')).toBeInTheDocument();
  });

  it('a dismissal from yesterday or by another account does not hide it', async () => {
    mocks.access.mockResolvedValue(entitlement('pre_cutover_free'));
    const first = render(<EntitlementNotice />); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Hide until tomorrow' }));
    first.unmount();
    mocks.profile = { email: 'other@example.com' };
    const other = render(<EntitlementNotice />); await settle();
    expect(screen.getByTestId('aac-paid-notice')).toBeInTheDocument();
    other.unmount();
    mocks.profile = { email: 'Family@Example.com' };
    vi.setSystemTime(new Date('2026-12-02T10:00:00'));
    render(<EntitlementNotice />); await settle();
    expect(screen.getByTestId('aac-paid-notice')).toBeInTheDocument();
  });

  it('a payment-failed grace shows a notice that cannot be dismissed and opens payment management', async () => {
    mocks.access.mockResolvedValue(entitlement('grace', new Date('2026-12-10T00:00:00Z').toISOString()));
    mocks.billing.mockResolvedValue({ manageChannel: 'stripe' });
    mocks.manage.mockResolvedValue(undefined);
    render(<EntitlementNotice />); await settle();
    expect(screen.getByTestId('aac-grace-notice')).toHaveTextContent("Your payment didn't go through.");
    expect(screen.queryByRole('button', { name: 'Hide until tomorrow' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update payment' })); await settle();
    expect(mocks.manage).toHaveBeenCalledWith('stripe');
  });

  it('a double tap on Update opens payment management once', async () => {
    mocks.access.mockResolvedValue(entitlement('grace', new Date('2026-12-10T00:00:00Z').toISOString()));
    mocks.billing.mockResolvedValue({ manageChannel: 'apple' });
    let finish!: () => void;
    mocks.manage.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    render(<EntitlementNotice />); await settle();
    const update = screen.getByRole('button', { name: 'Update payment' });
    fireEvent.click(update); fireEvent.click(update); await settle();
    expect(mocks.manage).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await vi.advanceTimersByTimeAsync(0); });
  });

  it('says so when payment management cannot be opened', async () => {
    mocks.access.mockResolvedValue(entitlement('grace', new Date('2026-12-10T00:00:00Z').toISOString()));
    mocks.billing.mockResolvedValue({ manageChannel: null });
    render(<EntitlementNotice />); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Update payment' })); await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Payment settings could not be opened.');
    expect(mocks.manage).not.toHaveBeenCalled();
  });

  it.each(['paid', 'beta', 'included', 'expired', 'none'])('shows nothing for %s', async state => {
    mocks.access.mockResolvedValue(entitlement(state, state === 'paid' ? CUTOVER : null));
    const { container } = render(<EntitlementNotice />); await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing when the server sends no entitlement or cannot be reached', async () => {
    mocks.access.mockResolvedValueOnce({ state: 'signed_in', remainingMs: 0 });
    const first = render(<EntitlementNotice />); await settle();
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();
    mocks.access.mockRejectedValueOnce(new Error('offline'));
    const second = render(<EntitlementNotice />); await settle();
    expect(second.container).toBeEmptyDOMElement();
  });

  it('never shows one account the notice read for another', async () => {
    mocks.access.mockResolvedValueOnce(entitlement('grace', new Date('2026-12-10T00:00:00Z').toISOString()));
    const view = render(<EntitlementNotice />); await settle();
    expect(screen.getByTestId('aac-grace-notice')).toBeInTheDocument();
    mocks.profile = { email: 'next@example.com' };
    mocks.access.mockReturnValueOnce(new Promise(() => {}));
    view.rerender(<EntitlementNotice />);
    expect(screen.queryByTestId('aac-grace-notice')).toBeNull();
  });

  it('reads right to left in Arabic, in Arabic', async () => {
    await loadLanguage('ar');
    useSettingsStore.setState({ language: 'ar' });
    mocks.access.mockResolvedValue(entitlement('pre_cutover_free'));
    render(<EntitlementNotice />); await settle();
    const notice = screen.getByTestId('aac-paid-notice');
    expect(notice).toHaveAttribute('dir', 'rtl');
    expect(notice).toHaveTextContent('ينتقل Prism AAC إلى خطة مدفوعة');
  });
});
