/**
 * syntax-color — Shiki-driven cell coloring contract.
 *
 * Tests the cell-grid → source-string → tokens → cell-color pipeline
 * end-to-end against a deterministic stub Shiki. The real Shiki ships
 * ~400KB of WASM/grammar JSON; we don't need its actual lexer to
 * verify our walk logic, so we substitute a stub `codeToTokens` that
 * we drive from the test.
 *
 * What we're locking down:
 *   1. computeCellColors before loadHighlighter() returns an empty
 *      map (lazy contract — never block the UI on Shiki init).
 *   2. After load, colors are attributed to the correct cell keys
 *      following the row-major source serialization (column gaps
 *      become spaces, rows join on \n, multi-char glyphs allocate
 *      one source char per glyph char).
 *   3. Tokens with no color don't pollute the output map.
 *   4. A token spanning multiple cells colors only the cells it
 *      actually covers (positions are walked precisely).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cell, CellKey } from '@/engine/mathGrid';

type StubToken = { content: string; color?: string };
type StubLine = StubToken[];

const stubTokenize = vi.fn<(code: string, opts: { lang: string; theme: string }) => { tokens: StubLine[] }>();

vi.mock('shiki', () => ({
  createHighlighter: vi.fn(async () => ({
    codeToTokens: stubTokenize,
  })),
}));

let mod: typeof import('@/services/syntaxColor');

beforeEach(async () => {
  vi.resetModules();
  stubTokenize.mockReset();
  mod = await import('@/services/syntaxColor');
});

function cell(glyph: string): Cell {
  return { glyph, kind: 'glyph' } as Cell;
}

function buildCells(rows: Array<Array<{ c: number; glyph: string }>>): Map<CellKey, Cell> {
  const m = new Map<CellKey, Cell>();
  rows.forEach((row, r) => {
    for (const { c, glyph } of row) {
      m.set(`${r},${c}` as CellKey, cell(glyph));
    }
  });
  return m;
}

describe('computeCellColors — pre-load contract', () => {
  it('returns empty map before loadHighlighter() ever runs', () => {
    const cells = buildCells([[{ c: 0, glyph: 'd' }]]);
    expect(mod.isHighlighterReady()).toBe(false);
    const out = mod.computeCellColors(cells, 'python');
    expect(out.size).toBe(0);
  });

  it('returns empty map for empty cells even after load', async () => {
    stubTokenize.mockReturnValue({ tokens: [[]] });
    await mod.loadHighlighter();
    const out = mod.computeCellColors(new Map(), 'python');
    expect(out.size).toBe(0);
  });
});

describe('computeCellColors — single-row token attribution', () => {
  beforeEach(async () => {
    stubTokenize.mockReturnValue({
      tokens: [[
        { content: 'def', color: '#D73A49' },
        { content: ' ', color: undefined },
        { content: 'foo', color: '#6F42C1' },
      ]],
    });
    await mod.loadHighlighter();
  });

  it('colors the keyword cells with the keyword color', () => {
    // Cells: d(0,0) e(0,1) f(0,2) [gap] f(0,4) o(0,5) o(0,6)
    const cells = buildCells([[
      { c: 0, glyph: 'd' }, { c: 1, glyph: 'e' }, { c: 2, glyph: 'f' },
      { c: 4, glyph: 'f' }, { c: 5, glyph: 'o' }, { c: 6, glyph: 'o' },
    ]]);
    const out = mod.computeCellColors(cells, 'python');
    expect(out.get('0,0')).toBe('#D73A49');
    expect(out.get('0,1')).toBe('#D73A49');
    expect(out.get('0,2')).toBe('#D73A49');
    expect(out.get('0,4')).toBe('#6F42C1');
    expect(out.get('0,5')).toBe('#6F42C1');
    expect(out.get('0,6')).toBe('#6F42C1');
  });

  it('skips tokens with no color (no entry written for the gap)', () => {
    const cells = buildCells([[
      { c: 0, glyph: 'd' }, { c: 1, glyph: 'e' }, { c: 2, glyph: 'f' },
      { c: 4, glyph: 'f' }, { c: 5, glyph: 'o' }, { c: 6, glyph: 'o' },
    ]]);
    const out = mod.computeCellColors(cells, 'python');
    // The 1-char gap at col 3 is filled by a synthesized space → no
    // cell key, no entry. The output map only contains the 6 real
    // cells, none of them keyed by `0,3`.
    expect(out.has('0,3')).toBe(false);
    expect(out.size).toBe(6);
  });
});

describe('computeCellColors — multi-row source assembly', () => {
  it('walks tokens across the row separator without misaligning', async () => {
    // Source assembled by the function: "ab\ncd"
    // Stub returns one token per line so we can pin the boundary.
    stubTokenize.mockReturnValue({
      tokens: [
        [{ content: 'ab', color: '#000080' }],
        [{ content: 'cd', color: '#FF0000' }],
      ],
    });
    await mod.loadHighlighter();
    const cells = buildCells([
      [{ c: 0, glyph: 'a' }, { c: 1, glyph: 'b' }],
      [{ c: 0, glyph: 'c' }, { c: 1, glyph: 'd' }],
    ]);
    const out = mod.computeCellColors(cells, 'python');
    expect(out.get('0,0')).toBe('#000080');
    expect(out.get('0,1')).toBe('#000080');
    expect(out.get('1,0')).toBe('#FF0000');
    expect(out.get('1,1')).toBe('#FF0000');
  });

  it('returns empty map when Shiki throws on tokenize (e.g. unknown lang)', async () => {
    stubTokenize.mockImplementation(() => { throw new Error('lang not loaded'); });
    await mod.loadHighlighter();
    const cells = buildCells([[{ c: 0, glyph: 'x' }]]);
    const out = mod.computeCellColors(cells, 'python');
    expect(out.size).toBe(0);
  });
});

describe('computeCellColors — first-write-wins on cell key collisions', () => {
  it('does not overwrite an already-colored cell when a later token covers the same chars', async () => {
    // Stub two tokens that both claim position 0; the FIRST color wins.
    stubTokenize.mockReturnValue({
      tokens: [[
        { content: 'a', color: '#001122' },
        { content: '', color: '#FFAA00' },
      ]],
    });
    await mod.loadHighlighter();
    const cells = buildCells([[{ c: 0, glyph: 'a' }]]);
    const out = mod.computeCellColors(cells, 'python');
    expect(out.get('0,0')).toBe('#001122');
  });
});

describe('loadHighlighter — concurrent init dedupe', () => {
  it('parallel loadHighlighter() calls share one createHighlighter promise', async () => {
    stubTokenize.mockReturnValue({ tokens: [[]] });
    const [a, b, c] = await Promise.all([
      mod.loadHighlighter(),
      mod.loadHighlighter(),
      mod.loadHighlighter(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mod.isHighlighterReady()).toBe(true);
  });
});
