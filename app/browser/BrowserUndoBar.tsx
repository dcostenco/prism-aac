'use client';

import { useEffect } from 'react';
import { useBrowserStore } from './browserStore';

/** How long "<tile> removed · Undo" stays on screen. */
export const UNDO_VISIBLE_MS = 10_000;

// One stray tap used to delete a Home tile for good: no confirm, no restore.
// Removing stays one tap; this bar makes it reversible.
export default function BrowserUndoBar() {
  const lastRemoved = useBrowserStore((s) => s.lastRemoved);
  const undoUnpin = useBrowserStore((s) => s.undoUnpin);
  const dismissUndo = useBrowserStore((s) => s.dismissUndo);

  useEffect(() => {
    if (!lastRemoved) return;
    const timer = setTimeout(dismissUndo, UNDO_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [lastRemoved, dismissUndo]);

  if (!lastRemoved) return null;
  return (
    <div
      role="status"
      data-testid="browser-undo-bar"
      className="shrink-0 flex items-center justify-between gap-3 px-3 py-1 surface-bar border-t border-theme"
    >
      <span className="text-sm font-semibold text-primary truncate">{lastRemoved.bookmark.title} removed</span>
      <button
        onClick={undoUnpin}
        className="aac-btn shrink-0 min-h-[44px] px-4 rounded-lg bg-blue-600 text-white text-sm font-extrabold select-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        Undo
      </button>
    </div>
  );
}
