import { create } from 'zustand';
import { SubscriptionTier, TIER_LIMITS, TierLimits } from '../types';

interface SubscriptionState {
  tier: SubscriptionTier;
  limits: TierLimits;
  setTier: (tier: SubscriptionTier) => void;
  canUseTone: (toneCount: number) => boolean;
  canAddCustomCategory: (currentCount: number) => boolean;
  canAddCustomPhrase: (currentCount: number) => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  limits: TIER_LIMITS.free,

  setTier: (tier) => set({ tier, limits: TIER_LIMITS[tier] }),

  canUseTone: () => get().limits.hasTones,

  canAddCustomCategory: (currentCount) =>
    currentCount < get().limits.maxCustomCategories,

  canAddCustomPhrase: (currentCount) =>
    currentCount < get().limits.maxCustomPhrases,
}));
