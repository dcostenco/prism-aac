/**
 * Monetization telemetry — the web sign-in gate and the cloud plan funnel.
 *
 * Both surfaces were previously silent: Datadog recorded the XHR to the access
 * route but not its decision (every outcome answers 200), and automatic click
 * tracking is off because AAC interaction text can be clinical. So nobody could
 * tell how many people met the gate, signed in, or bought.
 *
 * The reporters below take enum outcomes only. There is deliberately no
 * parameter that can carry an utterance, a board, an account or a price: the
 * types are the privacy control, not a convention. Delivery is best effort —
 * `ddAction` is a no-op on the server and swallows its own failures — so a
 * telemetry problem can never break communication.
 */
import { ddAction } from '@/lib/datadog';

export const WEB_GATE_ACTION = 'aac_web_gate';
export const CLOUD_PLAN_ACTION = 'aac_cloud_plan';

/** Gate decisions, plus the one interaction that leaves for sign-in. */
export type WebGateOutcome =
  | 'preview' | 'sign_in_required' | 'signed_in' | 'disabled' | 'error' | 'sign_in_clicked'
  // The server could not be reached and a previously verified local session
  // carried the user through. Reported separately so registration conversion
  // is not inflated by offline continuity.
  | 'offline_continuity';

/** Cloud plan funnel. `redirected` is the web terminal state — Stripe owns the rest. */
export type CloudPlanEvent =
  | 'offer_shown'
  | 'purchase_started' | 'purchase_complete' | 'purchase_pending' | 'purchase_cancelled'
  | 'purchase_redirected' | 'purchase_none' | 'purchase_failed' | 'purchase_abandoned'
  | 'restore_started' | 'restore_complete' | 'restore_failed'
  | 'manage_opened' | 'manage_failed' | 'refresh_failed';

export type CloudPlanPlatform = 'ios' | 'web';

/**
 * These reporters are called from a render effect and from the purchase and
 * restore handlers. A throw there would blank the gate or abort a purchase, so
 * reporting is contained here: an observability fault must never cost a user
 * their communication or their subscription.
 */
function report(action: string, context: Record<string, string>): void {
  try { ddAction(action, context); } catch { /* telemetry is never load-bearing */ }
}

export function reportWebGate(outcome: WebGateOutcome): void {
  report(WEB_GATE_ACTION, { outcome });
}

export function reportCloudPlan(event: CloudPlanEvent, platform: CloudPlanPlatform): void {
  report(CLOUD_PLAN_ACTION, { event, platform });
}

/**
 * One offer impression per account per tab session.
 *
 * The panel unmounts whenever the Account accordion collapses, so this cannot
 * live in a ref. It is held in memory *and* mirrored to sessionStorage: memory
 * survives the unmount and keeps working when storage is blocked (private
 * browsing), storage survives a reload of the same tab. Signing in as a
 * different account is a different visitor and is counted again.
 */
const OFFER_IMPRESSION_KEY = 'prism-aac-offer-impressions';
const IMPRESSION_LIMIT = 20;
const reportedImpressions = new Set<string>();

/** Test-only. Production has no reason to forget an impression. */
export function resetOfferImpressions(): void {
  reportedImpressions.clear();
  try { sessionStorage.removeItem(OFFER_IMPRESSION_KEY); } catch { /* storage unavailable */ }
}

export function firstOfferImpression(key: string): boolean {
  if (reportedImpressions.has(key)) return false;
  reportedImpressions.add(key);
  try {
    const raw = sessionStorage.getItem(OFFER_IMPRESSION_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const seen = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    if (seen.includes(key)) return false;
    sessionStorage.setItem(OFFER_IMPRESSION_KEY, JSON.stringify([...seen, key].slice(-IMPRESSION_LIMIT)));
  } catch { /* blocked or corrupt: the in-memory set still holds for this page */ }
  return true;
}
