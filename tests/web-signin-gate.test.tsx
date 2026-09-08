import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), native: false, profile: null as null | { email: string } }));
vi.mock('@/services/webAccessService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/webAccessService')>(), fetchWebAccess: mocks.access,
}));
vi.mock('@/services/aiService', () => ({ isNativeiOS: () => mocks.native,
  synaluxSignInUrl: () => 'https://synalux.ai/auth?callbackUrl=%2Fprism-aac' }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (select: any) => select({ profile: mocks.profile }) }));
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
});
