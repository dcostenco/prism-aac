/**
 * codeSerialize — turn cell-grid into Python/Java source string.
 *
 * The serializer needs to produce text the Python parser will actually
 * accept, so we lock the indent / row-gap / trailing-whitespace
 * behaviors here. Pyodide runtime tests live in the browser (can't
 * easily WASM-load in jsdom).
 */
import { describe, it, expect } from 'vitest';
import { serializeAsCode } from '@/services/codeSerialize';
import { cellKey } from '@/engine/mathGrid';
import type { Cell, CellKey } from '@/engine/mathGrid';

function build(rows: Array<{ r: number; cols: Array<{ c: number; glyph: string }> }>): Map<CellKey, Cell> {
  const m = new Map<CellKey, Cell>();
  for (const { r, cols } of rows) {
    for (const { c, glyph } of cols) {
      m.set(cellKey(r, c), { glyph });
    }
  }
  return m;
}

describe('serializeAsCode', () => {
  it('returns "" for empty map', () => {
    expect(serializeAsCode(new Map())).toBe('');
  });

  it('joins cells in a row WITHOUT extra spaces', () => {
    // d e f f o o ( ) :  →  "deffoo():" (8 cells, no inter-cell separator)
    const cells = build([
      { r: 0, cols: [
        { c: 0, glyph: 'd' }, { c: 1, glyph: 'e' }, { c: 2, glyph: 'f' },
        { c: 3, glyph: ' ' },
        { c: 4, glyph: 'f' }, { c: 5, glyph: 'o' }, { c: 6, glyph: 'o' },
        { c: 7, glyph: '(' }, { c: 8, glyph: ')' }, { c: 9, glyph: ':' },
      ]},
    ]);
    expect(serializeAsCode(cells)).toBe('def foo():');
  });

  it('joins rows with newline', () => {
    const cells = build([
      { r: 0, cols: [{ c: 0, glyph: 'a' }] },
      { r: 1, cols: [{ c: 0, glyph: 'b' }] },
    ]);
    expect(serializeAsCode(cells)).toBe('a\nb');
  });

  it('preserves indentation via column gaps within a row', () => {
    // row 0: "x = 1" at col 0
    // row 1: "    y = 2" indented 4 cols
    const cells = build([
      { r: 0, cols: [
        { c: 0, glyph: 'x' }, { c: 1, glyph: ' ' }, { c: 2, glyph: '=' }, { c: 3, glyph: ' ' }, { c: 4, glyph: '1' },
      ]},
      { r: 1, cols: [
        { c: 4, glyph: 'y' }, { c: 5, glyph: ' ' }, { c: 6, glyph: '=' }, { c: 7, glyph: ' ' }, { c: 8, glyph: '2' },
      ]},
    ]);
    expect(serializeAsCode(cells)).toBe('x = 1\n    y = 2');
  });

  it('keeps blank rows between filled rows', () => {
    const cells = build([
      { r: 0, cols: [{ c: 0, glyph: 'a' }] },
      { r: 2, cols: [{ c: 0, glyph: 'b' }] },
    ]);
    expect(serializeAsCode(cells)).toBe('a\n\nb');
  });

  it('trims trailing blank rows', () => {
    const cells = build([
      { r: 0, cols: [{ c: 0, glyph: 'a' }] },
    ]);
    expect(serializeAsCode(cells)).toBe('a');
  });

  it('strips trailing whitespace from each row', () => {
    const cells = build([
      { r: 0, cols: [{ c: 0, glyph: 'a' }, { c: 1, glyph: ' ' }, { c: 2, glyph: ' ' }] },
    ]);
    expect(serializeAsCode(cells)).toBe('a');
  });

  it('handles negative row indices (cursor moved up)', () => {
    const cells = build([
      { r: -1, cols: [{ c: 0, glyph: 'a' }] },
      { r:  0, cols: [{ c: 0, glyph: 'b' }] },
    ]);
    expect(serializeAsCode(cells)).toBe('a\nb');
  });

  it('survives a real Python snippet', () => {
    // def add(a, b):
    //     return a + b
    const cells = build([
      { r: 0, cols: [
        { c: 0, glyph: 'd' }, { c: 1, glyph: 'e' }, { c: 2, glyph: 'f' },
        { c: 3, glyph: ' ' },
        { c: 4, glyph: 'a' }, { c: 5, glyph: 'd' }, { c: 6, glyph: 'd' },
        { c: 7, glyph: '(' },
        { c: 8, glyph: 'a' }, { c: 9, glyph: ',' }, { c: 10, glyph: ' ' }, { c: 11, glyph: 'b' },
        { c: 12, glyph: ')' }, { c: 13, glyph: ':' },
      ]},
      { r: 1, cols: [
        { c: 4, glyph: 'r' }, { c: 5, glyph: 'e' }, { c: 6, glyph: 't' }, { c: 7, glyph: 'u' },
        { c: 8, glyph: 'r' }, { c: 9, glyph: 'n' }, { c: 10, glyph: ' ' },
        { c: 11, glyph: 'a' }, { c: 12, glyph: ' ' }, { c: 13, glyph: '+' }, { c: 14, glyph: ' ' }, { c: 15, glyph: 'b' },
      ]},
    ]);
    expect(serializeAsCode(cells)).toBe('def add(a, b):\n    return a + b');
  });
});
