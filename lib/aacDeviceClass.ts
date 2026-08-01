export type AacDeviceClass = 'phone' | 'tablet' | 'pointer';

export type AacDeviceSignals = {
  userAgent: string;
  maxTouchPoints: number;
  screenWidth: number;
  screenHeight: number;
};

const TABLET_MIN_SHORT_SIDE = 600;

/**
 * Classify the physical AAC device independently of the current viewport.
 *
 * Viewport width cannot distinguish a wide landscape iPhone from an iPad in
 * Split View. iPadOS may also advertise a Macintosh user agent, so its touch
 * points are part of the explicit tablet signal. Screen size is only a
 * fallback for touch devices whose user agent identifies neither form factor.
 */
export function classifyAacDevice({
  userAgent,
  maxTouchPoints,
  screenWidth,
  screenHeight,
}: AacDeviceSignals): AacDeviceClass {
  const ipad = /iPad/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const androidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
  if (ipad || androidTablet) return 'tablet';

  if (/iPhone|iPod/i.test(userAgent) || (/Android/i.test(userAgent) && /Mobile/i.test(userAgent))) {
    return 'phone';
  }

  if (maxTouchPoints > 0) {
    const shortSide = Math.min(screenWidth, screenHeight);
    return Number.isFinite(shortSide) && shortSide >= TABLET_MIN_SHORT_SIDE
      ? 'tablet'
      : 'phone';
  }

  return 'pointer';
}

export function getAacDeviceClass(): AacDeviceClass {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'pointer';
  return classifyAacDevice({
    userAgent: navigator.userAgent || '',
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    screenWidth: window.screen?.width ?? window.innerWidth,
    screenHeight: window.screen?.height ?? window.innerHeight,
  });
}
