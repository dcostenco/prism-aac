/**
 * Whether the paid-plan lock applies, as one pure decision. The lock never
 * interrupts: the app applies a 'locked' decision only at a session boundary
 * (launch, sign-in, return after idle) and never while a message is being
 * composed or spoken. Safety functions stay available on the lock screen.
 */
import type { AacEntitlement } from '@/services/webAccessService';

export type LockDecision = 'unlocked' | 'locked' | 'update_app';

const ENTITLED: ReadonlySet<AacEntitlement['state']> = new Set(['included', 'beta', 'paid', 'grace', 'pre_cutover_free']);

export function isEntitledState(state: AacEntitlement['state']): boolean {
  return ENTITLED.has(state);
}

export interface LockInputs {
  /** Build flag NEXT_PUBLIC_AAC_PAID_ONLY_LOCK. */
  enabled: boolean;
  /** A native shell is hosting the page. */
  native: boolean;
  /** That shell can buy in-app (bridge.subscription, App Store builds since 1.9.0). */
  nativePurchases: boolean;
  /** The server's answer, or 'unreachable' when it could not be asked.
   *  paidPlan: the server's paid-only policy is in force. unreadable: it sent
   *  an entitlement this build cannot read. */
  online: { entitlement?: AacEntitlement; paidPlan?: boolean; unreadable?: boolean } | 'unreachable';
  /** Whether the last answer that reached this device carried an entitlement
   *  (the server's paid-plan policy was in force). */
  policySeen: boolean;
  /** A stored lease verified now (signature, expiry), for the signed-in
   *  account, or for the last account when identity cannot be confirmed. */
  leaseState: AacEntitlement['state'] | null;
}

export function decideLock(input: LockInputs): LockDecision {
  if (!input.enabled) return 'unlocked';
  const decision = entitlementDecision(input);
  // An older App Store build cannot buy in-app, and the store does not allow
  // sending it to a web checkout: ask for the update instead of locking. Only
  // a lock becomes this notice; an entitled account is never asked to update.
  return decision === 'locked' && input.native && !input.nativePurchases ? 'update_app' : decision;
}

function entitlementDecision(input: LockInputs): LockDecision {
  if (input.online !== 'unreachable') {
    const { entitlement, paidPlan, unreadable } = input.online;
    // An entitlement this build cannot read fails open: never lock a paying
    // account because the server learned a state an older app does not know.
    if (unreadable) return 'unlocked';
    // Whenever the server answers, it decides, whatever this device knows
    // about sign-in: a slow or failed profile lookup never locks a paid account.
    if (entitlement) return ENTITLED.has(entitlement.state) ? 'unlocked' : 'locked';
    // Policy in force but no entitlement: the server has no account for this
    // device. Policy off: nothing locks.
    return paidPlan ? 'locked' : 'unlocked';
  }
  // Offline or the server is down: a valid lease decides; without one, only a
  // device that has seen the policy in force locks.
  if (input.leaseState && ENTITLED.has(input.leaseState)) return 'unlocked';
  return input.policySeen ? 'locked' : 'unlocked';
}
