'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';

interface Props {
  text: string;
  className: string;
  testId?: string;
  minFontSizePx?: number;
  style?: CSSProperties;
}

/**
 * Preserve authored word boundaries while fitting translated AAC labels.
 * CSS handles ordinary wrapping at spaces; this only reduces the font when
 * an unbreakable word or the line clamp would otherwise clip communication.
 */
export default function FittedTileLabel({
  text,
  className,
  testId,
  minFontSizePx = 12,
  style,
}: Props) {
  const labelRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    let cancelled = false;
    let frame = 0;

    const fit = () => {
      if (cancelled) return;
      label.style.removeProperty('font-size');
      delete label.dataset.fitStatus;
      let fontSize = Number.parseFloat(getComputedStyle(label).fontSize);
      if (!Number.isFinite(fontSize)) return;

      const preferredFloor = Math.max(1, minFontSizePx);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const widthOverflow = label.scrollWidth > label.clientWidth + 1;
        const heightOverflow = label.scrollHeight > label.clientHeight + 1;
        if (!widthOverflow && !heightOverflow) {
          label.dataset.fitStatus = fontSize < preferredFloor ? 'fit-below-min' : 'fit';
          return;
        }

        const widthScale = widthOverflow && label.scrollWidth > 0
          ? label.clientWidth / label.scrollWidth
          : 1;
        const heightScale = heightOverflow && label.scrollHeight > 0
          ? label.clientHeight / label.scrollHeight
          : 1;
        const scaled = fontSize * Math.min(widthScale, heightScale, 0.96);
        // The preferred floor protects readability for normal labels. If a
        // translated label still overflows at that floor, continue shrinking
        // as an emergency path: tiny complete communication is safer than a
        // silently omitted word. E2E gates keep ordinary labels above their
        // required readable size.
        const floor = fontSize > preferredFloor ? preferredFloor : 1;
        let nextSize = Math.max(floor, Math.floor(scaled * 2) / 2);
        if (nextSize >= fontSize || Math.abs(nextSize - fontSize) < 0.1) {
          nextSize = Math.max(floor, fontSize - 0.5);
        }
        if (nextSize >= fontSize || Math.abs(nextSize - fontSize) < 0.1) break;
        fontSize = nextSize;
        label.style.fontSize = `${fontSize}px`;
      }

      const stillOverflowing = label.scrollWidth > label.clientWidth + 1
        || label.scrollHeight > label.clientHeight + 1;
      label.dataset.fitStatus = stillOverflowing
        ? 'overflow'
        : fontSize < preferredFloor ? 'fit-below-min' : 'fit';
    };

    const scheduleFit = () => {
      if (cancelled) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    scheduleFit();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleFit);
    if (resizeObserver) {
      resizeObserver.observe(label.parentElement ?? label);
    } else {
      window.addEventListener('resize', scheduleFit);
      window.addEventListener('orientationchange', scheduleFit);
    }
    void document.fonts?.ready.then(scheduleFit);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      if (!resizeObserver) {
        window.removeEventListener('resize', scheduleFit);
        window.removeEventListener('orientationchange', scheduleFit);
      }
    };
  }, [minFontSizePx, text]);

  return (
    <span ref={labelRef} data-testid={testId} className={className} style={style}>
      {text}
    </span>
  );
}
