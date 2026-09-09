import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), native: false, profile: null as null | { email: string }, ddAction: vi.fn() }));
vi.mock('@/services/webAccessService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/webAccessService')>(), fetchWebAccess: mocks.access,
}));
vi.mock('@/services/aiService', () => ({ isNativeiOS: () => mocks.native,
  synaluxSignInUrl: () => 'https://synalux.ai/auth?callbackUrl=%2Fprism-aac' }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (select: any) => select({ profile: mocks.profile }) }));
vi.mock('@/lib/datadog', () => ({ ddAction: mocks.ddAction }));
import WebSignInGate from '@/components/WebSignInGate';
import { useSettingsStore } from '@/store/settingsStore';
import { clearVerifiedLocalAccess } from '@/services/webAccessService';

const board = <button>Communication board action</button>;
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

beforeEach(() => {
  vi.clearAllMocks(); mocks.native = false; mocks.profile = null;
  clearVerifiedLocalAccess();
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
