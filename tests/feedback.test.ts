import { describe, it, expect, vi } from 'vitest';
import { hapticTap, hapticHeavy, tapFeedback, keyFeedback, deleteFeedback } from '@/services/feedback';

describe('Feedback — Haptic', () => {
  it('hapticTap calls navigator.vibrate(10)', () => {
    hapticTap();
    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('hapticHeavy calls navigator.vibrate(25)', () => {
    hapticHeavy();
    expect(navigator.vibrate).toHaveBeenCalledWith(25);
  });
});

describe('Feedback — Audio', () => {
  it('tapFeedback creates audio context and vibrates', () => {
    tapFeedback();
    expect(navigator.vibrate).toHaveBeenCalled();
    expect(AudioContext).toHaveBeenCalled();
  });

  it('keyFeedback creates audio context', () => {
    keyFeedback();
    expect(AudioContext).toHaveBeenCalled();
  });

  it('deleteFeedback uses heavy haptic', () => {
    deleteFeedback();
    expect(navigator.vibrate).toHaveBeenCalledWith(25);
  });
});

describe('Feedback — Gap tests', () => {
  it('does not crash if vibrate is unavailable', () => {
    const orig = navigator.vibrate;
    Object.defineProperty(navigator, 'vibrate', { value: undefined, writable: true });
    expect(() => hapticTap()).not.toThrow();
    Object.defineProperty(navigator, 'vibrate', { value: orig, writable: true });
  });
});
