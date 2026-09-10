import { SYNALUX_API, timeoutSignal } from '@/lib/portalConfig';

export interface AacBillingStatus {
  userId: string;
  hasCloudAccess: boolean;
  betaExempt: boolean;
  transitionEndsAt: string | null;
  channels: Array<'apple' | 'stripe'>;
  manageChannel: 'apple' | 'stripe' | null;
  purchaseBlocked?: boolean;
  enabled: boolean;
  offer: { usdMonthly: number; appleProductId: string; monthlySpeechCharacters?: number; monthlyAiRequests?: number; version?: string; allowanceReset?: string };
}

interface AppleTransaction { transactionId: string; jws: string }
interface NativeResult {
  id?: string;
  displayPrice?: string;
  status?: 'purchased' | 'restored' | 'cancelled' | 'pending' | 'finished' | 'managed';
  transactions?: AppleTransaction[];
}
interface SubscriptionWindow extends Window {
  prismNativeBridge?: { subscription?: (request: Record<string, string>) => void };
  prismSubscriptionResult?: (result: { id: string; result?: NativeResult; error?: string }) => void;
}

const ERRORS = {
  unavailable: 'Cloud plan details are temporarily unavailable. Please try again.',
  native: 'Update Prism AAC to use Apple purchases.',
  timeout: 'The purchase has not finished. You can check your plan or restore it later.',
  invalid: 'The payment provider returned an unexpected response. Please try again.',
  conflict: 'Your account already has access or a purchase in progress. Refresh your plan before trying again.',
};
/** Carries the HTTP status so callers can tell a permanent rejection from an outage. */
export class AacBillingRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'AacBillingRequestError'; }
}
const pending = new Map<string, { resolve: (value: NativeResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
export const AAC_BILLING_UPDATED = 'prismAacBillingUpdated';
const automaticRestores = new Map<string, Promise<AacBillingStatus>>();

export function hasNativePurchases(): boolean {
  return typeof window !== 'undefined' && typeof (window as SubscriptionWindow).prismNativeBridge?.subscription === 'function';
}

export function nativeSubscription(operation: string, fields: Record<string, string> = {}): Promise<NativeResult> {
  if (!hasNativePurchases()) return Promise.reject(new Error(ERRORS.native));
  const nativeWindow = window as SubscriptionWindow;
  nativeWindow.prismSubscriptionResult = message => {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error));
    else if (message.result) waiter.resolve(message.result);
    else waiter.reject(new Error(ERRORS.invalid));
  };
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(ERRORS.timeout)); }, operation === 'purchase' ? 180_000 : 45_000);
    pending.set(id, { resolve, reject, timer });
    try { nativeWindow.prismNativeBridge!.subscription!({ ...fields, id, operation }); }
    catch (error) {
      clearTimeout(timer); pending.delete(id);
      reject(error instanceof Error ? error : new Error(ERRORS.native));
    }
  });
}

async function billingRequest<T>(suffix = '', body?: Record<string, unknown>): Promise<T> {
  const timeout = timeoutSignal(30_000);
  try {
    const response = await fetch(`${SYNALUX_API}/prism-aac/${suffix || 'billing'}`, {
      method: body ? 'POST' : 'GET', credentials: 'include', signal: timeout.signal,
      headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new AacBillingRequestError(result.error || (response.status === 409 ? ERRORS.conflict : ERRORS.unavailable), response.status);
    }
    return result as T;
  } finally { timeout.cancel(); }
}

export const fetchAacBillingStatus = () => billingRequest<AacBillingStatus>();

/**
 * Delivery confirmation precedes finish; interrupted delivery remains restorable.
 *
 * A 400 from the portal is a permanent verification rejection for that one
 * transaction (for example, an Apple subscription bound to a different AAC
 * account on a shared device). It must not block delivery of the remaining
 * transactions, and automatic recovery must not retry it every 30 seconds.
 * Transport and 5xx failures still propagate so recovery retries them.
 */
async function deliverAppleTransactions(transactions: AppleTransaction[] = [], tolerateRejected = false): Promise<AacBillingStatus> {
  let rejected: Error | null = null;
  for (const transaction of transactions) {
    if (!transaction.transactionId || !transaction.jws) throw new Error(ERRORS.invalid);
    try {
      const delivered = await billingRequest<{ status: string; transactionId: string }>('billing/apple',
        { action: 'reconcile', jws: transaction.jws });
      if (delivered.status !== 'reconciled' || delivered.transactionId !== transaction.transactionId) throw new Error(ERRORS.invalid);
    } catch (error) {
      if (error instanceof AacBillingRequestError && error.status === 400) {
        rejected ??= error;
        continue;
      }
      throw error;
    }
    // Reconcile already granted the entitlement; finishing is Apple-side
    // bookkeeping. An unfinished transaction is replayed on the next launch and
    // reconciled again, so this must not fail a delivery that already worked.
    try { await nativeSubscription('finish', { transactionId: transaction.transactionId }); }
    catch (error) {
      console.warn('[AAC billing] Could not finish an Apple transaction; Apple will replay it',
        error instanceof Error ? error.message : error);
    }
  }
  if (rejected) {
    if (!tolerateRejected) throw rejected;
    console.warn('[AAC billing] An Apple transaction was rejected for this account and will not be retried automatically', rejected.message);
  }
  return fetchAacBillingStatus();
}

export async function purchaseAacWithApple(expectedUserId: string, expectedOfferVersion: string): Promise<{ status: string; billing?: AacBillingStatus }> {
  const prepared = await billingRequest<{ accountToken: string }>('billing/apple',
    { action: 'prepare', expectedUserId, expectedOfferVersion });
  if (!prepared.accountToken || prepared.accountToken !== expectedUserId) throw new Error(ERRORS.invalid);
  const result = await nativeSubscription('purchase', { accountToken: prepared.accountToken });
  if (result.status === 'cancelled' || result.status === 'pending') return { status: result.status };
  if (result.status !== 'purchased' || !result.transactions?.length) throw new Error(ERRORS.invalid);
  // The account is charged from here on. If delivery cannot be confirmed the
  // transaction stays unfinished, Apple replays it and the automatic restore
  // completes it, so this is not a failed purchase. It is reported as its own
  // status rather than folded into 'pending': StoreKit's own pending means Ask
  // to Buy, where nothing was charged, and a charged customer told to "wait for
  // Apple approval" is being given the wrong explanation for the wrong problem.
  try {
    return { status: 'purchased', billing: await deliverAppleTransactions(result.transactions) };
  } catch (error) {
    // A 400 is a permanent verification rejection for this transaction — an
    // Apple subscription bound to a different AAC account is the usual cause.
    // Recovery deliberately never retries it, so it must not be reported as
    // undelivered: that copy promises it will finish on its own, and it will
    // not. The server's message explains the actual problem.
    if (error instanceof AacBillingRequestError && error.status === 400) throw error;
    console.warn('[AAC billing] Apple charged the account but delivery did not confirm; it will be retried',
      error instanceof Error ? error.message : error);
    return { status: 'undelivered' };
  }
}

export async function restoreAacApplePurchases(explicit = true, accountScope = ''): Promise<AacBillingStatus> {
  const pendingRestore = automaticRestores.get(accountScope);
  if (!explicit && pendingRestore) return pendingRestore;
  const run = async () => {
    const result = await nativeSubscription(explicit ? 'restore' : 'sync');
    const billing = await deliverAppleTransactions(result.transactions, !explicit);
    window.dispatchEvent(new Event(AAC_BILLING_UPDATED));
    return billing;
  };
  if (explicit) return run();
  const restore = run().finally(() => { automaticRestores.delete(accountScope); });
  automaticRestores.set(accountScope, restore);
  return restore;
}

function openStripe(url: string, host: string) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.hostname !== host) throw new Error(ERRORS.invalid);
  window.location.assign(target.href);
}

export async function purchaseAacWithStripe(expectedUserId: string, expectedOfferVersion: string): Promise<void> {
  const result = await billingRequest<{ url: string }>('checkout',
    { plan: 'aac_standard', currency: 'usd', expectedUserId, expectedOfferVersion });
  openStripe(result.url, 'checkout.stripe.com');
}

export async function manageAacSubscription(channel: 'apple' | 'stripe') {
  if (channel === 'apple') {
    if (hasNativePurchases()) await nativeSubscription('manage');
    else window.location.assign('https://apps.apple.com/account/subscriptions');
    return;
  }
  const result = await billingRequest<{ url: string }>('billing', { action: 'manage' });
  openStripe(result.url, 'billing.stripe.com');
}
