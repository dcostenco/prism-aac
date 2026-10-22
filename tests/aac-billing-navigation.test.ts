import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAacBillingStatus, purchaseAacWithStripe, manageAacSubscription } from '@/services/aacBillingService';
import { useMessageStore } from '@/store/messageStore';
import { recoverWebSignInDraft, WEB_SIGNIN_DRAFT_KEY } from '@/services/webSignInDraft';

const assign = vi.fn();
const CHECKOUT = 'https://checkout.stripe.com/';
const PORTAL = 'https://billing.stripe.com/';
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
  sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
  useMessageStore.setState({ text: 'I need to keep speaking' });
  vi.stubGlobal('window', { location: { assign } }); assign.mockReset();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('billing navigation preserves communication before leaving', () => {
  it('does not reuse a cached account response, including under older API-caching workers', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ userId: 'network-account' }) });
    vi.stubGlobal('fetch', fetcher);
    await fetchAacBillingStatus(); await fetchAacBillingStatus();
    const [first, second] = fetcher.mock.calls;
    expect(first[0]).not.toBe(second[0]);
    expect(new URL(first[0]).pathname).toMatch(/\/prism-aac\/billing$/);
    expect(new URL(first[0]).searchParams.get('identityRequest')).toBeTruthy();
    expect(first[1]).toMatchObject({ cache: 'no-store', credentials: 'include' });
  });
  it('waits for device persistence before Stripe navigation and keeps the board on storage rejection', async () => {
    const persist = vi.fn();
    Object.assign(window, { prismNativeBridge: { billingDraft: persist } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: CHECKOUT }) }));
    const purchase = purchaseAacWithStripe('review-account', 'review-offer');
    const rejected = expect(purchase).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ operation: 'save', text: 'I need to keep speaking', account: 'review-account' }));
    expect(assign).not.toHaveBeenCalled();
    const request = persist.mock.calls[0][0];
    Reflect.get(window, 'prismBillingDraftResult')({ id: request.id, error: 'locked' });
    await rejected;
    expect(assign).not.toHaveBeenCalled();
    expect(useMessageStore.getState().text).toBe('I need to keep speaking');
  });
  it.each(['checkout', 'manage', 'apple-manage'])('restores the current message after %s, without a gate listener', async operation => {
    const url = operation === 'checkout' ? CHECKOUT : PORTAL;
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) });
    vi.stubGlobal('fetch', fetcher);
    assign.mockImplementation(() => {
      expect(JSON.parse(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)!).text).toBe('I need to keep speaking');
    });
    if (operation === 'checkout') await purchaseAacWithStripe('review-account', 'review-offer');
    else await manageAacSubscription(operation === 'manage' ? 'stripe' : 'apple');
    expect(assign).toHaveBeenCalledOnce();
    if (operation === 'checkout') expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      expectedUserId: 'review-account', expectedOfferVersion: 'review-offer', plan: 'aac_standard', currency: 'usd',
    });
    useMessageStore.setState({ text: '' }); vi.advanceTimersByTime(59 * 60_000); recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('I need to keep speaking');
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });
  it('keeps the current board when a nonempty draft cannot be saved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: CHECKOUT }) }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await expect(purchaseAacWithStripe('review-account', 'review-offer')).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();
    expect(useMessageStore.getState().text).toBe('I need to keep speaking');
  });
  it('rejects a provider lookalike before storing private text or navigating', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://checkout.stripe.com.example.invalid/' }) }));
    await expect(purchaseAacWithStripe('review-account', 'review-offer')).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled(); expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });
});
