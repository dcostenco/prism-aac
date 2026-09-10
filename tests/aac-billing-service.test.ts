import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { purchaseAacWithApple, restoreAacApplePurchases } from '@/services/aacBillingService';

const account = '11111111-1111-4111-8111-111111111111';
const offerVersion = 'test-offer-v1';
const billing = { userId: account, hasCloudAccess: true, betaExempt: false, transitionEndsAt: null,
  channels: ['apple'], manageChannel: 'apple', enabled: true,
  offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly' } };
const transaction = { transactionId: '20001', jws: 'test-signed-payload' };
const foreignTransaction = { transactionId: '30001', jws: 'other-account-signed-payload' };
type BridgeRequest = { id: string; operation: string; transactionId?: string; accountToken?: string };
type BridgeHost = {
  prismNativeBridge?: { subscription: (request: BridgeRequest) => void };
  prismSubscriptionResult: (message: { id: string; result?: unknown; error?: string }) => void;
};
const host = window as unknown as BridgeHost;
const calls: string[] = [];
let nativeStatus = 'purchased';
let deliveryStatus = 200;
/** Non-null to serve a body the portal never sends — an edge proxy's HTML. */
let deliveryBody: string | null = null;
/** Overridden to have the portal acknowledge a different transaction than the one sent. */
let acknowledgeTransactionId: string | null = null;
let nativeTransactions: Array<{ transactionId: string; jws: string }> = [transaction];

beforeEach(() => {
  calls.length = 0; nativeStatus = 'purchased'; deliveryStatus = 200; deliveryBody = null;
  acknowledgeTransactionId = null;
  nativeTransactions = [transaction];
  host.prismNativeBridge = { subscription: (request: BridgeRequest) => {
    calls.push(request.operation === 'finish' ? `finish:${request.transactionId}` : request.operation);
    if (request.operation === 'purchase') expect(request.accountToken).toBe(account);
    host.prismSubscriptionResult({ id: request.id, result: request.operation === 'finish'
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
      if (deliveryBody !== null) {
        return new Response(deliveryBody, { status: 400, headers: { 'Content-Type': 'text/html' } });
      }
      return Response.json({ error: 'Apple subscription belongs to another AAC account' }, { status: 400 });
    }
    if (body.action === 'reconcile') return Response.json(deliveryStatus === 200
      ? { status: 'reconciled', transactionId: acknowledgeTransactionId ?? transaction.transactionId }
      : { error: 'Verification unavailable' }, { status: deliveryStatus });
    return Response.json(billing);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); delete host.prismNativeBridge; });

describe('Apple purchase delivery', () => {
  it('coalesces overlapping automatic recovery for the same account', async () => {
    nativeStatus = 'restored';
    await Promise.all([restoreAacApplePurchases(false, account), restoreAacApplePurchases(false, account)]);
    expect(calls).toEqual(['sync', 'reconcile', 'finish:20001', 'status']);
  });
  // Reconcile granted the entitlement; finishing is Apple-side bookkeeping and
  // an unfinished transaction is simply replayed. Failing the purchase here
  // would report a delivered subscription as a failed one.
  it('completes a delivered purchase whose transaction could not be finished', async () => {
    host.prismNativeBridge = { subscription: (request: BridgeRequest) => {
      calls.push(request.operation === 'finish' ? `finish:${request.transactionId}` : request.operation);
      if (request.operation === 'finish') {
        host.prismSubscriptionResult({ id: request.id, error: 'Timed out' });
        return;
      }
      host.prismSubscriptionResult({ id: request.id,
        result: { status: nativeStatus, transactions: nativeTransactions } });
    } };
    const result = await purchaseAacWithApple(account, offerVersion);
    expect(result.status).toBe('purchased');
    expect(result.billing?.hasCloudAccess).toBe(true);
    expect(calls).toEqual(['prepare', 'purchase', 'reconcile', 'finish:20001', 'status']);
  });
  it('binds the account before purchase and finishes only after the server confirms delivery', async () => {
    expect((await purchaseAacWithApple(account, offerVersion)).billing?.hasCloudAccess).toBe(true);
    expect(calls).toEqual(['prepare', 'purchase', 'reconcile', 'finish:20001', 'status']);
  });
  // The account is charged before delivery is attempted, so no delivery failure
  // may be reported as a failed purchase — whatever the status. An earlier
  // attempt rethrew the ones that looked permanent; the caller renders
  // `error.message` raw, which put an untranslated English server sentence in
  // front of every locale and filed a paid conversion as `purchase_failed`.
  it.each([
    [400, 'a permanent rejection'],
    [401, 'an expired session'],
    [429, 'an exhausted delivery budget'],
    [503, 'an unreachable verifier'],
  ])('reports %i (%s) as undelivered rather than failing a charged purchase', async (status) => {
    deliveryStatus = status;
    await expect(purchaseAacWithApple(account, offerVersion)).resolves.toEqual({ status: 'undelivered' });
    expect(calls).not.toContain('finish:20001');
  });

  // The card is already charged. Surfacing that as a failure would tell the user
  // nothing happened; folding it into StoreKit's 'pending' would tell them to
  // wait for an Apple approval that already happened. It gets its own status.
  it('reports an interrupted delivery as undelivered, not pending, and leaves it recoverable', async () => {
    deliveryStatus = 503;
    await expect(purchaseAacWithApple(account, offerVersion)).resolves.toEqual({ status: 'undelivered' });
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
  it('automatic recovery skips a transaction bound to another AAC account without blocking the rest', async () => {
    // Shared device: the Apple ID holds a subscription bound to a different AAC
    // account. That one is rejected (400); it must not throw — which would back
    // ApplePurchaseRecovery off and stall delivery for everyone on the device —
    // and must not stop the signed-in account's own transaction from being
    // delivered and finished. It is skipped, not abandoned: it stays unfinished
    // and is re-sent on the next sync, so it lands as soon as its owner signs in.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    nativeStatus = 'restored'; nativeTransactions = [foreignTransaction, transaction];
    const status = await restoreAacApplePurchases(false, account);
    expect(status.hasCloudAccess).toBe(true);
    expect(calls).toEqual(['sync', 'reconcile', 'reconcile', 'finish:20001', 'status']);
    expect(calls).not.toContain('finish:30001');
    expect(warn).toHaveBeenCalledTimes(1);
  });
  // The reply has to be about the transaction that was sent. A 200 acknowledging
  // some other transaction — a mixed-up retry, a proxy replaying a cached body —
  // must not finish this one, because finishing tells Apple to stop replaying it
  // and the entitlement it was carrying would be lost for good.
  it('does not finish a transaction the portal did not acknowledge', async () => {
    acknowledgeTransactionId = '99999';
    await expect(purchaseAacWithApple(account, offerVersion)).resolves.toEqual({ status: 'undelivered' });
    expect(calls).not.toContain('finish:20001');
  });

  it('tolerates a rejection whose body is not JSON, and still delivers the rest', async () => {
    // The portal is not the only thing that can answer: an edge proxy or a WAF
    // rejects with HTML. Parsing the body before reading the status turned that
    // into a SyntaxError carrying no status, so it missed the 400 branch, threw,
    // and abandoned the signed-in account's own transaction along with it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    deliveryBody = '<html><body>400 Bad Request</body></html>';
    nativeStatus = 'restored'; nativeTransactions = [foreignTransaction, transaction];
    const status = await restoreAacApplePurchases(false, account);
    expect(status.hasCloudAccess).toBe(true);
    expect(calls).toEqual(['sync', 'reconcile', 'reconcile', 'finish:20001', 'status']);
    expect(warn.mock.calls.map(c => String(c[0]))).toContain(
      '[AAC billing] An Apple transaction was rejected for this account; it stays unfinished and is re-sent on the next sync');
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
