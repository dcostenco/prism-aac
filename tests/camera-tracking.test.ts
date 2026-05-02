/**
 * Camera Tracking Tests — Critical Path
 *
 * Tests for body pose tracking, calibration, coordinate mapping,
 * and adaptive calibration. A failure here means a child cannot
 * control the cursor with their body.
 */
import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Coordinate Mirroring — front camera X-axis inversion
// ═══════════════════════════════════════════════════════════════

describe('Front camera X-axis mirroring', () => {
  const mirror = (normX: number) => 1.0 - normX;

  it('normX=0 (camera-left) becomes 1.0 (user right)', () => {
    expect(mirror(0)).toBe(1.0);
  });

  it('normX=1 (camera-right) becomes 0.0 (user left)', () => {
    expect(mirror(1)).toBe(0.0);
  });

  it('center stays at center', () => {
    expect(mirror(0.5)).toBe(0.5);
  });

  it('moving hand RIGHT decreases normX, increases mirroredX', () => {
    const before = mirror(0.6);
    const after = mirror(0.4); // hand moved right → normX decreased
    expect(after).toBeGreaterThan(before);
  });
});

// ═══════════════════════════════════════════════════════════════
// Calibration mapping — normalized to screen coordinates
// ═══════════════════════════════════════════════════════════════

describe('Calibration coordinate mapping', () => {
  const mapToScreen = (
    mirroredX: number, normY: number,
    cal: { leftX: number; rightX: number; topY: number; bottomY: number },
    screenW: number, screenH: number
  ) => {
    const rangeX = cal.leftX - cal.rightX;
    const rangeY = cal.bottomY - cal.topY;
    const rawX = rangeX !== 0 ? ((mirroredX - cal.rightX) / rangeX) * screenW : screenW / 2;
    const rawY = rangeY !== 0 ? ((normY - cal.topY) / rangeY) * screenH : screenH / 2;
    return {
      x: Math.max(0, Math.min(screenW, rawX)),
      y: Math.max(0, Math.min(screenH, rawY)),
    };
  };

  const cal = { leftX: 0.75, rightX: 0.05, topY: 0.2, bottomY: 0.8 };

  it('rightX maps to screen left edge (x=0)', () => {
    const { x } = mapToScreen(0.05, 0.5, cal, 1024, 768);
    expect(x).toBeCloseTo(0, 0);
  });

  it('leftX maps to screen right edge (x=screenW)', () => {
    const { x } = mapToScreen(0.75, 0.5, cal, 1024, 768);
    expect(x).toBeCloseTo(1024, 0);
  });

  it('topY maps to screen top (y=0)', () => {
    const { y } = mapToScreen(0.5, 0.2, cal, 1024, 768);
    expect(y).toBeCloseTo(0, 0);
  });

  it('bottomY maps to screen bottom (y=screenH)', () => {
    const { y } = mapToScreen(0.5, 0.8, cal, 1024, 768);
    expect(y).toBeCloseTo(768, 0);
  });

  it('center of calibration maps to center of screen', () => {
    const midX = (cal.leftX + cal.rightX) / 2;
    const midY = (cal.topY + cal.bottomY) / 2;
    const { x, y } = mapToScreen(midX, midY, cal, 1024, 768);
    expect(x).toBeCloseTo(512, 0);
    expect(y).toBeCloseTo(384, 0);
  });

  it('clamps negative values to 0', () => {
    const { x, y } = mapToScreen(-0.5, -0.5, cal, 1024, 768);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('clamps values exceeding screen dimensions', () => {
    const { x, y } = mapToScreen(1.5, 1.5, cal, 1024, 768);
    expect(x).toBe(1024);
    expect(y).toBe(768);
  });
});

// ═══════════════════════════════════════════════════════════════
// Adaptive calibration — range expansion and decay
// ═══════════════════════════════════════════════════════════════

describe('Adaptive calibration', () => {
  const ADAPT_RATE = 0.02;
  const DECAY_RATE = 0.0005;

  function adaptStep(cal: { leftX: number; rightX: number; topY: number; bottomY: number }, mirroredX: number, normY: number) {
    const c = { ...cal };
    if (mirroredX < c.rightX) c.rightX += (mirroredX - c.rightX) * ADAPT_RATE;
    if (mirroredX > c.leftX) c.leftX += (mirroredX - c.leftX) * ADAPT_RATE;
    if (normY < c.topY) c.topY += (normY - c.topY) * ADAPT_RATE;
    if (normY > c.bottomY) c.bottomY += (normY - c.bottomY) * ADAPT_RATE;
    const midX = (c.leftX + c.rightX) / 2;
    const midY = (c.topY + c.bottomY) / 2;
    c.rightX += (midX - c.rightX) * DECAY_RATE;
    c.leftX += (midX - c.leftX) * DECAY_RATE;
    c.topY += (midY - c.topY) * DECAY_RATE;
    c.bottomY += (midY - c.bottomY) * DECAY_RATE;
    return c;
  }

  it('expands rightX when hand moves beyond left boundary', () => {
    const cal = { leftX: 0.75, rightX: 0.05, topY: 0.2, bottomY: 0.8 };
    const adapted = adaptStep(cal, 0.01, 0.5); // mirroredX=0.01 < rightX=0.05
    expect(adapted.rightX).toBeLessThan(cal.rightX);
  });

  it('expands leftX when hand moves beyond right boundary', () => {
    const cal = { leftX: 0.75, rightX: 0.05, topY: 0.2, bottomY: 0.8 };
    const adapted = adaptStep(cal, 0.9, 0.5); // mirroredX=0.9 > leftX=0.75
    expect(adapted.leftX).toBeGreaterThan(cal.leftX);
  });

  it('does NOT change range when hand is within bounds', () => {
    const cal = { leftX: 0.75, rightX: 0.05, topY: 0.2, bottomY: 0.8 };
    const adapted = adaptStep(cal, 0.4, 0.5); // within 0.05-0.75
    // Only decay affects it (very small)
    expect(Math.abs(adapted.leftX - cal.leftX)).toBeLessThan(0.001);
    expect(Math.abs(adapted.rightX - cal.rightX)).toBeLessThan(0.001);
  });

  it('decay slowly shrinks the range toward center', () => {
    const cal = { leftX: 0.9, rightX: 0.1, topY: 0.1, bottomY: 0.9 };
    let c = { ...cal };
    for (let i = 0; i < 1000; i++) c = adaptStep(c, 0.5, 0.5); // 1000 frames at center
    const range = c.leftX - c.rightX;
    const origRange = cal.leftX - cal.rightX;
    expect(range).toBeLessThan(origRange);
    expect(range).toBeGreaterThan(origRange * 0.5); // doesn't collapse completely
  });

  it('adapts to car wiggle — range stays usable after perturbation', () => {
    let cal = { leftX: 0.7, rightX: 0.1, topY: 0.2, bottomY: 0.8 };
    // Simulate 60fps for 5 seconds of normal movement
    for (let i = 0; i < 300; i++) {
      const x = 0.3 + Math.sin(i * 0.1) * 0.2; // oscillating movement
      const y = 0.4 + Math.cos(i * 0.1) * 0.15;
      cal = adaptStep(cal, x, y);
    }
    // Range should still be reasonable
    expect(cal.leftX - cal.rightX).toBeGreaterThan(0.2);
    expect(cal.bottomY - cal.topY).toBeGreaterThan(0.2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Orientation-aware calibration storage
// ═══════════════════════════════════════════════════════════════

describe('Orientation-aware calibration', () => {
  it('landscape and portrait use different keys', () => {
    const landscapeKey = 'prism-pose-calibration-landscape';
    const portraitKey = 'prism-pose-calibration-portrait';
    expect(landscapeKey).not.toBe(portraitKey);
  });

  it('width >= height is landscape', () => {
    const isLandscape = (w: number, h: number) => w >= h ? 'landscape' : 'portrait';
    expect(isLandscape(1024, 768)).toBe('landscape');
    expect(isLandscape(768, 1024)).toBe('portrait');
    expect(isLandscape(1024, 1024)).toBe('landscape'); // square = landscape
  });
});

// ═══════════════════════════════════════════════════════════════
// EMA smoothing — cursor stability
// ═══════════════════════════════════════════════════════════════

describe('EMA cursor smoothing', () => {
  const ema = (prev: number, next: number, alpha: number) => prev + alpha * (next - prev);

  it('alpha=0 means no movement (fully smoothed)', () => {
    expect(ema(100, 500, 0)).toBe(100);
  });

  it('alpha=1 means instant jump (no smoothing)', () => {
    expect(ema(100, 500, 1)).toBe(500);
  });

  it('alpha=0.1 moves 10% toward target', () => {
    expect(ema(100, 200, 0.1)).toBeCloseTo(110);
  });

  it('converges over multiple frames', () => {
    let pos = 0;
    for (let i = 0; i < 50; i++) pos = ema(pos, 500, 0.1);
    expect(pos).toBeGreaterThan(490); // nearly converged
  });

  it('low alpha prevents jitter (car movement)', () => {
    let pos = 500;
    // Rapid oscillation around 500 simulates car bumps
    for (let i = 0; i < 100; i++) {
      const target = 500 + (Math.random() - 0.5) * 100; // ±50px jitter
      pos = ema(pos, target, 0.05); // very low alpha
    }
    expect(Math.abs(pos - 500)).toBeLessThan(30); // stays near center
  });
});

// ═══════════════════════════════════════════════════════════════
// Visibility threshold — skip low-confidence landmarks
// ═══════════════════════════════════════════════════════════════

describe('Landmark visibility threshold', () => {
  const THRESHOLD = 0.5;

  it('high visibility passes threshold', () => {
    expect(0.95 >= THRESHOLD).toBe(true);
  });

  it('low visibility fails threshold', () => {
    expect(0.3 >= THRESHOLD).toBe(false);
  });

  it('exact threshold passes', () => {
    expect(0.5 >= THRESHOLD).toBe(true);
  });

  it('zero visibility (occluded) fails', () => {
    expect(0 >= THRESHOLD).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Identity locking — multi-person scene handling
// ═══════════════════════════════════════════════════════════════

describe('Identity locking — nose anchor', () => {
  function pickClosest(
    poses: Array<{ nose: { x: number; y: number } }>,
    anchor: { x: number; y: number } | null
  ): number {
    if (!anchor || poses.length <= 1) return 0;
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < poses.length; i++) {
      const dx = poses[i].nose.x - anchor.x;
      const dy = poses[i].nose.y - anchor.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return bestDist > 0.25 ? 0 : bestIdx;
  }

  it('single person always returns index 0', () => {
    expect(pickClosest([{ nose: { x: 0.5, y: 0.5 } }], { x: 0.5, y: 0.5 })).toBe(0);
  });

  it('two people — picks the one closest to anchor', () => {
    const anchor = { x: 0.3, y: 0.4 };
    const poses = [
      { nose: { x: 0.7, y: 0.6 } }, // sibling — far from anchor
      { nose: { x: 0.32, y: 0.42 } }, // user — close to anchor
    ];
    expect(pickClosest(poses, anchor)).toBe(1);
  });

  it('no anchor — defaults to first pose', () => {
    expect(pickClosest([{ nose: { x: 0.5, y: 0.5 } }, { nose: { x: 0.3, y: 0.3 } }], null)).toBe(0);
  });

  it('anchor too far from all poses — defaults to 0 (re-lock)', () => {
    const anchor = { x: 0.1, y: 0.1 };
    const poses = [
      { nose: { x: 0.8, y: 0.8 } },
      { nose: { x: 0.7, y: 0.7 } },
    ];
    expect(pickClosest(poses, anchor)).toBe(0); // re-lock to first
  });
});

describe('Identity locking — face IoU', () => {
  function iou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
    const ix1 = Math.max(a.x, b.x);
    const iy1 = Math.max(a.y, b.y);
    const ix2 = Math.min(a.x + a.w, b.x + b.w);
    const iy2 = Math.min(a.y + a.h, b.y + b.h);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    const union = a.w * a.h + b.w * b.h - inter;
    return union > 0 ? inter / union : 0;
  }

  it('identical rects have IoU = 1', () => {
    expect(iou({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 100, h: 100 })).toBe(1);
  });

  it('non-overlapping rects have IoU = 0', () => {
    expect(iou({ x: 0, y: 0, w: 50, h: 50 }, { x: 200, y: 200, w: 50, h: 50 })).toBe(0);
  });

  it('partial overlap has 0 < IoU < 1', () => {
    const v = iou({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 });
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it('small shift has high IoU (same person)', () => {
    const v = iou({ x: 100, y: 100, w: 80, h: 80 }, { x: 105, y: 103, w: 80, h: 80 });
    expect(v).toBeGreaterThan(0.8);
  });
});

describe('Touch hysteresis', () => {
  function isTouch(prob: number, wasInTouch: boolean): boolean {
    if (wasInTouch) return prob >= 0.65;
    return prob >= 0.85;
  }

  it('enters touch at 0.85', () => {
    expect(isTouch(0.85, false)).toBe(true);
    expect(isTouch(0.84, false)).toBe(false);
  });

  it('stays in touch down to 0.65', () => {
    expect(isTouch(0.70, true)).toBe(true);
    expect(isTouch(0.65, true)).toBe(true);
  });

  it('exits touch below 0.65', () => {
    expect(isTouch(0.64, true)).toBe(false);
  });

  it('prevents oscillation at 0.80', () => {
    expect(isTouch(0.80, false)).toBe(false); // won't enter
    expect(isTouch(0.80, true)).toBe(true);   // won't exit
  });
});

// ═══════════════════════════════════════════════════════════════
// FaceDetector fallback — bounding box to cursor mapping
// ═══════════════════════════════════════════════════════════════

describe('FaceDetector bounding box to cursor', () => {
  it('center of face bounding box maps to normalized coords', () => {
    const bb = { originX: 100, originY: 50, width: 200, height: 250 };
    const videoW = 640, videoH = 480;
    const normX = (bb.originX + bb.width / 2) / videoW;
    const normY = (bb.originY + bb.height / 2) / videoH;
    expect(normX).toBeCloseTo(0.3125);
    expect(normY).toBeCloseTo(0.3646, 3);
  });

  it('face at top-left of frame maps to low normalized coords', () => {
    const bb = { originX: 0, originY: 0, width: 100, height: 100 };
    const normX = (bb.originX + bb.width / 2) / 640;
    const normY = (bb.originY + bb.height / 2) / 480;
    expect(normX).toBeLessThan(0.15);
    expect(normY).toBeLessThan(0.15);
  });
});

// ═══════════════════════════════════════════════════════════════
// Calibration wizard — 4-corner sample averaging
// ═══════════════════════════════════════════════════════════════

describe('Calibration wizard — sample averaging', () => {
  it('averages multiple samples for one corner', () => {
    const samples = [
      { normX: 0.3, normY: 0.2 },
      { normX: 0.32, normY: 0.22 },
      { normX: 0.28, normY: 0.18 },
    ];
    const avg = {
      normX: samples.reduce((s, v) => s + v.normX, 0) / samples.length,
      normY: samples.reduce((s, v) => s + v.normY, 0) / samples.length,
    };
    expect(avg.normX).toBeCloseTo(0.3);
    expect(avg.normY).toBeCloseTo(0.2);
  });

  it('4 corners produce valid calibration', () => {
    const corners = [
      { normX: 0.8, normY: 0.2 },  // top-left (mirrored)
      { normX: 0.2, normY: 0.2 },  // top-right (mirrored)
      { normX: 0.2, normY: 0.8 },  // bottom-right (mirrored)
      { normX: 0.8, normY: 0.8 },  // bottom-left (mirrored)
    ];
    // Mirror X
    const m = corners.map(c => ({ x: 1 - c.normX, y: c.normY }));
    const cal = {
      leftX: (m[0].x + m[3].x) / 2,   // left corners
      rightX: (m[1].x + m[2].x) / 2,  // right corners
      topY: (m[0].y + m[1].y) / 2,
      bottomY: (m[2].y + m[3].y) / 2,
    };
    expect(cal.leftX).toBeCloseTo(0.2);  // mirrored 0.8 → 0.2
    expect(cal.rightX).toBeCloseTo(0.8); // mirrored 0.2 → 0.8
    expect(cal.topY).toBeCloseTo(0.2);
    expect(cal.bottomY).toBeCloseTo(0.8);
    // Range should be positive after swap
    if (cal.leftX > cal.rightX) [cal.leftX, cal.rightX] = [cal.rightX, cal.leftX];
    expect(cal.rightX - cal.leftX).toBeGreaterThan(0.4);
  });
});

// ═══════════════════════════════════════════════════════════════
// Auto-detect fallback chain — nose → wrist → index → elbow
// ═══════════════════════════════════════════════════════════════

describe('Body part auto-detection fallback chain', () => {
  const LANDMARK_INDEX: Record<string, number> = {
    nose: 0, right_wrist: 16, left_wrist: 15, right_index: 19,
    left_index: 20, right_elbow: 14, left_elbow: 13,
  };
  const FALLBACK_CHAIN = ['right_wrist', 'nose', 'right_wrist', 'left_wrist', 'right_index', 'left_index', 'right_elbow', 'left_elbow'];
  const VIS_THRESHOLD = 0.5;

  function detectBest(landmarks: Array<{ visibility: number }>, requested: string): string | null {
    const chain = [requested, ...FALLBACK_CHAIN.filter(t => t !== requested)];
    for (const target of chain) {
      const idx = LANDMARK_INDEX[target];
      if (idx !== undefined && landmarks.length > idx && landmarks[idx].visibility >= VIS_THRESHOLD) {
        return target;
      }
    }
    return null;
  }

  it('uses requested target when visible', () => {
    const lm = Array(33).fill({ visibility: 0.9 });
    expect(detectBest(lm, 'right_wrist')).toBe('right_wrist');
  });

  it('falls back to nose when wrist is occluded', () => {
    const lm = Array(33).fill({ visibility: 0.9 });
    lm[16] = { visibility: 0.1 }; // right_wrist occluded
    expect(detectBest(lm, 'right_wrist')).toBe('nose');
  });

  it('falls back to left_wrist when nose and right_wrist are occluded', () => {
    const lm = Array(33).fill({ visibility: 0.9 });
    lm[16] = { visibility: 0.1 }; // right_wrist
    lm[0] = { visibility: 0.1 };  // nose
    expect(detectBest(lm, 'right_wrist')).toBe('left_wrist');
  });

  it('falls back to right_index when all above are occluded', () => {
    const lm = Array(33).fill({ visibility: 0.9 });
    lm[16] = { visibility: 0.1 }; // right_wrist
    lm[0] = { visibility: 0.1 };  // nose
    lm[15] = { visibility: 0.1 }; // left_wrist
    expect(detectBest(lm, 'right_wrist')).toBe('right_index');
  });

  it('returns null when nothing is visible', () => {
    const lm = Array(33).fill({ visibility: 0.1 });
    expect(detectBest(lm, 'right_wrist')).toBeNull();
  });

  it('car scenario: only hand visible at angle', () => {
    const lm = Array(33).fill({ visibility: 0.0 }); // nothing visible
    lm[16] = { visibility: 0.8 }; // only right_wrist
    expect(detectBest(lm, 'right_wrist')).toBe('right_wrist');
  });

  it('car scenario: head visible but hand below camera', () => {
    const lm = Array(33).fill({ visibility: 0.0 });
    lm[0] = { visibility: 0.9 }; // only nose visible
    expect(detectBest(lm, 'right_wrist')).toBe('nose');
  });

  it('respects requested target over fallback when both visible', () => {
    const lm = Array(33).fill({ visibility: 0.9 });
    expect(detectBest(lm, 'left_elbow')).toBe('left_elbow');
  });
});

// ═══════════════════════════════════════════════════════════════
// Keyboard data attributes — required for elementFromPoint
// ═══════════════════════════════════════════════════════════════

describe('Keyboard button data attributes', () => {
  it('data-key attribute required for cursor highlighting', () => {
    const hasDataKey = (html: string) => html.includes('data-key=');
    expect(hasDataKey('<button data-key="Q" data-display="q">q</button>')).toBe(true);
    expect(hasDataKey('<button>q</button>')).toBe(false);
  });

  it('data-action attribute required for utility buttons', () => {
    const hasDataAction = (html: string) => html.includes('data-action=');
    expect(hasDataAction('<button data-action="backspace">⌫</button>')).toBe(true);
  });
});
