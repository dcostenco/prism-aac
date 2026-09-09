import { beforeEach, describe, expect, it, vi } from 'vitest';
const dd = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock('@/lib/datadog', () => ({ ddAction: dd.action }));
import { reportCloudPlan, reportWebGate, firstOfferImpression, offerImpressionKey, resetMonetizationTelemetry, CLOUD_PLAN_ACTION, WEB_GATE_ACTION } from '@/services/monetizationTelemetry';

// A reload keeps sessionStorage and drops the module's in-memory set, which is
// the only way to exercise the stored half of the impression guard.
const reload = () => import('@/services/monetizationTelemetry');

beforeEach(() => vi.clearAllMocks());

describe('monetization telemetry payloads', () => {
    it('reports a gate outcome under a stable action name', () => {
        reportWebGate('sign_in_required');
        expect(dd.action).toHaveBeenCalledWith('aac_web_gate', { outcome: 'sign_in_required' });
        expect(WEB_GATE_ACTION).toBe('aac_web_gate');
    });

    it('reports a plan event with the platform that produced it', () => {
        reportCloudPlan('purchase_complete', 'ios');
        expect(dd.action).toHaveBeenCalledWith('aac_cloud_plan', { event: 'purchase_complete', platform: 'ios' });
        expect(CLOUD_PLAN_ACTION).toBe('aac_cloud_plan');
    });

    // The privacy control is the payload shape itself: an AAC utterance, board,
    // account or price must have no field it could travel in.
    it('never emits a field beyond the declared enums', () => {
        reportWebGate('preview');
        reportCloudPlan('offer_shown', 'web');
        // Without this the loop passes over an empty call list and asserts nothing.
        expect(dd.action).toHaveBeenCalledTimes(2);
        for (const [, context] of dd.action.mock.calls) {
            expect(Object.keys(context as object).sort()).toSatisfy((keys: string[]) =>
                keys.join(',') === 'outcome' || keys.join(',') === 'event,platform');
            for (const value of Object.values(context as Record<string, unknown>)) {
                expect(typeof value).toBe('string');
                expect(String(value)).toMatch(/^[a-z_]+$/);
            }
        }
    });

    // The reporters run inside the gate's render effect and inside the purchase
    // and restore handlers. A throw there would blank the app or abort a
    // purchase, so a broken tracker must stay silent rather than propagate.
    it('cannot break communication or a purchase when telemetry delivery fails', () => {
        dd.action.mockImplementation(() => { throw new Error('RUM unavailable'); });
        expect(() => reportWebGate('error')).not.toThrow();
        expect(() => reportCloudPlan('purchase_started', 'ios')).not.toThrow();
    });
});

// Datadog charges for what is ingested, so a loop anywhere upstream must not
// be able to spend without limit.
describe('per-tab event budget', () => {
    beforeEach(() => resetMonetizationTelemetry());

    it('stops reporting once a tab has spent its budget', () => {
        for (let i = 0; i < 200; i++) reportWebGate('preview');
        expect(dd.action).toHaveBeenCalledTimes(40);
        dd.action.mockClear();
        reportCloudPlan('purchase_started', 'web');
        expect(dd.action).not.toHaveBeenCalled();
    });

    it('spends the budget across both actions, not once each', () => {
        for (let i = 0; i < 30; i++) reportWebGate('preview');
        for (let i = 0; i < 30; i++) reportCloudPlan('offer_shown', 'web');
        expect(dd.action).toHaveBeenCalledTimes(40);
    });
});

describe('offer impression de-duplication', () => {
    beforeEach(() => { resetMonetizationTelemetry(); vi.resetModules(); });

    it('counts one visitor once across a reload of the same tab', async () => {
        expect(firstOfferImpression('web:owner@example.com')).toBe(true);
        const reloaded = await reload();
        expect(reloaded.firstOfferImpression('web:owner@example.com')).toBe(false);
        expect(reloaded.firstOfferImpression('web:other@example.com')).toBe(true);
    });

    // The cap bounds the stored list. Trimming the wrong end would evict the
    // newest visitor first, so the current account is re-counted on every reload.
    it('keeps the newest visitors when the stored list is capped', async () => {
        for (let i = 0; i < 24; i++) expect(firstOfferImpression(`web:user${i}@example.com`)).toBe(true);
        const reloaded = await reload();
        expect(reloaded.firstOfferImpression('web:user23@example.com')).toBe(false);
        expect(JSON.parse(sessionStorage.getItem('prism-aac-offer-impressions')!)).toHaveLength(20);
    });

    it('repairs a corrupt stored list instead of re-counting forever', async () => {
        sessionStorage.setItem('prism-aac-offer-impressions', '{not json');
        expect(firstOfferImpression('web:owner@example.com')).toBe(true);
        expect(sessionStorage.getItem('prism-aac-offer-impressions')).toBeNull();
        const reloaded = await reload();
        expect(reloaded.firstOfferImpression('web:owner@example.com')).toBe(true);
        expect(reloaded.firstOfferImpression('web:owner@example.com')).toBe(false);
    });

    // The stored list must not become a readable roster of who used a shared
    // device, and it must not outlive the person who used it.
    it('stores no account address, and forgets the visitor on sign-out', () => {
        const key = offerImpressionKey('web', 'Care.Giver@Example.com');
        expect(key).not.toContain('@');
        expect(key).not.toContain('Care');
        expect(key).toMatch(/^web:[a-z0-9]+$/);
        expect(offerImpressionKey('web', 'care.giver@example.com ')).toBe(key);
        expect(offerImpressionKey('web', 'someone.else@example.com')).not.toBe(key);
        firstOfferImpression(key);
        expect(sessionStorage.getItem('prism-aac-offer-impressions')).not.toContain('@');
        resetMonetizationTelemetry();
        expect(sessionStorage.getItem('prism-aac-offer-impressions')).toBeNull();
        expect(firstOfferImpression(key)).toBe(true);
    });

    it('still counts once per page when storage is blocked', () => {
        const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        expect(firstOfferImpression('web:owner@example.com')).toBe(true);
        expect(firstOfferImpression('web:owner@example.com')).toBe(false);
        blocked.mockRestore();
    });
});
