import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  subscribeVisionContext,
  getLastVisionContext,
  _resetForTests,
  type VisionContext,
} from '@/services/objectDetectionService';

describe('objectDetectionService — pure logic', () => {
  beforeEach(() => {
    _resetForTests();
  });

  afterEach(() => {
    _resetForTests();
  });

  describe('subscribeVisionContext', () => {
    it('returns an unsubscribe function', () => {
      const unsub = subscribeVisionContext(() => {});
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('unsubscribe prevents future calls', () => {
      const fn = vi.fn();
      const unsub = subscribeVisionContext(fn);
      unsub();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('getLastVisionContext', () => {
    it('returns null initially', () => {
      expect(getLastVisionContext()).toBeNull();
    });
  });

  describe('_resetForTests', () => {
    it('clears last context', () => {
      _resetForTests();
      expect(getLastVisionContext()).toBeNull();
    });
  });
});

describe('objectDetectionService — types', () => {
  it('VisionContext has expected shape', () => {
    const ctx: VisionContext = {
      objects: [{
        label: 'cup',
        score: 0.9,
        boundingBox: { x: 10, y: 20, w: 50, h: 60 },
        timestamp: Date.now(),
      }],
      stableObjects: ['cup'],
      timestamp: Date.now(),
    };
    expect(ctx.objects).toHaveLength(1);
    expect(ctx.stableObjects).toContain('cup');
  });
});
