'use client';
/**
 * MathGrid — the canvas component.
 *
 * Renders an SVG grid of cells, with the active cell highlighted, the
 * locked cells green-tinted, and any decorations (fraction bars, root
 * bars, summation underlines, long-division houses) layered on top.
 *
 * Pointer interaction:
 *   • single-tap → set cursor to tapped cell
 *   • two-finger pinch → zoom (clamped MIN_SCALE..MAX_SCALE)
 *   • single-finger drag → pan (when scrollLocked is false)
 *
 * The component is unbounded — it draws only the cells visible in the
 * current viewport, plus a small overscan buffer so edges fade in
 * smoothly while panning. There is no DOM element per cell; cells are
 * SVG <text> nodes inside a single <svg>, which scales to thousands of
 * cells without React-side perf issues.
 *
 * No reach into stores OUTSIDE useMathGridStore — keeps the canvas a
 * pure visual component over the grid state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useMathGridStore,
  type MathGridStore,
} from '@/store/mathGridStore';
import {
  cellKey,
  parseCellKey,
  screenToCell,
  cellToScreen,
  isCellInSelection,
  type Cell,
  type CellKey,
  type Decoration,
} from '@/engine/mathGrid';
import { tapFeedback } from '@/services/feedback';
import {
  computeCellColors,
  isHighlighterReady,
  loadHighlighter,
} from '@/services/syntaxColor';

/** Lazy-load Shiki the first time the user is in a programming chip,
 *  then recompute the per-cell color map whenever the cells change.
 *  Returns an empty map until the highlighter is ready (the SVG
 *  renderer falls back to the theme glyph color in that case). */
function useSyntaxColors(
  cells: Map<CellKey, Cell>,
  activeCategory: string,
): Map<CellKey, string> {
  const lang: 'python' | 'java' | null =
    activeCategory === 'programming-python' ? 'python'
      : activeCategory === 'programming-java' ? 'java'
      : null;
  const [hlReady, setHlReady] = useState(isHighlighterReady());

  useEffect(() => {
    if (!lang || hlReady) return;
    let cancelled = false;
    void loadHighlighter().then(() => { if (!cancelled) setHlReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lang, hlReady]);

  return useMemo(() => {
    if (!lang || !hlReady) return new Map<CellKey, string>();
    return computeCellColors(cells, lang);
  }, [cells, lang, hlReady]);
}

interface MathGridProps {
  /** Lock canvas to its initial pan/zoom — disables pan and pinch. Mirrors
   *  the reference's "Number Window Scrollable" setting. */
  scrollLocked?: boolean;
  /** Visual skin applied to grid + cells. Default: 'paper'. */
  skin?: 'paper' | 'graphite' | 'high-contrast';
  /** Optional className for outer wrapper (sizing only). */
  className?: string;
}

const SKINS = {
  paper: {
    background: '#fbfaf6',
    gridMinor: 'rgba(120,120,140,0.18)',
    gridMajor: 'rgba(120,120,140,0.34)',
    glyph: '#14161d',
    cursorTint: 'rgba(96,160,255,0.22)',
    lockedTint: 'rgba(64,170,80,0.18)',
    selectionTint: 'rgba(64,170,80,0.30)',
    decoration: '#14161d',
  },
  graphite: {
    background: '#22262e',
    gridMinor: 'rgba(180,180,190,0.18)',
    gridMajor: 'rgba(180,180,190,0.32)',
    glyph: '#e8e8ea',
    cursorTint: 'rgba(96,160,255,0.30)',
    lockedTint: 'rgba(64,170,80,0.22)',
    selectionTint: 'rgba(64,170,80,0.40)',
    decoration: '#e8e8ea',
  },
  'high-contrast': {
    background: '#ffffff',
    gridMinor: '#bababa',
    gridMajor: '#7a7a7a',
    glyph: '#000000',
    cursorTint: 'rgba(0,90,255,0.28)',
    lockedTint: 'rgba(0,150,40,0.26)',
    selectionTint: 'rgba(0,150,40,0.42)',
    decoration: '#000000',
  },
};

const MAJOR_GRID_EVERY = 5;

export default function MathGrid({ scrollLocked = false, skin = 'paper', className = '' }: MathGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const cells = useMathGridStore((s: MathGridStore) => s.cells);
  const decorations = useMathGridStore((s: MathGridStore) => s.decorations);
  const cursor = useMathGridStore((s: MathGridStore) => s.cursor);
  const selection = useMathGridStore((s: MathGridStore) => s.selection);
  const viewport = useMathGridStore((s: MathGridStore) => s.viewport);
  const setCursor = useMathGridStore((s: MathGridStore) => s.setCursor);
  const panBy = useMathGridStore((s: MathGridStore) => s.panBy);
  const zoomTo = useMathGridStore((s: MathGridStore) => s.zoomTo);
  const activeCategory = useMathGridStore((s: MathGridStore) => s.activeMathCategory);
  const syntaxColors = useSyntaxColors(cells, activeCategory);

  const palette = SKINS[skin];

  // ResizeObserver to track the canvas's container size — drives the
  // visible-cell window calculation so we render only what's on-screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Pointer / touch handlers ─────────────────────────────────────
  // Single-finger pan; two-finger pinch; tap to set cursor. We track
  // pointer-id → start coords and use the count of active pointers
  // to disambiguate pan vs pinch.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const panAccumRef = useRef<{ moved: boolean }>({ moved: false });

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panAccumRef.current.moved = false;
    if (pointersRef.current.size === 2) {
      const ps = Array.from(pointersRef.current.values());
      const dx = ps[0].x - ps[1].x;
      const dy = ps[0].y - ps[1].y;
      pinchRef.current = {
        startDist: Math.hypot(dx, dy),
        startScale: viewport.scale,
      };
    }
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [viewport.scale]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (scrollLocked) return;

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const ps = Array.from(pointersRef.current.values());
      const dx = ps[0].x - ps[1].x;
      const dy = ps[0].y - ps[1].y;
      const dist = Math.hypot(dx, dy);
      const next = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
      zoomTo(next);
      return;
    }

    if (pointersRef.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      // Threshold of 4px so a casual finger settle doesn't register
      // as a pan; below that, it's still a tap.
      if (Math.abs(dx) + Math.abs(dy) > 4) panAccumRef.current.moved = true;
      panBy(dx, dy);
    }
  }, [panBy, zoomTo, scrollLocked]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const start = pointersRef.current.get(e.pointerId);
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    // Tap-to-focus: single pointer, no pan accumulated, on the canvas.
    if (start && !panAccumRef.current.moved && pointersRef.current.size === 0) {
      const svg = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      const x = e.clientX - svg.left;
      const y = e.clientY - svg.top;
      const { r, c } = screenToCell(viewport, x, y);
      tapFeedback();
      setCursor(r, c);
    }
  }, [setCursor, viewport]);

  // ── Visible-cell window ──────────────────────────────────────────
  // Convert viewport rect → cell range with a small overscan so things
  // pan in smoothly. This keeps render work O(visibleCells), not
  // O(allCells).
  const eff = viewport.cellSizePx * viewport.scale;
  const overscan = 2;
  const cMin = Math.floor((-viewport.panX) / eff) - overscan;
  const rMin = Math.floor((-viewport.panY) / eff) - overscan;
  const cMax = Math.ceil((size.w - viewport.panX) / eff) + overscan;
  const rMax = Math.ceil((size.h - viewport.panY) / eff) + overscan;

  // ── Render grid lines ────────────────────────────────────────────
  const gridLines: React.ReactNode[] = [];
  for (let c = cMin; c <= cMax; c++) {
    const x = c * eff + viewport.panX;
    const major = c % MAJOR_GRID_EVERY === 0;
    gridLines.push(
      <line
        key={`vc${c}`}
        x1={x} y1={0}
        x2={x} y2={size.h}
        stroke={major ? palette.gridMajor : palette.gridMinor}
        strokeWidth={major ? 1.2 : 0.6}
      />,
    );
  }
  for (let r = rMin; r <= rMax; r++) {
    const y = r * eff + viewport.panY;
    const major = r % MAJOR_GRID_EVERY === 0;
    gridLines.push(
      <line
        key={`hr${r}`}
        x1={0} y1={y}
        x2={size.w} y2={y}
        stroke={major ? palette.gridMajor : palette.gridMinor}
        strokeWidth={major ? 1.2 : 0.6}
      />,
    );
  }

  // ── Render cell tints (selection, locked, cursor) ────────────────
  const tints: React.ReactNode[] = [];
  if (selection) {
    for (let r = Math.max(rMin, selection.from.r); r <= Math.min(rMax, selection.to.r); r++) {
      for (let c = Math.max(cMin, selection.from.c); c <= Math.min(cMax, selection.to.c); c++) {
        const p = cellToScreen(viewport, r, c);
        tints.push(
          <rect
            key={`sel${r},${c}`}
            x={p.x} y={p.y}
            width={p.size} height={p.size}
            fill={palette.selectionTint}
          />,
        );
      }
    }
  }

  // Cursor highlight
  const cp = cellToScreen(viewport, cursor.r, cursor.c);
  tints.push(
    <rect
      key="cursor"
      x={cp.x} y={cp.y}
      width={cp.size} height={cp.size}
      fill={palette.cursorTint}
      data-testid="math-grid-cursor"
    />,
  );

  // ── Render filled cells (glyphs + locked tint) ───────────────────
  const glyphNodes: React.ReactNode[] = [];
  cells.forEach((cell, key) => {
    const { r, c } = parseCellKey(key);
    if (r < rMin || r > rMax || c < cMin || c > cMax) return;
    const p = cellToScreen(viewport, r, c);
    if (cell.locked && !isCellInSelection(selection, r, c)) {
      glyphNodes.push(
        <rect
          key={`lk${key}`}
          x={p.x} y={p.y}
          width={p.size} height={p.size}
          fill={palette.lockedTint}
        />,
      );
    }
    // Multi-char glyphs (chemistry "(aq)", biology "Kingdom",
    // physics "eV", earth-sci "Mya", music "cresc.", stats "p-value")
    // overflowed adjacent cells with the previous fixed font-size.
    // textLength + lengthAdjust='spacingAndGlyphs' fits any glyph
    // into the cell width by compressing inter-letter spacing. We
    // only apply it for glyphs > 1 char so single-glyph cells render
    // crisp at full font size. The cap is `cellSize * 0.92` so a
    // tiny breathing margin remains and the glyph doesn't kiss the
    // cell border.
    const glyphLen = cell.glyph.length;
    const cellColor = syntaxColors.get(key) ?? palette.glyph;
    glyphNodes.push(
      <text
        key={`g${key}`}
        x={p.x + p.size / 2}
        y={p.y + p.size * 0.7}
        textAnchor="middle"
        fill={cellColor}
        style={{
          fontSize: `${p.size * 0.6}px`,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 600,
        }}
        {...(glyphLen > 1 ? { textLength: p.size * 0.92, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
      >
        {cell.glyph}
      </text>,
    );
  });

  // ── Render decorations (fraction bars, root bars, etc.) ──────────
  const decorationNodes: React.ReactNode[] = decorations.map((d, i) => renderDecoration(d, i, viewport, palette.decoration));

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`} data-testid="math-grid">
      <svg
        width={size.w}
        height={size.h}
        style={{ background: palette.background, touchAction: 'none', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="math-grid-svg"
        data-skin={skin}
        data-scroll-locked={scrollLocked ? '1' : '0'}
      >
        <g data-testid="math-grid-lines">{gridLines}</g>
        <g data-testid="math-grid-tints">{tints}</g>
        <g data-testid="math-grid-glyphs">{glyphNodes}</g>
        <g data-testid="math-grid-decorations">{decorationNodes}</g>
      </svg>
    </div>
  );
}

function renderDecoration(d: Decoration, idx: number, viewport: { cellSizePx: number; scale: number; panX: number; panY: number }, color: string): React.ReactNode {
  const { x, y, size } = cellToScreen(viewport, d.anchor.r, d.anchor.c);
  const w = size * d.length;
  switch (d.type) {
    case 'fraction-bar':
      return (
        <line key={`frac${idx}`} x1={x} y1={y + size} x2={x + w} y2={y + size}
          stroke={color} strokeWidth={Math.max(2, size * 0.06)} />
      );
    case 'long-division-bar':
      return (
        <line key={`ldb${idx}`} x1={x} y1={y} x2={x + w} y2={y}
          stroke={color} strokeWidth={Math.max(2, size * 0.06)} />
      );
    case 'long-division-tick':
      return (
        <line key={`ldt${idx}`} x1={x} y1={y} x2={x} y2={y + size}
          stroke={color} strokeWidth={Math.max(2, size * 0.06)} />
      );
    case 'root-bar':
      return (
        <line key={`rb${idx}`} x1={x} y1={y} x2={x + w} y2={y}
          stroke={color} strokeWidth={Math.max(2, size * 0.06)} />
      );
    case 'summation-line':
      return (
        <line key={`sm${idx}`} x1={x} y1={y + size} x2={x + w} y2={y + size}
          stroke={color} strokeWidth={Math.max(2, size * 0.06)} />
      );
  }
}

// Expose cell-key helper for test/dev consumers without re-importing engine.
export { cellKey };
