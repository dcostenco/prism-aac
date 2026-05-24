/**
 * messageStore — cancelActiveEmergency()
 *
 * cancelActiveEmergency is the only exported function from messageStore
 * with zero coverage. It is called from the Emergency Overlay dismiss
 * button and from logout cleanup. The internal activeEmergencyCancel
 * pointer is only set by the async emergencyService trigger path inside
 * sendMessage(), so the only directly testable paths are:
 *   1. Calling when no emergency is active (null state) — must not throw
 *   2. Idempotent — repeated calls do not throw
 *
 * Integration testing (cancel-fn is called, pointer is cleared) would
 * require triggering sendMessage with a real emergency phrase and mocking
 * emergencyService — that heavier path is covered in the emergency-service
 * test suite. These tests guard the null-guard contract only.
 */
import { describe, it, expect } from 'vitest';
import { cancelActiveEmergency } from '@/store/messageStore';

describe('cancelActiveEmergency', () => {
  it('does not throw when no emergency is active', () => {
    expect(() => cancelActiveEmergency()).not.toThrow();
  });

  it('is idempotent — calling multiple times does not throw', () => {
    expect(() => {
      cancelActiveEmergency();
      cancelActiveEmergency();
      cancelActiveEmergency();
    }).not.toThrow();
  });

  it('returns undefined', () => {
    expect(cancelActiveEmergency()).toBeUndefined();
  });
});
