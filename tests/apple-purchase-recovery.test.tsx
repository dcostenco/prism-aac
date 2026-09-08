import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ profile: { email: 'recovery@example.com' } as {email: string} | null,
  native: true, restore: vi.fn() }));
vi.mock('@/store/authStore', () => ({ useAuthStore: Object.assign((select: any) => select(state), { getState: () => state }) }));
vi.mock('@/services/aacBillingService', () => ({ hasNativePurchases: () => state.native, restoreAacApplePurchases: state.restore }));
import ApplePurchaseRecovery from '@/components/ApplePurchaseRecovery';
const tick = async (ms = 1) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); state.native = true; state.profile = { email: 'recovery@example.com' };
  state.restore.mockResolvedValue({ hasCloudAccess: true });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('recovers on launch and receives pending transactions while Settings is closed', async () => {
  const view = render(<ApplePurchaseRecovery />); await tick();
  expect(state.restore).toHaveBeenCalledWith(false, state.profile!.email);
  fireEvent(window, new Event('prismSubscriptionChanged')); await tick();
  expect(state.restore).toHaveBeenCalledTimes(2);
  view.unmount(); fireEvent(window, new Event('focus')); await tick(300_001);
  expect(state.restore).toHaveBeenCalledTimes(2);
});

it('retries failed delivery when connectivity returns and changes the recovery account', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  state.restore.mockRejectedValueOnce(new Error('Offline'));
  const view = render(<ApplePurchaseRecovery />); await tick();
  fireEvent(window, new Event('online')); await tick();
  expect(state.restore).toHaveBeenCalledTimes(2);
  state.profile = { email: 'next-account@example.com' };
  view.rerender(<ApplePurchaseRecovery />); await tick();
  expect(state.restore).toHaveBeenLastCalledWith(false, state.profile.email);
  state.profile = null; view.rerender(<ApplePurchaseRecovery />);
  await tick(300_001); expect(state.restore).toHaveBeenCalledTimes(3);
});

it('backs off repeated delivery failures instead of retrying every 30 seconds', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  state.restore.mockRejectedValue(new Error('Verification unavailable'));
  render(<ApplePurchaseRecovery />); await tick();
  expect(state.restore).toHaveBeenCalledTimes(1);
  await tick(30_000); expect(state.restore).toHaveBeenCalledTimes(2);   // 30 s
  await tick(30_000); expect(state.restore).toHaveBeenCalledTimes(2);   // now waiting 60 s
  await tick(30_000); expect(state.restore).toHaveBeenCalledTimes(3);   // 60 s elapsed
  await tick(120_000); expect(state.restore).toHaveBeenCalledTimes(4);  // 120 s
  state.restore.mockResolvedValue({ hasCloudAccess: true });
  await tick(240_000); expect(state.restore).toHaveBeenCalledTimes(5);  // 240 s, succeeds → resets
  await tick(300_000); expect(state.restore).toHaveBeenCalledTimes(6);  // back to 5 min cadence
});

it('rate-limits focus/online hints to once a minute but syncs StoreKit changes immediately', async () => {
  render(<ApplePurchaseRecovery />); await tick();
  expect(state.restore).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 5; i += 1) { fireEvent(window, new Event('focus')); fireEvent(window, new Event('online')); await tick(); }
  expect(state.restore).toHaveBeenCalledTimes(1);           // hints within 60 s are ignored
  fireEvent(window, new Event('prismSubscriptionChanged')); await tick();
  expect(state.restore).toHaveBeenCalledTimes(2);           // StoreKit change always syncs
  await tick(60_000); fireEvent(window, new Event('focus')); await tick();
  expect(state.restore).toHaveBeenCalledTimes(3);           // a hint after the interval runs
});

it('does not invoke StoreKit in a web client', async () => {
  state.native = false; render(<ApplePurchaseRecovery />); await tick();
  expect(state.restore).not.toHaveBeenCalled();
});
