import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _resetForTests, _getActiveScene } from '@/services/visionPredictionBridge';

describe('visionPredictionBridge — module state', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('starts with no active scene', () => {
    expect(_getActiveScene()).toBeNull();
  });

  it('_resetForTests clears state', () => {
    _resetForTests();
    expect(_getActiveScene()).toBeNull();
  });
});
