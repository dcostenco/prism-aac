import { describe, it, expect } from 'vitest';
import {
  isValidManifest,
  tierAllows,
  TIER_RANK,
  MODULE_KINDS,
  MODULE_TIERS,
  MODULE_STATUSES,
  MODULE_CATEGORIES,
  type ModuleManifest,
} from '@/lib/marketplace/types';

const VALID: ModuleManifest = {
  slug: 'test',
  version: '1.0.0',
  kind: 'vocab-set',
  tier: 'free',
  category: 'vocab',
  nameKey: 'test_name',
  descKey: 'test_desc',
  icon: '🧪',
  status: 'available',
};

describe('marketplace/types — constants', () => {
  it('lists exactly the 7 supported kinds', () => {
    expect([...MODULE_KINDS].sort()).toEqual([
      'board-template',
      'game-pack',
      'panel',
      'symbol-library',
      'synalux-app',
      'vocab-set',
      'voice-pack',
    ]);
  });

  it('lists exactly the 4 tiers', () => {
    expect([...MODULE_TIERS]).toEqual(['free', 'standard', 'advanced', 'enterprise']);
  });

  it('tier rank is monotonically increasing', () => {
    expect(TIER_RANK.free).toBe(0);
    expect(TIER_RANK.standard).toBe(1);
    expect(TIER_RANK.advanced).toBe(2);
    expect(TIER_RANK.enterprise).toBe(3);
  });

  it('lists exactly 3 statuses', () => {
    expect([...MODULE_STATUSES].sort()).toEqual(['available', 'coming_soon', 'deprecated']);
  });

  it('lists exactly 6 categories', () => {
    expect([...MODULE_CATEGORIES].sort()).toEqual(['apps', 'games', 'symbols', 'tools', 'vocab', 'voices']);
  });
});

describe('marketplace/types — tierAllows', () => {
  it('free user can install free modules', () => {
    expect(tierAllows('free', 'free')).toBe(true);
  });
  it('free user cannot install standard modules', () => {
    expect(tierAllows('free', 'standard')).toBe(false);
  });
  it('free user cannot install enterprise modules', () => {
    expect(tierAllows('free', 'enterprise')).toBe(false);
  });
  it('standard user can install free + standard', () => {
    expect(tierAllows('standard', 'free')).toBe(true);
    expect(tierAllows('standard', 'standard')).toBe(true);
  });
  it('standard user cannot install advanced', () => {
    expect(tierAllows('standard', 'advanced')).toBe(false);
  });
  it('advanced user can install free, standard, advanced', () => {
    expect(tierAllows('advanced', 'free')).toBe(true);
    expect(tierAllows('advanced', 'standard')).toBe(true);
    expect(tierAllows('advanced', 'advanced')).toBe(true);
  });
  it('advanced user cannot install enterprise', () => {
    expect(tierAllows('advanced', 'enterprise')).toBe(false);
  });
  it('enterprise user can install everything', () => {
    expect(tierAllows('enterprise', 'free')).toBe(true);
    expect(tierAllows('enterprise', 'standard')).toBe(true);
    expect(tierAllows('enterprise', 'advanced')).toBe(true);
    expect(tierAllows('enterprise', 'enterprise')).toBe(true);
  });
});

describe('marketplace/types — isValidManifest', () => {
  it('accepts a complete valid manifest', () => {
    expect(isValidManifest(VALID)).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isValidManifest(null)).toBe(false);
    expect(isValidManifest(undefined)).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isValidManifest('string')).toBe(false);
    expect(isValidManifest(42)).toBe(false);
    expect(isValidManifest(true)).toBe(false);
  });

  it('rejects when slug is missing or empty', () => {
    expect(isValidManifest({ ...VALID, slug: '' })).toBe(false);
    expect(isValidManifest({ ...VALID, slug: undefined })).toBe(false);
  });

  it('rejects when version is missing', () => {
    expect(isValidManifest({ ...VALID, version: '' })).toBe(false);
  });

  it('rejects unknown kind', () => {
    expect(isValidManifest({ ...VALID, kind: 'magic' })).toBe(false);
  });

  it('rejects unknown tier', () => {
    expect(isValidManifest({ ...VALID, tier: 'platinum' })).toBe(false);
  });

  it('rejects unknown status', () => {
    expect(isValidManifest({ ...VALID, status: 'beta' })).toBe(false);
  });

  it('rejects unknown category', () => {
    expect(isValidManifest({ ...VALID, category: 'misc' })).toBe(false);
  });

  it('rejects when nameKey is missing', () => {
    expect(isValidManifest({ ...VALID, nameKey: '' })).toBe(false);
  });

  it('rejects when descKey is missing', () => {
    expect(isValidManifest({ ...VALID, descKey: '' })).toBe(false);
  });

  it('rejects when icon is empty', () => {
    expect(isValidManifest({ ...VALID, icon: '' })).toBe(false);
  });

  it('accepts manifests with optional fields populated', () => {
    expect(isValidManifest({
      ...VALID,
      preview: 'https://cdn/p.png',
      screenshots: ['https://cdn/1.png'],
      sizeKb: 240,
      deps: ['other-slug'],
      handlerPayload: { vocabSetId: 'my-core' },
      updatedAt: '2026-05-02T00:00:00Z',
    })).toBe(true);
  });
});
