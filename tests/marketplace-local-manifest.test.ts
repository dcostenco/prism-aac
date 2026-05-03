import { describe, it, expect } from 'vitest';
import { LOCAL_CATALOG } from '@/lib/marketplace/manifests/local';
import { isValidManifest } from '@/lib/marketplace/types';

describe('marketplace/local — schema integrity', () => {
  it('contains exactly 13 entries (matches pre-refactor CATALOG)', () => {
    expect(LOCAL_CATALOG).toHaveLength(13);
  });

  it('every entry passes isValidManifest', () => {
    for (const m of LOCAL_CATALOG) {
      expect(isValidManifest(m), `manifest ${m.slug} failed schema check`).toBe(true);
    }
  });

  it('slugs are unique', () => {
    const slugs = LOCAL_CATALOG.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('marketplace/local — preserves pre-refactor catalog', () => {
  // Behavior preservation: every slug + tier + status + kind that existed in
  // the pre-refactor MarketplacePanel.CATALOG must appear in LOCAL_CATALOG.
  const expected: Array<[string, string, string, string]> = [
    // slug, kind, tier, status
    ['symbol-libraries', 'symbol-library', 'free', 'available'],
    ['board-templates', 'board-template', 'free', 'available'],
    ['vocab-my-core', 'vocab-set', 'free', 'available'],
    ['vocab-wordpower', 'vocab-set', 'free', 'available'],
    ['vocab-gateway', 'vocab-set', 'free', 'available'],
    ['vocab-aphasia', 'vocab-set', 'free', 'available'],
    ['vocab-social-chat', 'vocab-set', 'free', 'available'],
    ['game-packs', 'game-pack', 'free', 'available'],
    ['voice-packs', 'voice-pack', 'standard', 'coming_soon'],
    ['picture-editor', 'panel', 'standard', 'available'],
    ['music-composer', 'panel', 'standard', 'available'],
    ['aac-designer', 'panel', 'advanced', 'coming_soon'],
    ['video-composer', 'panel', 'advanced', 'coming_soon'],
  ];

  for (const [slug, kind, tier, status] of expected) {
    it(`${slug} is present with kind=${kind}, tier=${tier}, status=${status}`, () => {
      const m = LOCAL_CATALOG.find((x) => x.slug === slug);
      expect(m, `missing slug ${slug}`).toBeDefined();
      expect(m!.kind).toBe(kind);
      expect(m!.tier).toBe(tier);
      expect(m!.status).toBe(status);
    });
  }
});

describe('marketplace/local — handler payload coverage', () => {
  it('all vocab-set entries carry vocabSetId', () => {
    const vocabs = LOCAL_CATALOG.filter((m) => m.kind === 'vocab-set');
    expect(vocabs.length).toBeGreaterThan(0);
    for (const v of vocabs) {
      expect((v.handlerPayload as { vocabSetId?: string })?.vocabSetId).toBeTypeOf('string');
    }
  });

  it('all panel entries carry panelId', () => {
    const panels = LOCAL_CATALOG.filter((m) => m.kind === 'panel');
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) {
      expect((p.handlerPayload as { panelId?: string })?.panelId).toBeTypeOf('string');
    }
  });
});

describe('marketplace/local — references valid i18n keys', () => {
  it('every nameKey starts with mp_ or vs_ (matches en.json convention)', () => {
    for (const m of LOCAL_CATALOG) {
      expect(m.nameKey).toMatch(/^(mp_|vs_)/);
      expect(m.descKey).toMatch(/^(mp_|vs_)/);
    }
  });
});
