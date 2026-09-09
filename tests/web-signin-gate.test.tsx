import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), native: false, profile: null as null | { email: string }, ddAction: vi.fn() }));
vi.mock('@/services/webAccessService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/webAccessService')>(), fetchWebAccess: mocks.access,
}));
vi.mock('@/services/aiService', () => ({ isNativeiOS: () => mocks.native,
  synaluxSignInUrl: () => 'https://synalux.ai/auth?callbackUrl=%2Fprism-aac' }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (select: (s: { profile: typeof mocks.profile }) => unknown) => select({ profile: mocks.profile }) }));
vi.mock('@/lib/datadog', () => ({ ddAction: mocks.ddAction }));
import WebSignInGate from '@/components/WebSignInGate';
import { useSettingsStore } from '@/store/settingsStore';
import { clearVerifiedLocalAccess } from '@/services/webAccessService';
import { useMessageStore } from '@/store/messageStore';

const board = <button>Communication board action</button>;
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

beforeEach(() => {
  vi.clearAllMocks(); mocks.native = false; mocks.profile = null;
  clearVerifiedLocalAccess();
  useMessageStore.setState({ text: '' });
  vi.stubEnv('NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE', '1');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  mocks.access.mockResolvedValue({ state: 'preview', remainingMs: 60_000 });
  useSettingsStore.setState({ language: 'en' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

const gateOutcomes = () => mocks.ddAction.mock.calls
  .filter(([name]) => name === 'aac_web_gate').map(([, ctx]) => (ctx as { outcome: string }).outcome);

describe('full web sign-in gate', () => {
  it('preserves verified local communication after a network failure and offline remount', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    const first = render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    mocks.access.mockRejectedValue(new Error('Offline'));
    fireEvent(window, new Event('focus')); await tick(1);
    expect(screen.getByText('Communication board action')).toBeVisible();
    first.unmount();
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.getByText('Communication board action')).toBeVisible();
    act(() => clearVerifiedLocalAccess()); await tick(1);
    expect(screen.queryByText('Communication board action')).not.toBeInTheDocument();
  });
  it('revokes offline continuity after an explicit server sign-in denial', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    mocks.access.mockResolvedValue({ state: 'sign_in_required', remainingMs: 0 });
    fireEvent(window, new Event('focus')); await tick(1);
    mocks.access.mockRejectedValue(new Error('Offline'));
    fireEvent(window, new Event('focus')); await tick(1);
    expect(screen.queryByText('Communication board action')).not.toBeInTheDocument();
  });
  // Signing out in another tab revokes access while the network is down, so no
  // server answer can report it. Only the revoke path can, and a gate raised
  // with no event behind it is invisible in the funnel.
  it('reports the gate it raises when another tab signs out during an outage', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    mocks.access.mockRejectedValue(new Error('Offline'));
    fireEvent(window, new Event('focus')); await tick(1);
    expect(gateOutcomes()).toEqual(['signed_in', 'offline_continuity']);
    act(() => clearVerifiedLocalAccess()); await tick(1);
    expect(screen.queryByText('Communication board action')).not.toBeInTheDocument();
    expect(gateOutcomes()).toEqual(['signed_in', 'offline_continuity', 'sign_in_required']);
  });
  // Three outcomes decide three different things: whether the rollout is on,
  // whether the network answered, and whether continuity carried the user.
  // Collapsing any of them into signed_in would hide it entirely.
  it('separates a disabled rollout from a signed-in account and from an outage', async () => {
    mocks.access.mockResolvedValue({ state: 'disabled', remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.getByText('Communication board action')).toBeVisible();
    expect(gateOutcomes()).toEqual(['disabled']);
  });
  it('reports an outage that no local session can carry', async () => {
    mocks.access.mockRejectedValue(new Error('Offline'));
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.queryByText('Communication board action')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(gateOutcomes()).toEqual(['error']);
  });
  // Turning the rollout off server-side must not revoke a verified session:
  // that would strand a nonverbal user at the next outage.
  it('keeps offline continuity when the rollout is switched off', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    mocks.access.mockResolvedValue({ state: 'disabled', remainingMs: 0 });
    fireEvent(window, new Event('focus')); await tick(1);
    mocks.access.mockRejectedValue(new Error('Offline'));
    fireEvent(window, new Event('focus')); await tick(1);
    expect(screen.getByText('Communication board action')).toBeVisible();
    expect(gateOutcomes()).toEqual(['signed_in', 'disabled', 'offline_continuity']);
  });
  it('replaces all app interactions after one minute and focuses sign-in information', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>);
    await tick(1);
    expect(screen.getByRole('button', { name: 'Communication board action' })).toBeVisible();
    await tick(59_750);
    expect(screen.getByRole('button', { name: 'Communication board action' })).toBeVisible();
    await tick(250);
    expect(screen.queryByRole('button', { name: 'Communication board action' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Google' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Continue to Google' })).toBeEnabled();
    expect(screen.getByText(/Signing in does not start a paid subscription/)).toBeVisible();
  });
  it('opens the app only after the server confirms a signed-in account', async () => {
    mocks.access.mockResolvedValue({ state: 'sign_in_required', remainingMs: 0 });
    mocks.profile = { email: 'local-profile-only@example.com' };
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.queryByText('Communication board action')).not.toBeInTheDocument();
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Check sign-in again' })); await tick(1);
    expect(screen.getByRole('button', { name: 'Communication board action' })).toBeVisible();
  });
  it('does not extend the preview when a focus response contains a fresh minute', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1); await tick(30_000);
    fireEvent(window, new Event('focus')); await tick(1); await tick(30_000);
    expect(screen.queryByText('Communication board action')).not.toBeInTheDocument();
  });
  it('shows a recoverable connection error without opening the app after a failed check', async () => {
    mocks.access.mockRejectedValue(new Error('Offline'));
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Check your connection');
    expect(screen.queryByText('Communication board action')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check sign-in again' })).toBeEnabled();
  });
  it.each(['native', 'rollout-disabled'])('keeps the existing app available for %s without checking the web preview', async mode => {
    if (mode === 'native') mocks.native = true;
    else vi.stubEnv('NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE', '0');
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(61_000);
    expect(screen.getByRole('button', { name: 'Communication board action' })).toBeVisible();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  // The countdown re-renders roughly four times a second for a minute. A
  // per-render or per-poll event would make the funnel useless and noisy, so
  // the reporter must fire once per decision change and no more.
  it('reports each gate decision exactly once, not once per render', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>);
    await tick(1);
    expect(gateOutcomes()).toEqual(['preview']);
    await tick(59_750);
    expect(gateOutcomes()).toEqual(['preview']);
    await tick(250);
    expect(gateOutcomes()).toEqual(['preview', 'sign_in_required']);
    fireEvent(window, new Event('focus'));
    await tick(1);
    expect(gateOutcomes()).toEqual(['preview', 'sign_in_required']);
  });

  // Offline continuity is not a registration. Counting it as `signed_in`
  // inflated conversion with users the server never confirmed.
  it('reports offline continuity separately from a verified sign-in', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(gateOutcomes()).toEqual(['signed_in']);
    mocks.access.mockRejectedValue(new Error('Offline'));
    fireEvent(window, new Event('focus')); await tick(1);
    expect(screen.getByText('Communication board action')).toBeVisible();
    expect(gateOutcomes()).toEqual(['signed_in', 'offline_continuity']);
  });

  // A cold load while offline shows the board immediately from local access,
  // long before the request fails. That optimistic state is not a decision and
  // must never be reported as a verified sign-in — the fast-failure case hides
  // this, because React coalesces both updates into one render.
  it('never reports a verified sign-in when the server was never reached', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    const online = render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    online.unmount();
    mocks.access.mockImplementation(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('Offline')), 5_000);
    }));
    render(<WebSignInGate>{board}</WebSignInGate>);
    await tick(1);
    expect(screen.getByText('Communication board action')).toBeVisible();
    expect(gateOutcomes()).toEqual(['signed_in']);
    await tick(5_000);
    expect(gateOutcomes()).toEqual(['signed_in', 'offline_continuity']);
  });

  // The poll runs on every focus and every five minutes. Reporting per poll
  // would bury the one event that matters under an unattended tablet's noise.
  // The press that only warns about an unsaved message never leaves the page.
  // Counting it would make departures outnumber arrivals at sign-in.
  it('counts a departure for sign-in, not a press that stayed on the page', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>);
    await tick(1); await tick(60_000);
    const signIn = screen.getByRole('button', { name: 'Continue to Google' });
    // A message the user still needs, and a browser that will not store it.
    useMessageStore.setState({ text: 'I need help' });
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    fireEvent.click(signIn);
    expect(screen.getByText(/could not save your unfinished message/)).toBeVisible();
    expect(gateOutcomes()).not.toContain('sign_in_clicked');
    // The second press is a real departure: it opens the sign-in tab.
    fireEvent.click(signIn);
    expect(gateOutcomes().filter(o => o === 'sign_in_clicked')).toEqual(['sign_in_clicked']);
    blocked.mockRestore();
  });
  it('reports one continuity episode however many polls fail', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    mocks.access.mockRejectedValue(new Error('Offline'));
    for (let i = 0; i < 4; i++) { fireEvent(window, new Event('focus')); await tick(1); }
    await tick(5 * 60_000 + 10);
    expect(gateOutcomes()).toEqual(['signed_in', 'offline_continuity']);
  });

  it('reports the transition when an anonymous visitor becomes signed in', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>);
    await tick(1);
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    fireEvent(window, new Event('focus'));
    await tick(1);
    expect(gateOutcomes()).toEqual(['preview', 'signed_in']);
  });

  it('reports the sign-in press so the funnel can separate leaving from bouncing', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>);
    await tick(1);
    await tick(60_100);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Google' }));
    expect(gateOutcomes()).toEqual(['preview', 'sign_in_required', 'sign_in_clicked']);
  });

  it.each([['disabled by configuration', () => { vi.stubEnv('NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE', '0'); }],
    ['running inside the native app', () => { mocks.native = true; }]] as const)(
    'stays silent when the gate is %s', async (_label, setup) => {
      setup();
      render(<WebSignInGate>{board}</WebSignInGate>);
      await tick(1);
      await tick(61_000);
      expect(gateOutcomes()).toEqual([]);
    });
});
