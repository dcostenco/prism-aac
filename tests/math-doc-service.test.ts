/**
 * mathDocService — Phase 5B unit tests + Phase 5D portal sync.
 *
 * The service is local-first: localStorage round-trip + cap + eviction.
 * Phase 5D adds best-effort portal sync via portalFetch — those paths
 * are exercised at the bottom with a mocked portalFetch.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const portalFetchMock = vi.fn();
vi.mock('@/services/portalClient', () => ({
  portalFetch: (req: unknown) => portalFetchMock(req),
}));

import {
  saveDoc,
  loadDoc,
  listDocs,
  deleteDoc,
  clearAllDocs,
  makeSlug,
  pushToPortal,
  pullFromPortal,
  deleteFromPortal,
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
  portalFetchMock.mockReset();
  // Default: portal succeeds with an empty body. Individual tests
  // override per-call.
  portalFetchMock.mockResolvedValue({ ok: true, data: undefined, status: 204 });
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

describe('mathDocService: portal sync — pushToPortal', () => {
  it('POSTs the doc body to /prism-aac/math-doc/{slug}', async () => {
    portalFetchMock.mockResolvedValueOnce({ ok: true, data: undefined, status: 204 });
    const doc: MathDoc = {
      slug: 'hw-1', name: 'HW 1', createdAt: 1, updatedAt: 2, body: SAMPLE_BODY,
    };
    const ok = await pushToPortal(doc);
    expect(ok).toBe(true);
    expect(portalFetchMock).toHaveBeenCalledTimes(1);
    const req = portalFetchMock.mock.calls[0][0];
    expect(req.path).toBe('/prism-aac/math-doc/hw-1');
    expect(req.method).toBe('POST');
    expect(req.body).toMatchObject({ slug: 'hw-1', name: 'HW 1', updatedAt: 2 });
  });

  it('encodes special characters in the slug', async () => {
    portalFetchMock.mockResolvedValueOnce({ ok: true, data: undefined, status: 204 });
    await pushToPortal({ slug: 'hello world/?', name: 'x', createdAt: 1, updatedAt: 1, body: SAMPLE_BODY });
    expect(portalFetchMock.mock.calls[0][0].path).toBe('/prism-aac/math-doc/hello%20world%2F%3F');
  });

  it('returns false on non-ok portal response', async () => {
    portalFetchMock.mockResolvedValueOnce({ ok: false, error: 'HTTP 401', status: 401 });
    const ok = await pushToPortal({ slug: 's', name: 'n', createdAt: 1, updatedAt: 1, body: SAMPLE_BODY });
    expect(ok).toBe(false);
  });

  it('saveDoc fires pushToPortal as fire-and-forget (not awaited)', async () => {
    let resolveDeferred!: (v: unknown) => void;
    const deferred = new Promise((r) => { resolveDeferred = r; });
    portalFetchMock.mockImplementationOnce(() => deferred);

    const before = Date.now();
    const saved = saveDoc('FF', SAMPLE_BODY);
    const after = Date.now();
    // saveDoc must return synchronously even though the portal call
    // is still pending — fire-and-forget semantics.
    expect(saved).not.toBeNull();
    expect(after - before).toBeLessThan(50);
    expect(portalFetchMock).toHaveBeenCalledTimes(1);

    // Now resolve the portal call so we don't leave a dangling promise
    // (and rejection-handler swallows so it doesn't throw).
    resolveDeferred({ ok: true, data: undefined, status: 204 });
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('mathDocService: portal sync — pullFromPortal', () => {
  it('returns null when portal is unreachable', async () => {
    portalFetchMock.mockResolvedValueOnce({ ok: false, error: 'offline' });
    expect(await pullFromPortal()).toBeNull();
  });

  it('adds portal-only docs to the local store', async () => {
    portalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        docs: [
          { slug: 'p1', name: 'Portal 1', createdAt: 100, updatedAt: 200, body: SAMPLE_BODY },
        ],
      },
    });
    const merged = await pullFromPortal();
    expect(merged).not.toBeNull();
    expect(merged!.find((d) => d.slug === 'p1')).toBeDefined();
    expect(loadDoc('p1')).not.toBeNull();
  });

  it('overwrites local with newer remote (updatedAt-based merge)', async () => {
    const local = saveDoc('Local', SAMPLE_BODY);
    const slug = local!.slug;
    portalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        docs: [
          { slug, name: 'Remote-newer', createdAt: 1, updatedAt: local!.updatedAt + 1000, body: SAMPLE_BODY },
        ],
      },
    });
    await pullFromPortal();
    expect(loadDoc(slug)?.name).toBe('Remote-newer');
  });

  it('keeps local when local is newer than remote', async () => {
    const local = saveDoc('Local-newer', SAMPLE_BODY);
    const slug = local!.slug;
    portalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        docs: [
          { slug, name: 'Remote-old', createdAt: 1, updatedAt: local!.updatedAt - 1000, body: SAMPLE_BODY },
        ],
      },
    });
    await pullFromPortal();
    expect(loadDoc(slug)?.name).toBe('Local-newer');
  });

  it('keeps local-only docs the portal does not know about', async () => {
    saveDoc('orphan', SAMPLE_BODY);
    portalFetchMock.mockResolvedValueOnce({ ok: true, status: 200, data: { docs: [] } });
    const merged = await pullFromPortal();
    expect(merged!.some((d) => d.name === 'orphan')).toBe(true);
  });

  it('accepts a bare-array response shape (no `docs` wrapper)', async () => {
    portalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: [
        { slug: 'bare-1', name: 'Bare', createdAt: 1, updatedAt: 2, body: SAMPLE_BODY },
      ],
    });
    const merged = await pullFromPortal();
    expect(merged!.find((d) => d.slug === 'bare-1')).toBeDefined();
  });

  it('skips malformed remote docs without crashing', async () => {
    portalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { docs: [{ slug: 42, broken: true }, null, { name: 'no-slug' }] },
    });
    const merged = await pullFromPortal();
    expect(merged).toEqual([]);
  });
});

describe('mathDocService: portal sync — deleteFromPortal', () => {
  it('issues DELETE /prism-aac/math-doc/{slug}', async () => {
    portalFetchMock.mockResolvedValueOnce({ ok: true, data: undefined, status: 204 });
    const ok = await deleteFromPortal('to-delete');
    expect(ok).toBe(true);
    const req = portalFetchMock.mock.calls[0][0];
    expect(req.path).toBe('/prism-aac/math-doc/to-delete');
    expect(req.method).toBe('DELETE');
  });

  it('deleteDoc fires deleteFromPortal as fire-and-forget', async () => {
    const a = saveDoc('A', SAMPLE_BODY);
    portalFetchMock.mockClear();

    let resolveDeferred!: (v: unknown) => void;
    const deferred = new Promise((r) => { resolveDeferred = r; });
    portalFetchMock.mockImplementationOnce(() => deferred);

    const ok = deleteDoc(a!.slug);
    expect(ok).toBe(true);
    expect(portalFetchMock).toHaveBeenCalledTimes(1);
    expect(portalFetchMock.mock.calls[0][0].method).toBe('DELETE');

    resolveDeferred({ ok: true, data: undefined, status: 204 });
    await new Promise((r) => setTimeout(r, 0));
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
