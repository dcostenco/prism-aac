/**
 * adaptiveEngine — subscribe() + cleanupAdaptiveListeners()
 *
 * subscribe() is a critical cross-system integration point: the portalSync
 * and UI refresh paths both attach listeners to be notified when the
 * adaptive profile changes. cleanupAdaptiveListeners() is called on logout
 * and app teardown to prevent memory leaks and listener accumulation.
 *
 * Neither was tested in adaptive-engine.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribe,
  cleanupAdaptiveListeners,
  resetProfile,
  recordTone,
  recordDwell,
  recordMessage,
} from '@/services/adaptiveEngine';

beforeEach(() => {
  resetProfile();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

// ── subscribe() ───────────────────────────────────────────────────────────────

describe('adaptiveEngine — subscribe()', () => {
  it('registered listener is called when profile changes (recordTone)', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    try {
      recordTone('hello', 'friendly');
      expect(listener).toHaveBeenCalled();
    } finally {
      unsub();
    }
  });

  it('registered listener is called when dwell changes', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    try {
      recordDwell(350);
      expect(listener).toHaveBeenCalled();
    } finally {
      unsub();
    }
  });

  it('registered listener is called when message is recorded', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    try {
      recordMessage('I want water');
      expect(listener).toHaveBeenCalled();
    } finally {
      unsub();
    }
  });

  it('unsub() removes the listener — no longer called after unsubscribe', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    unsub();
    recordTone('help me', 'serious');
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsub() is idempotent — calling twice does not throw', () => {
    const unsub = subscribe(vi.fn());
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  it('multiple subscribers all receive the notification', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const ua = subscribe(a);
    const ub = subscribe(b);
    const uc = subscribe(c);
    try {
      recordTone('fun day', 'excited');
      expect(a).toHaveBeenCalled();
      expect(b).toHaveBeenCalled();
      expect(c).toHaveBeenCalled();
    } finally {
      ua(); ub(); uc();
    }
  });

  it('removing one subscriber does not affect others', () => {
    const a = vi.fn();
    const b = vi.fn();
    const ua = subscribe(a);
    const ub = subscribe(b);
    ua(); // remove a
    try {
      recordTone('tired', 'empathetic');
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalled();
    } finally {
      ub();
    }
  });

  it('subscribe() returns a callable function (unsubscribe)', () => {
    const unsub = subscribe(vi.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('listener is called on resetProfile()', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    try {
      resetProfile();
      expect(listener).toHaveBeenCalled();
    } finally {
      unsub();
    }
  });
});

// ── cleanupAdaptiveListeners() ────────────────────────────────────────────────

describe('adaptiveEngine — cleanupAdaptiveListeners()', () => {
  it('does not throw when called once', () => {
    expect(() => cleanupAdaptiveListeners()).not.toThrow();
  });

  it('is idempotent — multiple calls do not throw', () => {
    expect(() => {
      cleanupAdaptiveListeners();
      cleanupAdaptiveListeners();
      cleanupAdaptiveListeners();
    }).not.toThrow();
  });

  it('does not affect the subscribe/notify pipeline', () => {
    // cleanup removes DOM event listeners (pagehide/visibilitychange),
    // but profile-change subscriptions are an independent Set.
    cleanupAdaptiveListeners();
    const listener = vi.fn();
    const unsub = subscribe(listener);
    try {
      recordDwell(400);
      expect(listener).toHaveBeenCalled();
    } finally {
      unsub();
    }
  });
});
