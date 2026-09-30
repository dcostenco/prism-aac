import { describe, expect, it } from 'vitest';
import type { SerializedMathGrid } from '@/engine/mathGrid';
import {
  buildMathDocumentFile,
  buildMathExportSvg,
  jpegToPdf,
  parseMathDocumentFile,
} from '@/services/mathExport';

const GRID: SerializedMathGrid = {
  cells: [
    ['0,0', { glyph: '÷' }],
    ['0,1', { glyph: '×' }],
    ['0,2', { glyph: '√' }],
    ['0,3', { glyph: 'π' }],
    ['0,4', { glyph: '²' }],
    ['1,0', { glyph: '<&' }],
  ],
  decorations: [
    { type: 'fraction-bar', anchor: { r: 0, c: 0 }, length: 2 },
    { type: 'root-bar', anchor: { r: 1, c: 2 }, length: 3 },
  ],
  cursor: { r: 1, c: 3 },
  viewport: { cellSizePx: 56, scale: 1, panX: 0, panY: 0 },
};

describe('math image and file export', () => {
  it('renders Unicode math signs, escaped glyphs, grid lines, and decorations in SVG', () => {
    const svg = buildMathExportSvg(GRID);

    expect(svg).toContain('>÷</text>');
    expect(svg).toContain('>×</text>');
    expect(svg).toContain('>√</text>');
    expect(svg).toContain('>π</text>');
    expect(svg).toContain('>²</text>');
    expect(svg).toContain('&lt;&amp;');
    expect(svg?.match(/<line /gu)?.length).toBeGreaterThan(10);
  });

  it('round-trips a named, versioned Prism Math document without losing special characters', () => {
    const encoded = buildMathDocumentFile('Special signs', GRID);

    expect(parseMathDocumentFile(encoded)).toEqual({ name: 'Special signs', body: GRID });
  });

  it('rejects malformed files before they can alter the grid', () => {
    const valid = JSON.parse(buildMathDocumentFile('Equation', GRID));
    expect(parseMathDocumentFile('x'.repeat(250_001))).toBeNull();
    expect(parseMathDocumentFile(JSON.stringify({ ...valid, version: 2 }))).toBeNull();
    expect(parseMathDocumentFile(JSON.stringify({ ...valid, name: '' }))).toBeNull();
    expect(parseMathDocumentFile(JSON.stringify({ ...valid, body: { ...valid.body, cells: [['00,0', { glyph: '1' }]] } }))).toBeNull();
    expect(parseMathDocumentFile(JSON.stringify({ ...valid, body: { ...valid.body, cells: [['10001,0', { glyph: '1' }]] } }))).toBeNull();
    expect(parseMathDocumentFile(JSON.stringify({ ...valid, body: { ...valid.body, cells: [['0,0', { glyph: '\u0000' }]] } }))).toBeNull();
    expect(parseMathDocumentFile(JSON.stringify({ ...valid, body: { ...valid.body, viewport: { ...valid.body.viewport, scale: -1 } } }))).toBeNull();
  });

  it('writes a structurally consistent one-page PDF around the rendered JPEG', async () => {
    const blob = jpegToPdf(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 112, 56);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    const content = 'q 112 0 0 56 0 0 cm /Im0 Do Q\n';
    const startXref = Number(text.match(/startxref\n(\d+)/u)?.[1]);

    expect(blob.type).toBe('application/pdf');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`);
    expect(text.slice(startXref, startXref + 4)).toBe('xref');
    expect(text.endsWith('%%EOF')).toBe(true);
    expect(() => jpegToPdf(new Uint8Array(), 112, 56)).toThrow('invalid PDF image');
  });
});
