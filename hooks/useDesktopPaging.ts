'use client';
import { useCallback, useRef, type Dispatch, type SetStateAction, type HTMLAttributes } from 'react';

// Both vocabulary and category paging must interpret desktop input alike.
export function useDesktopPaging(setPage: Dispatch<SetStateAction<number>>) {
  const count = useRef(1);
  const node = useRef<HTMLDivElement | null>(null);
  const wheel = useRef({ time: -Infinity, distance: 0, paged: false });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const page = useCallback((direction: number) => {
    setPage(previous => Math.max(0, Math.min(count.current - 1, Math.min(previous, count.current - 1) + direction)));
  }, [setPage]);
  const onWheel = useCallback((event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.5) return;
    // A non-passive listener prevents horizontal gestures navigating browser history.
    event.preventDefault();
    const now = performance.now();
    if (now - wheel.current.time > 180) wheel.current = { time: now, distance: 0, paged: false };
    wheel.current.time = now;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.current?.clientWidth || 1 : 1;
    wheel.current.distance += event.deltaX * scale;
    if (!wheel.current.paged && Math.abs(wheel.current.distance) >= 48) {
      wheel.current.paged = true;
      page(wheel.current.distance > 0 ? 1 : -1);
    }
  }, [page]);
  const ref = useCallback((element: HTMLDivElement | null) => {
    node.current?.removeEventListener('wheel', onWheel);
    node.current = element;
    element?.addEventListener('wheel', onWheel, { passive: false });
  }, [onWheel]);
  const bind = (pages: number, existing: HTMLAttributes<HTMLDivElement> = {}) => {
    count.current = Math.max(1, pages);
    return {
      ...existing,
      onDragStart: (event: React.DragEvent<HTMLDivElement>) => event.preventDefault(),
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        existing.onPointerDown?.(event);
        suppressClick.current = false;
        drag.current = null;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          suppressClick.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          event.preventDefault();
        }
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        drag.current = null;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          suppressClick.current = true;
          page(dx < 0 ? 1 : -1);
        }
      },
      onPointerCancel: () => { drag.current = null; },
      onLostPointerCapture: () => { drag.current = null; },
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        existing.onClickCapture?.(event);
        if (suppressClick.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    };
  };
  return { ref, bind };
}
