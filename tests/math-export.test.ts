import { describe, expect, it, vi } from 'vitest';
import type { SerializedMathGrid } from '@/engine/mathGrid';
import { createEmptyState, serialize, setCell, setCursor } from '@/engine/mathGrid';
import { toggleSummationLine } from '@/engine/decorations';
import {
  buildMathDocumentFile,
  buildMathExportSvg,
  copyMathGridImage,
  jpegToPdf,
  MAX_MATH_DOCUMENT_BYTES,
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

  it('round-trips a large Unicode document that local Save accepts', () => {
    const body: SerializedMathGrid = {
      ...GRID,
      cells: Array.from({ length: 4_000 }, (_, index) => [
        `${Math.floor(index / 100)},${index % 100}`,
        { glyph: 'π' },
      ] as SerializedMathGrid['cells'][number]),
    };

    const encoded = buildMathDocumentFile('Large Unicode work', body);

    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(MAX_MATH_DOCUMENT_BYTES);
    expect(parseMathDocumentFile(encoded)).toEqual({ name: 'Large Unicode work', body });
  });

  it('refuses to create a file that its restore path would reject', () => {
    const body: SerializedMathGrid = {
      ...GRID,
      cells: Array.from({ length: 10_000 }, (_, index) => [
        `${Math.floor(index / 100)},${index % 100}`,
        { glyph: 'π'.repeat(100) },
      ] as SerializedMathGrid['cells'][number]),
    };

    expect(() => buildMathDocumentFile('Too large', body)).toThrow('math-file-too-large');
    expect(() => buildMathDocumentFile('Invalid decoration', {
      ...GRID,
      decorations: [{ type: 'fraction-bar', anchor: { r: 0, c: 0 }, length: 0 }],
    })).toThrow('invalid-math-document');
  });

  it('round-trips a summation line spanning more than 200 live grid cells', () => {
    let state = createEmptyState();
    for (let column = 0; column <= 200; column++) state = setCell(state, 0, column, '1');
    state = toggleSummationLine(setCursor(state, 0, 100));
    const body = serialize(state);

    expect(body.decorations).toContainEqual({
      type: 'summation-line',
      anchor: { r: 0, c: 0 },
      length: 201,
    });
    expect(parseMathDocumentFile(buildMathDocumentFile('Wide sum', body)))
      .toEqual({ name: 'Wide sum', body });
  });

  it('starts clipboard.write before asynchronous image rasterization finishes', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const originalCreateElement = document.createElement.bind(document);
    let finishImage!: () => void;
    let clipboardPayload: Record<string, Blob | Promise<Blob>> | undefined;
    class DeferredImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { finishImage = () => this.onload?.(); }
    }
    class DeferredClipboardItem {
      constructor(payload: Record<string, Blob | Promise<Blob>>) { clipboardPayload = payload; }
    }
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
    } as unknown as HTMLCanvasElement;
    const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => (
      tagName === 'canvas' ? fakeCanvas : originalCreateElement(tagName)
    )) as typeof document.createElement);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:math-export');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('Image', DeferredImage);
    vi.stubGlobal('ClipboardItem', DeferredClipboardItem);
    const write = vi.fn(async () => {
      await clipboardPayload?.['image/png'];
    });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });

    try {
      const pending = copyMathGridImage(GRID);
      await Promise.resolve();
      expect(write).toHaveBeenCalledOnce();
      expect(clipboardPayload?.['image/png']).toBeInstanceOf(Promise);
      finishImage();
      await expect(pending).resolves.toBe('copied');
    } finally {
      createElement.mockRestore();
      createObjectUrl.mockRestore();
      revokeObjectUrl.mockRestore();
      vi.unstubAllGlobals();
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else delete (navigator as { clipboard?: Clipboard }).clipboard;
    }
  });

  it('rejects malformed files before they can alter the grid', () => {
    const valid = JSON.parse(buildMathDocumentFile('Equation', GRID));
    expect(parseMathDocumentFile('x'.repeat(MAX_MATH_DOCUMENT_BYTES + 1))).toBeNull();
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
