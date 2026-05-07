'use client';
/**
 * Dev-only isolated harness for MathGrid.
 *
 * Reachable at /prism-aac/dev/math-grid. The page mounts MathGrid
 * full-screen with a small debug HUD: cursor coords, viewport, cell
 * count. Lets us iterate on the canvas without touching the rest
 * of the AAC shell.
 *
 * NOT linked from the toolbar. Anyone arriving here did so deliberately.
 */
import { useEffect } from 'react';
import MathGrid from '@/components/math/MathGrid';
import { useMathGridStore } from '@/store/mathGridStore';

export default function MathGridDevPage() {
  const cursor = useMathGridStore((s) => s.cursor);
  const viewport = useMathGridStore((s) => s.viewport);
  const cellsCount = useMathGridStore((s) => s.cells.size);
  const reset = useMathGridStore((s) => s.reset);
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  const backspaceAtCursor = useMathGridStore((s) => s.backspaceAtCursor);
  const setCursor = useMathGridStore((s) => s.setCursor);

  // Tiny dev-only physical-keyboard handler so we can prototype glyph
  // entry without the on-screen keyboard yet.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Backspace') { e.preventDefault(); backspaceAtCursor(); return; }
      if (e.key === 'Enter') { e.preventDefault(); setCursor(cursor.r + 1, 0); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        commitGlyph(e.key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [backspaceAtCursor, commitGlyph, setCursor, cursor.r]);

  return (
    <div className="h-svh flex flex-col bg-white" data-testid="math-grid-dev-page">
      <header className="flex items-center justify-between px-3 py-2 border-b text-sm font-mono shrink-0 bg-gray-50">
        <span>MathGrid dev — cursor=({cursor.r},{cursor.c}) cells={cellsCount} scale={viewport.scale.toFixed(2)} pan=({Math.round(viewport.panX)},{Math.round(viewport.panY)})</span>
        <button
          onClick={() => reset()}
          className="rounded bg-red-100 text-red-700 px-2 py-1 text-xs"
        >
          reset
        </button>
      </header>
      <div className="flex-1 min-h-0">
        <MathGrid />
      </div>
      <footer className="text-xs text-gray-500 px-3 py-2 border-t shrink-0">
        Type any character to commit a glyph. Backspace = delete. Enter = next row. Tap to move cursor. Pinch / drag to zoom and pan.
      </footer>
    </div>
  );
}
