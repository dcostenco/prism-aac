import { beforeEach, describe, expect, it, vi } from 'vitest';
const dd = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock('@/lib/datadog', () => ({ ddAction: dd.action }));
import { reportCloudPlan, reportWebGate, CLOUD_PLAN_ACTION, WEB_GATE_ACTION } from '@/services/monetizationTelemetry';

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
