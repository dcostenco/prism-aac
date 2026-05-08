/**
 * codeSerialize — turn the cell-grid into runnable source code.
 *
 * For math expressions the existing serializer in MathTutorTool joins
 * cells with single spaces, which is fine because mathjs ignores
 * whitespace. For Python (and Java) source, every space is meaningful
 * — indentation IS the syntax. So this serializer:
 *
 *   • walks each row from min-col to max-col,
 *   • concatenates cell glyphs WITHOUT any inter-cell separator,
 *   • inserts a single ASCII space for every empty column in the run
 *     so cursor-jumps the user made (typing at col 4 to indent) survive,
 *   • joins rows with "\n" in row-index order.
 *
 * Trailing whitespace on each row is trimmed. Empty rows are kept as
 * blank lines so the user's visual layout maps 1:1 to source lines.
 */
import type { Cell, CellKey } from '@/engine/mathGrid';
import { parseCellKey } from '@/engine/mathGrid';

export function serializeAsCode(cells: Map<CellKey, Cell>): string {
  if (cells.size === 0) return '';

  // Bucket cells by row → list of (col, glyph).
  const byRow = new Map<number, Array<{ c: number; glyph: string }>>();
  cells.forEach((cell, key) => {
    const { r, c } = parseCellKey(key);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push({ c, glyph: cell.glyph });
  });

  const sortedRows = Array.from(byRow.keys()).sort((a, b) => a - b);
  const minRow = sortedRows[0];
  const maxRow = sortedRows[sortedRows.length - 1];

  // Find the leftmost column across the whole document so a single
  // unindented row at col 0 doesn't make every other row indented.
  let docMinCol = Infinity;
  for (const arr of byRow.values()) {
    for (const { c } of arr) if (c < docMinCol) docMinCol = c;
  }
  if (!isFinite(docMinCol)) docMinCol = 0;

  const lines: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const row = byRow.get(r);
    if (!row || row.length === 0) {
      lines.push('');
      continue;
    }
    row.sort((a, b) => a.c - b.c);
    const minCol = row[0].c;
    const maxCol = row[row.length - 1].c;
    // Pre-fill with single ASCII spaces from docMinCol → maxCol so
    // indentation is preserved exactly as the user laid it out.
    const buf: string[] = [];
    for (let c = docMinCol; c <= maxCol; c++) buf.push(' ');
    for (const { c, glyph } of row) buf[c - docMinCol] = glyph;
    // Skip the leading-fill cells before the user's actual leftmost
    // glyph for THIS row only when this row's leftmost glyph IS the
    // doc minimum (no indent intent). Otherwise keep the spaces — they
    // ARE the indent.
    const startIdx = minCol === docMinCol ? 0 : 0; // always keep
    let line = buf.slice(startIdx).join('');
    line = line.replace(/\s+$/, '');
    lines.push(line);
  }
  // Trim trailing blank lines.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
