import { describe, expect, it } from 'vitest';
import { classifyAacDevice, type AacDeviceSignals } from '@/lib/aacDeviceClass';

const base: AacDeviceSignals = {
  userAgent: '',
  maxTouchPoints: 0,
  screenWidth: 1440,
  screenHeight: 900,
};

describe('classifyAacDevice', () => {
  it.each([
    ['iPad Safari', 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5],
    ['iPadOS desktop user agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5],
    ['Android tablet', 'Mozilla/5.0 (Linux; Android 14; SM-X710 Build/UP1A)', 5],
  ])('keeps %s in tablet layout even when its app window is narrow', (_name, userAgent, maxTouchPoints) => {
    expect(classifyAacDevice({
      ...base,
      userAgent,
      maxTouchPoints,
      screenWidth: 834,
      screenHeight: 1194,
    })).toBe('tablet');
  });

  it.each([
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'],
    ['Android phone', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit Mobile'],
  ])('keeps a wide landscape %s in phone layout', (_name, userAgent) => {
    expect(classifyAacDevice({
      ...base,
      userAgent,
      maxTouchPoints: 5,
      screenWidth: 956,
      screenHeight: 440,
    })).toBe('phone');
  });

  it('uses the physical short side only as a fallback for unidentified touch devices', () => {
    expect(classifyAacDevice({
      ...base,
      maxTouchPoints: 5,
      screenWidth: 1280,
      screenHeight: 800,
    })).toBe('tablet');
    expect(classifyAacDevice({
      ...base,
      maxTouchPoints: 5,
      screenWidth: 932,
      screenHeight: 430,
    })).toBe('phone');
  });

  it('does not apply touch layouts to pointer-only desktops', () => {
    expect(classifyAacDevice(base)).toBe('pointer');
  });
});
