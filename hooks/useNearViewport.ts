'use client';

import { useEffect, useRef, useState } from 'react';

const PICTOGRAM_PREFETCH_MARGIN = '120px';

/**
 * Returns true once an element is visible or close enough to prefetch.
 *
 * AAC boards can contain hundreds of vocabulary tiles in one scroll surface.
 * Mounting a tile must not start its pictogram lookup until the user is near
 * it. Browsers without IntersectionObserver retain the reliable eager fallback.
 */
export function useNearViewport<T extends Element>(
  enabled = true,
): { elementRef: React.RefObject<T | null>; isNearViewport: boolean } {
  const elementRef = useRef<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    if (!enabled || isNearViewport) return;
    const element = elementRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: PICTOGRAM_PREFETCH_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, isNearViewport]);

  return {
    elementRef,
    isNearViewport: !enabled || isNearViewport,
  };
}
