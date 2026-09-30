import type { CellKey, Decoration, SerializedMathGrid } from '@/engine/mathGrid';
import { parseCellKey } from '@/engine/mathGrid';

const CELL = 56;
const PAD = 24;
const MAX_FILE_BYTES = 250_000;
const MAX_COORDINATE = 10_000;
const MAX_PAN_PX = 1_000_000;
const MAX_CANVAS_DIMENSION = 8_192;
const MAX_CANVAS_PIXELS = 16_000_000;
const DECORATION_TYPES = new Set<Decoration['type']>([
  'fraction-bar', 'long-division-bar', 'long-division-tick', 'root-bar', 'summation-line',
]);

type WritableHandle = { createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> };
type ReadableHandle = { getFile: () => Promise<File> };

export interface ParsedMathDocument {
  name: string;
  body: SerializedMathGrid;
}

function xml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');
}

export function buildMathExportSvg(grid: SerializedMathGrid): string | null {
  if (grid.cells.length === 0) return null;
  const cells = grid.cells.map(([key, cell]) => ({ ...parseCellKey(key), ...cell }));
  if (cells.some((cell) => !Number.isFinite(cell.r) || !Number.isFinite(cell.c))) return null;
  const columns = cells.map((cell) => cell.c);
  const rows = cells.map((cell) => cell.r);
  for (const decoration of grid.decorations) {
    columns.push(decoration.anchor.c, decoration.anchor.c + decoration.length - 1);
    rows.push(decoration.anchor.r);
  }
  const minC = Math.min(...columns);
  const maxC = Math.max(...columns);
  const minR = Math.min(...rows);
  const maxR = Math.max(...rows);
  const width = (maxC - minC + 1) * CELL + PAD * 2;
  const height = (maxR - minR + 1) * CELL + PAD * 2;
  if (width > 12_000 || height > 12_000) return null;
  const x = (c: number) => PAD + (c - minC) * CELL;
  const y = (r: number) => PAD + (r - minR) * CELL;
  const lines: string[] = [];
  for (let c = minC; c <= maxC + 1; c++) lines.push(`<line x1="${x(c)}" y1="${PAD}" x2="${x(c)}" y2="${height - PAD}" stroke="#d9d9df" stroke-width="1"/>`);
  for (let r = minR; r <= maxR + 1; r++) lines.push(`<line x1="${PAD}" y1="${y(r)}" x2="${width - PAD}" y2="${y(r)}" stroke="#d9d9df" stroke-width="1"/>`);
  const glyphs = cells.map((cell) => {
    const attrs = Array.from(cell.glyph).length > 1 ? ` textLength="${CELL * 0.92}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="${x(cell.c) + CELL / 2}" y="${y(cell.r) + CELL * 0.7}" text-anchor="middle" fill="#14161d" font-family="system-ui,-apple-system,sans-serif" font-size="${CELL * 0.6}" font-weight="600"${attrs}>${xml(cell.glyph)}</text>`;
  });
  const decorations = grid.decorations.map((decoration) => {
    const x1 = x(decoration.anchor.c);
    const y1 = y(decoration.anchor.r);
    const x2 = x1 + CELL * decoration.length;
    const atBottom = decoration.type === 'fraction-bar' || decoration.type === 'summation-line';
    if (decoration.type === 'long-division-tick') return `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 + CELL}" stroke="#14161d" stroke-width="3"/>`;
    return `<line x1="${x1}" y1="${atBottom ? y1 + CELL : y1}" x2="${x2}" y2="${atBottom ? y1 + CELL : y1}" stroke="#14161d" stroke-width="3"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfaf6"/>${lines.join('')}${glyphs.join('')}${decorations.join('')}</svg>`;
}

export function buildMathDocumentFile(name: string, body: SerializedMathGrid): string {
  return JSON.stringify({ format: 'prism-aac-math', version: 1, name, body }, null, 2);
}

function validCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && Math.abs(value as number) <= MAX_COORDINATE;
}

export function parseMathDocumentFile(raw: string): ParsedMathDocument | null {
  if (raw.length === 0 || raw.length > MAX_FILE_BYTES) return null;
  try {
    const parsed = JSON.parse(raw) as { format?: unknown; version?: unknown; name?: unknown; body?: unknown };
    if (parsed.format !== 'prism-aac-math' || parsed.version !== 1 || !parsed.body || typeof parsed.body !== 'object') return null;
    if (typeof parsed.name !== 'string' || parsed.name.trim().length === 0 || parsed.name.length > 120) return null;
    const body = parsed.body as Record<string, unknown>;
    if (!Array.isArray(body.cells) || body.cells.length > 10_000 || !Array.isArray(body.decorations) || body.decorations.length > 1_000) return null;
    const cells: SerializedMathGrid['cells'] = [];
    const seenCellKeys = new Set<string>();
    for (const item of body.cells) {
      if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== 'string' || !/^-?\d+,-?\d+$/u.test(item[0])) return null;
      const coordinates = item[0].split(',').map(Number);
      const canonicalKey = `${coordinates[0]},${coordinates[1]}`;
      if (!validCoordinate(coordinates[0]) || !validCoordinate(coordinates[1]) || canonicalKey !== item[0] || seenCellKeys.has(canonicalKey)) return null;
      const cell = item[1] as Record<string, unknown> | null;
      if (!cell || typeof cell.glyph !== 'string' || cell.glyph.length === 0 || cell.glyph.length > 100 || /[\u0000-\u001f\u007f]/u.test(cell.glyph)) return null;
      if (cell.locked !== undefined && typeof cell.locked !== 'boolean') return null;
      seenCellKeys.add(canonicalKey);
      cells.push([canonicalKey as CellKey, { glyph: cell.glyph, ...(cell.locked === true ? { locked: true } : {}) }]);
    }
    const decorations: Decoration[] = [];
    for (const item of body.decorations) {
      const d = item as Partial<Decoration>;
      if (!d || !DECORATION_TYPES.has(d.type as Decoration['type']) || !d.anchor || !validCoordinate(d.anchor.r) || !validCoordinate(d.anchor.c) || !Number.isInteger(d.length) || (d.length ?? 0) < 1 || (d.length ?? 0) > 200 || Math.abs(d.anchor.c + (d.length ?? 0) - 1) > MAX_COORDINATE) return null;
      decorations.push(d as Decoration);
    }
    const cursor = body.cursor as { r?: unknown; c?: unknown } | undefined;
    const viewport = body.viewport as Record<string, unknown> | undefined;
    if (!cursor || !validCoordinate(cursor.r) || !validCoordinate(cursor.c) || !viewport) return null;
    const numeric = ['cellSizePx', 'scale', 'panX', 'panY'] as const;
    if (numeric.some((key) => typeof viewport[key] !== 'number' || !Number.isFinite(viewport[key]))) return null;
    if ((viewport.cellSizePx as number) < 8 || (viewport.cellSizePx as number) > 256 || (viewport.scale as number) < 0.5 || (viewport.scale as number) > 3 || Math.abs(viewport.panX as number) > MAX_PAN_PX || Math.abs(viewport.panY as number) > MAX_PAN_PX) return null;
    return {
      name: parsed.name.trim(),
      body: {
        cells,
        decorations,
        cursor: { r: cursor.r as number, c: cursor.c as number },
        viewport: {
          cellSizePx: viewport.cellSizePx as number,
          scale: viewport.scale as number,
          panX: viewport.panX as number,
          panY: viewport.panY as number,
        },
      },
    };
  } catch {
    return null;
  }
}

async function svgCanvas(svg: string, scale = 2): Promise<HTMLCanvasElement> {
  const dimensions = svg.match(/width="(\d+)" height="(\d+)"/u);
  if (!dimensions) throw new Error('invalid SVG dimensions');
  const sourceWidth = Number(dimensions[1]);
  const sourceHeight = Number(dimensions[2]);
  const renderScale = Math.min(
    scale,
    MAX_CANVAS_DIMENSION / sourceWidth,
    MAX_CANVAS_DIMENSION / sourceHeight,
    Math.sqrt(MAX_CANVAS_PIXELS / (sourceWidth * sourceHeight)),
  );
  if (!Number.isFinite(renderScale) || renderScale <= 0) throw new Error('invalid SVG dimensions');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(sourceWidth * renderScale));
  canvas.height = Math.max(1, Math.floor(sourceHeight * renderScale));
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('image render failed')); image.src = url; });
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('image encoding failed')), type, quality));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

export function jpegToPdf(jpeg: Uint8Array, width: number, height: number): Blob {
  if (jpeg.length === 0 || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) throw new Error('invalid PDF image');
  const enc = new TextEncoder();
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;
  const objects: Uint8Array[] = [
    enc.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    enc.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concat([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, enc.encode('\nendstream')]),
    enc.encode(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`),
  ];
  const parts = [concat([enc.encode('%PDF-1.4\n%'), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]), enc.encode('\n')])];
  const offsets = [0];
  let size = parts[0].length;
  objects.forEach((object, index) => { offsets.push(size); const wrapped = concat([enc.encode(`${index + 1} 0 obj\n`), object, enc.encode('\nendobj\n')]); parts.push(wrapped); size += wrapped.length; });
  const xrefAt = size;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  parts.push(enc.encode(xref));
  const pdf = concat(parts);
  return new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' });
}

function safeName(name: string): string {
  return (name || 'prism-math').replace(/[^a-z0-9._-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'prism-math';
}

async function downloadOrSave(blob: Blob, filename: string, description: string, extensions: string[]): Promise<'saved' | 'downloaded'> {
  const picker = (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<WritableHandle> }).showSaveFilePicker;
  if (picker) {
    const handle = await picker({ suggestedName: filename, types: [{ description, accept: { [blob.type]: extensions } }] });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return 'downloaded';
}

export async function copyMathGridImage(body: SerializedMathGrid): Promise<'copied' | 'saved' | 'downloaded'> {
  const svg = buildMathExportSvg(body);
  if (!svg) throw new Error('empty grid');
  const png = await canvasBlob(await svgCanvas(svg), 'image/png');
  if (navigator.clipboard?.write && globalThis.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return 'copied';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') throw error;
    }
  }
  return downloadOrSave(png, 'prism-math.png', 'PNG image', ['.png']);
}

export async function saveMathGridPdf(body: SerializedMathGrid, name: string): Promise<'saved' | 'downloaded'> {
  const svg = buildMathExportSvg(body);
  if (!svg) throw new Error('empty grid');
  const canvas = await svgCanvas(svg);
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.96)).arrayBuffer());
  return downloadOrSave(jpegToPdf(jpeg, canvas.width, canvas.height), `${safeName(name)}.pdf`, 'PDF document', ['.pdf']);
}

export async function saveMathGridFile(body: SerializedMathGrid, name: string): Promise<'saved' | 'downloaded'> {
  const blob = new Blob([buildMathDocumentFile(name, body)], { type: 'application/json' });
  return downloadOrSave(blob, `${safeName(name)}.prism-math.json`, 'Prism Math document', ['.prism-math.json', '.json']);
}

export async function pickMathGridFile(): Promise<ParsedMathDocument | null | undefined> {
  const picker = (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<ReadableHandle[]> }).showOpenFilePicker;
  if (!picker) return undefined;
  try {
    const [handle] = await picker({ multiple: false, types: [{ description: 'Prism Math document', accept: { 'application/json': ['.json'] } }] });
    if (!handle) return null;
    const parsed = parseMathDocumentFile(await (await handle.getFile()).text());
    if (!parsed) throw new Error('invalid-math-file');
    return parsed;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return null;
    throw error;
  }
}
