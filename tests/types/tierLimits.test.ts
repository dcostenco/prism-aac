import { TIER_LIMITS, SUPPORTED_LANGUAGES, SubscriptionTier } from '../../types';

describe('Tier Limits', () => {
  const tiers: SubscriptionTier[] = ['free', 'standard', 'advanced', 'enterprise'];

  it('defines limits for all 4 tiers', () => {
    for (const tier of tiers) {
      expect(TIER_LIMITS[tier]).toBeDefined();
    }
  });

  it('free tier has most restrictive limits', () => {
    const free = TIER_LIMITS.free;
    expect(free.maxCustomCategories).toBe(0);
    expect(free.maxCustomPhrases).toBe(50);
    expect(free.maxLanguages).toBe(1);
    expect(free.hasTones).toBe(false);
    expect(free.hasAzureVoice).toBe(false);
    expect(free.hasCloudBackup).toBe(false);
  });

  it('each tier is more permissive than the previous', () => {
    for (let i = 1; i < tiers.length; i++) {
      const prev = TIER_LIMITS[tiers[i - 1]];
      const curr = TIER_LIMITS[tiers[i]];
      expect(curr.maxCustomPhrases).toBeGreaterThanOrEqual(prev.maxCustomPhrases);
      expect(curr.maxLanguages).toBeGreaterThanOrEqual(prev.maxLanguages);
    }
  });

  it('advanced and enterprise have unlimited categories', () => {
    expect(TIER_LIMITS.advanced.maxCustomCategories).toBe(Infinity);
    expect(TIER_LIMITS.enterprise.maxCustomCategories).toBe(Infinity);
  });

  it('standard+ tiers have Azure voice', () => {
    expect(TIER_LIMITS.standard.hasAzureVoice).toBe(true);
    expect(TIER_LIMITS.advanced.hasAzureVoice).toBe(true);
    expect(TIER_LIMITS.enterprise.hasAzureVoice).toBe(true);
  });
});

describe('Supported Languages', () => {
  it('has exactly 12 languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(12);
  });

  it('all language codes are unique', () => {
    const codes = SUPPORTED_LANGUAGES.map(l => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('only Arabic is RTL', () => {
    const rtlLangs = SUPPORTED_LANGUAGES.filter(l => l.rtl);
    expect(rtlLangs).toHaveLength(1);
    expect(rtlLangs[0].code).toBe('ar');
  });

  it('all languages have native names', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.nativeName.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes English as first language', () => {
    expect(SUPPORTED_LANGUAGES[0].code).toBe('en');
  });
});
