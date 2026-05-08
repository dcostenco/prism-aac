'use client';
/**
 * syntaxColor — VS Code-style cell coloring for the programming chips.
 *
 * Uses Shiki (TextMate grammars + the same themes VS Code ships with)
 * to tokenise the serialized cell-grid source, then maps each token
 * back to the cells that produced it. Result: a Map<CellKey, hex>
 * the MathGrid renderer feeds into the SVG <text fill={...}> for each
 * cell.
 *
 * Shiki is loaded lazily — the highlighter init is async (~200-400 KB
 * worth of grammars + theme to fetch) but tokenization is sync once
 * loaded. We dedupe concurrent init via a shared promise. The first
 * computeCellColors() call returns an empty map so the UI doesn't
 * block; the calling hook re-runs once the highlighter is ready.
 */
import type { Cell, CellKey } from '@/engine/mathGrid';
import { parseCellKey } from '@/engine/mathGrid';

type ShikiHighlighter = {
  codeToTokens: (code: string, opts: { lang: string; theme: string }) => {
    tokens: Array<Array<{ content: string; color?: string }>>;
  };
};

let highlighter: ShikiHighlighter | null = null;
let initPromise: Promise<ShikiHighlighter> | null = null;

const THEME = 'github-light';
const LANGS = ['python', 'java'] as const;
type ShikiLang = (typeof LANGS)[number];

export function isHighlighterReady(): boolean {
  return highlighter !== null;
}

export async function loadHighlighter(): Promise<ShikiHighlighter> {
  if (highlighter) return highlighter;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const shiki = await import('shiki');
    const hl = (await shiki.createHighlighter({
      themes: [THEME],
      langs: [...LANGS],
    })) as unknown as ShikiHighlighter;
    highlighter = hl;
    return hl;
  })();
  try {
    return await initPromise;
  } catch (e) {
    initPromise = null;
    throw e;
  }
}

/**
 * Compute a per-cell hex color map by tokenising the serialized grid
 * and walking the cell sequence in serialization order.
 *
 * The serializer reconstructs source by row, with column gaps padded
 * as ASCII spaces and rows joined with \n. We replicate that walk
 * here so each character-position in the source maps unambiguously to
 * its cell key (or to a synthesized whitespace position which has no
 * cell).
 */
export function computeCellColors(
  cells: Map<CellKey, Cell>,
  lang: ShikiLang,
): Map<CellKey, string> {
  const out = new Map<CellKey, string>();
  if (!highlighter || cells.size === 0) return out;

  // Bucket cells by row → list of (col, key, glyph).
  type Slot = { c: number; key: CellKey; glyph: string };
  const byRow = new Map<number, Slot[]>();
  cells.forEach((cell, key) => {
    const { r, c } = parseCellKey(key);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push({ c, key, glyph: cell.glyph });
  });
  const sortedRows = Array.from(byRow.keys()).sort((a, b) => a - b);
  if (sortedRows.length === 0) return out;
  const minRow = sortedRows[0];
  const maxRow = sortedRows[sortedRows.length - 1];

  let docMinCol = Infinity;
  for (const arr of byRow.values()) {
    for (const { c } of arr) if (c < docMinCol) docMinCol = c;
  }
  if (!isFinite(docMinCol)) docMinCol = 0;

  // Build the source AND a parallel array mapping each character index
  // → CellKey | null (null for synthesized whitespace).
  const sourceParts: string[] = [];
  const charToCell: (CellKey | null)[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const row = byRow.get(r);
    if (r > minRow) {
      sourceParts.push('\n');
      charToCell.push(null);
    }
    if (!row || row.length === 0) continue;
    row.sort((a, b) => a.c - b.c);
    const maxCol = row[row.length - 1].c;
    const slotByCol = new Map<number, Slot>();
    for (const s of row) slotByCol.set(s.c, s);
    for (let c = docMinCol; c <= maxCol; c++) {
      const slot = slotByCol.get(c);
      if (slot) {
        // Multi-character glyphs (e.g. "(aq)" in chemistry, but in
        // code mode every cell is a single char from the user's typing)
        // — push every char so positions stay aligned. The cell key is
        // attributed to all its chars; we'll color the cell by the
        // first char's token (sufficient for one-char cells, which is
        // the typical case).
        for (let i = 0; i < slot.glyph.length; i++) {
          sourceParts.push(slot.glyph[i]);
          charToCell.push(slot.key);
        }
      } else {
        sourceParts.push(' ');
        charToCell.push(null);
      }
    }
  }
  const source = sourceParts.join('');
  if (!source.trim()) return out;

  let tokens: ReturnType<ShikiHighlighter['codeToTokens']>;
  try {
    tokens = highlighter.codeToTokens(source, { lang, theme: THEME });
  } catch {
    return out;
  }

  // Walk Shiki's row-major tokens, advancing a position counter into
  // the source string (which mirrors charToCell index by index).
  let pos = 0;
  for (let lineIdx = 0; lineIdx < tokens.tokens.length; lineIdx++) {
    const line = tokens.tokens[lineIdx];
    for (const tok of line) {
      const len = tok.content.length;
      if (tok.color) {
        for (let i = 0; i < len; i++) {
          const cellKey = charToCell[pos + i];
          if (cellKey && !out.has(cellKey)) out.set(cellKey, tok.color);
        }
      }
      pos += len;
    }
    // Account for the \n between Shiki's lines (which is in source but
    // NOT in any token).
    if (lineIdx < tokens.tokens.length - 1) pos += 1;
  }

  return out;
}
