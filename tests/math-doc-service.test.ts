/**
 * mathDocService — Phase 5B unit tests.
 *
 * The service is local-first: localStorage round-trip + cap + eviction.
 * Tests use a stub localStorage so they don't pollute the real one.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDoc,
  loadDoc,
  listDocs,
  deleteDoc,
  clearAllDocs,
  makeSlug,
  type MathDoc,
} from '@/services/mathDocService';
import { type SerializedMathGrid } from '@/engine/mathGrid';

const SAMPLE_BODY: SerializedMathGrid = {
  cells: [['0,0', { glyph: '5' }], ['0,1', { glyph: '+' }], ['0,2', { glyph: '7' }]],
  decorations: [],
  cursor: { r: 0, c: 3 },
  viewport: { cellSizePx: 56, scale: 1, panX: 0, panY: 0 },
};

beforeEach(() => {
  // jsdom gives us a real localStorage; clear it between tests.
  window.localStorage.clear();
});

describe('mathDocService: makeSlug', () => {
  it('generates URL-safe slugs from human names', () => {
    expect(makeSlug('Homework #1!', 1234)).toMatch(/^homework-1-1234$/);
  });

  it('falls back to "untitled" on empty / non-alpha input', () => {
    expect(makeSlug('', 9)).toMatch(/^untitled-9$/);
    expect(makeSlug('   ', 9)).toMatch(/^untitled-9$/);
    expect(makeSlug('!@#', 9)).toMatch(/^untitled-9$/);
  });

  it('strips leading and trailing hyphens', () => {
    expect(makeSlug('-Hi-', 9)).toMatch(/^hi-9$/);
  });
});

describe('mathDocService: saveDoc + loadDoc', () => {
  it('saves a new doc and loads it back by slug', () => {
    const saved = saveDoc('Test', SAMPLE_BODY);
    expect(saved).not.toBeNull();
    const back = loadDoc(saved!.slug);
    expect(back?.body).toEqual(SAMPLE_BODY);
    expect(back?.name).toBe('Test');
  });

  it('UPDATES an existing doc when slug is reused', async () => {
    const saved = saveDoc('Test', SAMPLE_BODY);
    const slug = saved!.slug;
    await new Promise((r) => setTimeout(r, 5));
    const updated = saveDoc('Test', { ...SAMPLE_BODY, cursor: { r: 5, c: 5 } }, slug);
    expect(updated?.slug).toBe(slug);
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(saved!.updatedAt);
    expect(loadDoc(slug)?.body.cursor).toEqual({ r: 5, c: 5 });
    // Only one row in storage.
    expect(listDocs()).toHaveLength(1);
  });

  it('refuses to save bodies larger than the cap', () => {
    // Build an oversized body — > 200 KB of cells.
    const cells: Array<[`${number},${number}`, { glyph: string }]> = [];
    for (let i = 0; i < 50000; i++) {
      cells.push([`0,${i}` as `${number},${number}`, { glyph: 'x' }]);
    }
    const oversized: SerializedMathGrid = { ...SAMPLE_BODY, cells };
    expect(saveDoc('huge', oversized)).toBeNull();
  });

  it('survives malformed localStorage data without crashing', () => {
    window.localStorage.setItem('prism-aac-math-docs', 'not-json');
    expect(listDocs()).toEqual([]);
    // Save still works after a malformed read.
    const saved = saveDoc('clean', SAMPLE_BODY);
    expect(saved).not.toBeNull();
  });
});

describe('mathDocService: listDocs + deleteDoc + clearAllDocs', () => {
  it('returns docs sorted by updatedAt newest-first', async () => {
    const a = saveDoc('A', SAMPLE_BODY);
    await new Promise((r) => setTimeout(r, 5));
    const b = saveDoc('B', SAMPLE_BODY);
    await new Promise((r) => setTimeout(r, 5));
    const c = saveDoc('C', SAMPLE_BODY);
    const list = listDocs();
    expect(list.map((d) => d.slug)).toEqual([c!.slug, b!.slug, a!.slug]);
  });

  it('deleteDoc removes the matching slug', () => {
    const a = saveDoc('A', SAMPLE_BODY);
    const b = saveDoc('B', SAMPLE_BODY);
    expect(deleteDoc(a!.slug)).toBe(true);
    expect(loadDoc(a!.slug)).toBeNull();
    expect(loadDoc(b!.slug)).not.toBeNull();
  });

  it('deleteDoc returns false when slug not found', () => {
    expect(deleteDoc('nonexistent')).toBe(false);
  });

  it('clearAllDocs wipes everything', () => {
    saveDoc('A', SAMPLE_BODY);
    saveDoc('B', SAMPLE_BODY);
    expect(listDocs()).toHaveLength(2);
    clearAllDocs();
    expect(listDocs()).toEqual([]);
  });
});

describe('mathDocService: cap + eviction', () => {
  it('evicts the oldest by updatedAt when MAX_DOCS is exceeded', async () => {
    // Save 105 small docs — the oldest 5 should be evicted.
    const slugs: string[] = [];
    for (let i = 0; i < 105; i++) {
      const s = saveDoc(`doc-${i}`, SAMPLE_BODY);
      if (s) slugs.push(s.slug);
      // Force a tiny gap so updatedAt monotonic.
      await new Promise((r) => setTimeout(r, 1));
    }
    const remaining = listDocs();
    expect(remaining.length).toBeLessThanOrEqual(100);
    // The newest 100 should be present.
    const oldestRemaining = remaining[remaining.length - 1];
    // Oldest doc kept should NOT be among the first 5 saved.
    const earliestFiveSlugs = new Set(slugs.slice(0, 5));
    expect(earliestFiveSlugs.has(oldestRemaining.slug)).toBe(false);
  });
});
