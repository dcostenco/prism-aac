import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { purchaseAacWithApple, restoreAacApplePurchases } from '@/services/aacBillingService';

const account = '11111111-1111-4111-8111-111111111111';
const offerVersion = 'test-offer-v1';
const billing = { userId: account, hasCloudAccess: true, betaExempt: false, transitionEndsAt: null,
  channels: ['apple'], manageChannel: 'apple', enabled: true,
  offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly' } };
const transaction = { transactionId: '20001', jws: 'test-signed-payload' };
const foreignTransaction = { transactionId: '30001', jws: 'other-account-signed-payload' };
const calls: string[] = [];
let nativeStatus = 'purchased';
let deliveryStatus = 200;
let nativeTransactions: Array<{ transactionId: string; jws: string }> = [transaction];

beforeEach(() => {
  calls.length = 0; nativeStatus = 'purchased'; deliveryStatus = 200; nativeTransactions = [transaction];
  (window as any).prismNativeBridge = { subscription: (request: any) => {
    calls.push(request.operation === 'finish' ? `finish:${request.transactionId}` : request.operation);
    if (request.operation === 'purchase') expect(request.accountToken).toBe(account);
    (window as any).prismSubscriptionResult({ id: request.id, result: request.operation === 'finish'
      ? { status: 'finished' } : { status: nativeStatus, transactions: nativeTransactions } });
  } };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    expect(init.credentials).toBe('include');
    const body = init.body ? JSON.parse(init.body as string) : {};
    calls.push(body.action || 'status');
    if (body.action === 'prepare') {
      expect(body.expectedUserId).toBe(account);
      expect(body.expectedOfferVersion).toBe(offerVersion);
      return Response.json({ accountToken: account });
    }
    if (body.action === 'reconcile' && body.jws === foreignTransaction.jws) {
      return Response.json({ error: 'Apple subscription belongs to another AAC account' }, { status: 400 });
    }
    if (body.action === 'reconcile') return Response.json(deliveryStatus === 200
      ? { status: 'reconciled', transactionId: transaction.transactionId }
      : { error: 'Verification unavailable' }, { status: deliveryStatus });
    return Response.json(billing);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); delete (window as any).prismNativeBridge; });

describe('Apple purchase delivery', () => {
  it('coalesces overlapping automatic recovery for the same account', async () => {
    nativeStatus = 'restored';
    await Promise.all([restoreAacApplePurchases(false, account), restoreAacApplePurchases(false, account)]);
    expect(calls).toEqual(['sync', 'reconcile', 'finish:20001', 'status']);
  });
  it('binds the account before purchase and finishes only after the server confirms delivery', async () => {
    expect((await purchaseAacWithApple(account, offerVersion)).billing?.hasCloudAccess).toBe(true);
    expect(calls).toEqual(['prepare', 'purchase', 'reconcile', 'finish:20001', 'status']);
  });
  it('leaves an interrupted delivery unfinished so Restore Purchases can recover it', async () => {
    deliveryStatus = 503;
    await expect(purchaseAacWithApple(account, offerVersion)).rejects.toThrow('Verification unavailable');
    expect(calls).not.toContain('finish:20001');
    calls.length = 0; deliveryStatus = 200; nativeStatus = 'restored';
    await restoreAacApplePurchases();
    expect(calls).toEqual(['restore', 'reconcile', 'finish:20001', 'status']);
  });
  it.each(['pending', 'cancelled'])('does not grant access or finish a %s purchase', async (status) => {
    nativeStatus = status;
    expect(await purchaseAacWithApple(account, offerVersion)).toEqual({ status });
    expect(calls).toEqual(['prepare', 'purchase']);
  });
  it('automatic recovery skips a transaction bound to another AAC account without blocking the rest or retrying', async () => {
    // Shared device: the Apple ID holds a subscription bound to a different AAC
    // account. That one is rejected permanently (400); it must not throw (which
    // would make ApplePurchaseRecovery retry every 30 s) and must not stop the
    // signed-in account's own transaction from being delivered and finished.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    nativeStatus = 'restored'; nativeTransactions = [foreignTransaction, transaction];
    const status = await restoreAacApplePurchases(false, account);
    expect(status.hasCloudAccess).toBe(true);
    expect(calls).toEqual(['sync', 'reconcile', 'reconcile', 'finish:20001', 'status']);
    expect(calls).not.toContain('finish:30001');
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('explicit restore still reports a foreign-account rejection after delivering the rest', async () => {
    nativeStatus = 'restored'; nativeTransactions = [foreignTransaction, transaction];
    await expect(restoreAacApplePurchases()).rejects.toThrow('another AAC account');
    expect(calls).toEqual(['restore', 'reconcile', 'reconcile', 'finish:20001']);
  });
  it('still retries automatic recovery after an outage (5xx is not a permanent rejection)', async () => {
    deliveryStatus = 503; nativeStatus = 'restored';
    await expect(restoreAacApplePurchases(false, account)).rejects.toThrow('Verification unavailable');
    expect(calls).toEqual(['sync', 'reconcile']);
  });
  it('does not open Apple purchase when the prepared account differs from the reviewed account', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ accountToken: 'another-account' }));
    await expect(purchaseAacWithApple(account, offerVersion)).rejects.toThrow('unexpected response');
    expect(calls).not.toContain('purchase');
  });
});
