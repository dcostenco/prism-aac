import { SubscriptionTier, TIER_LIMITS, TierLimits } from '../types';
import { getSetting, setSetting } from '../db/repository';
import { validateSubscription } from './cloudSync';

export function getLimitsForTier(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier];
}

export function isFeatureAvailable(
  feature: keyof TierLimits,
  tier: SubscriptionTier
): boolean {
  const limits = TIER_LIMITS[tier];
  const value = limits[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return false;
}

export async function checkSubscriptionStatus(): Promise<SubscriptionTier> {
  const token = await getSetting('auth_token');
  if (!token) return 'free';

  try {
    const result = await validateSubscription(token);
    if (result.isActive) {
      await setSetting('subscription_tier', result.tier);
      await setSetting('subscription_expires', result.expiresAt);
      return result.tier;
    }
  } catch {
    // Offline or server error — use cached tier
    const cached = await getSetting('subscription_tier');
    if (cached && isValidTier(cached)) return cached;
  }

  return 'free';
}

function isValidTier(value: string): value is SubscriptionTier {
  return ['free', 'standard', 'advanced', 'enterprise'].includes(value);
}
