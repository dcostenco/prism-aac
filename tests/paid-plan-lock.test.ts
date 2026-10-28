import { describe, expect, it } from 'vitest';
import { decideLock, type LockInputs } from '@/services/paidPlanLock';

const base: LockInputs = { enabled: true, native: false, nativePurchases: false,
  online: { entitlement: { state: 'paid', accessUntil: null, policyVersion: 'v' } }, policySeen: true, leaseState: null };
const online = (state: string) => ({ entitlement: { state, accessUntil: null, policyVersion: 'v' } }) as LockInputs['online'];

describe('paid-plan lock decision', () => {
  it('never locks when the build has the lock off', () => {
    expect(decideLock({ ...base, enabled: false, online: online('expired') })).toBe('unlocked');
  });

  it.each(['included', 'beta', 'paid', 'grace', 'pre_cutover_free'])('%s is unlocked', state => {
    expect(decideLock({ ...base, online: online(state) })).toBe('unlocked');
  });

  it.each(['expired', 'none'])('%s is locked', state => {
    expect(decideLock({ ...base, online: online(state) })).toBe('locked');
  });

  it('a server answer without an entitlement (policy off) never locks', () => {
    expect(decideLock({ ...base, online: {} })).toBe('unlocked');
  });

  it('an App Store build that cannot buy in-app is asked to update, never locked', () => {
    expect(decideLock({ ...base, native: true, nativePurchases: false, online: online('expired') })).toBe('update_app');
    expect(decideLock({ ...base, native: true, nativePurchases: true, online: online('expired') })).toBe('locked');
  });

  it('an entitled account, or any account while the policy is off, is never asked to update', () => {
    const old = { ...base, native: true, nativePurchases: false };
    expect(decideLock({ ...old, online: online('paid') })).toBe('unlocked');
    expect(decideLock({ ...old, online: {} })).toBe('unlocked');
    expect(decideLock({ ...old, online: 'unreachable', leaseState: 'paid' })).toBe('unlocked');
    expect(decideLock({ ...old, online: 'unreachable', policySeen: false })).toBe('unlocked');
  });

  it('offline with a valid lease stays unlocked; a lease for an expired state does not', () => {
    expect(decideLock({ ...base, online: 'unreachable', leaseState: 'paid' })).toBe('unlocked');
    expect(decideLock({ ...base, online: 'unreachable', leaseState: 'expired' })).toBe('locked');
  });

  it('offline without a lease locks only where the policy was seen in force', () => {
    expect(decideLock({ ...base, online: 'unreachable', leaseState: null, policySeen: true })).toBe('locked');
    expect(decideLock({ ...base, online: 'unreachable', leaseState: null, policySeen: false })).toBe('unlocked');
  });

  it('an entitlement this build cannot read fails open, even with the policy on', () => {
    expect(decideLock({ ...base, online: { paidPlan: true, unreadable: true } })).toBe('unlocked');
  });

  it('the server decides whenever it answers: policy on without an account locks, policy off never does', () => {
    expect(decideLock({ ...base, online: { paidPlan: true } })).toBe('locked');
    expect(decideLock({ ...base, online: { paidPlan: false }, policySeen: true })).toBe('unlocked');
  });
});
