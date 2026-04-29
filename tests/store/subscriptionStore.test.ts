import { useSubscriptionStore } from '../../store/subscriptionStore';
import { TIER_LIMITS } from '../../types';

describe('SubscriptionStore', () => {
  beforeEach(() => {
    useSubscriptionStore.setState({ tier: 'free', limits: TIER_LIMITS.free });
  });

  describe('setTier', () => {
    it('sets tier and updates limits', () => {
      useSubscriptionStore.getState().setTier('standard');
      const s = useSubscriptionStore.getState();
      expect(s.tier).toBe('standard');
      expect(s.limits).toEqual(TIER_LIMITS.standard);
    });

    it('updates to advanced tier', () => {
      useSubscriptionStore.getState().setTier('advanced');
      expect(useSubscriptionStore.getState().limits.hasTones).toBe(true);
      expect(useSubscriptionStore.getState().limits.toneCount).toBe(9);
    });

    it('updates to enterprise tier', () => {
      useSubscriptionStore.getState().setTier('enterprise');
      expect(useSubscriptionStore.getState().limits.maxCustomCategories).toBe(Infinity);
    });

    it('can downgrade back to free', () => {
      useSubscriptionStore.getState().setTier('advanced');
      useSubscriptionStore.getState().setTier('free');
      expect(useSubscriptionStore.getState().limits.hasTones).toBe(false);
    });
  });

  describe('canUseTone', () => {
    it('returns false for free tier', () => {
      expect(useSubscriptionStore.getState().canUseTone(1)).toBe(false);
    });

    it('returns true for standard tier', () => {
      useSubscriptionStore.getState().setTier('standard');
      expect(useSubscriptionStore.getState().canUseTone(1)).toBe(true);
    });
  });

  describe('canAddCustomCategory', () => {
    it('free tier cannot add categories', () => {
      expect(useSubscriptionStore.getState().canAddCustomCategory(0)).toBe(false);
    });

    it('standard tier can add up to 20', () => {
      useSubscriptionStore.getState().setTier('standard');
      expect(useSubscriptionStore.getState().canAddCustomCategory(19)).toBe(true);
      expect(useSubscriptionStore.getState().canAddCustomCategory(20)).toBe(false);
    });

    it('advanced tier has unlimited', () => {
      useSubscriptionStore.getState().setTier('advanced');
      expect(useSubscriptionStore.getState().canAddCustomCategory(9999)).toBe(true);
    });
  });

  describe('canAddCustomPhrase', () => {
    it('free tier allows up to 50', () => {
      expect(useSubscriptionStore.getState().canAddCustomPhrase(49)).toBe(true);
      expect(useSubscriptionStore.getState().canAddCustomPhrase(50)).toBe(false);
    });

    it('standard tier allows up to 500', () => {
      useSubscriptionStore.getState().setTier('standard');
      expect(useSubscriptionStore.getState().canAddCustomPhrase(499)).toBe(true);
      expect(useSubscriptionStore.getState().canAddCustomPhrase(500)).toBe(false);
    });
  });
});
