/**
 * emergencyStore — phase, countdown, setActive, setPhase, reset
 *
 * Life-safety: this store drives the emergency countdown overlay and
 * dispatching flow. A broken reset() or wrong initial countdown could
 * leave the overlay stuck or skip the cancel window entirely.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEmergencyStore } from '@/store/emergencyStore';

beforeEach(() => {
  useEmergencyStore.getState().reset();
});

// ── initial state ──────────────────────────────────────────────────────────────

describe('emergencyStore — initial state', () => {
  it('phase is idle', () => {
    expect(useEmergencyStore.getState().phase).toBe('idle');
  });

  it('phrase is empty string', () => {
    expect(useEmergencyStore.getState().phrase).toBe('');
  });

  it('severity is standard', () => {
    expect(useEmergencyStore.getState().severity).toBe('standard');
  });

  it('countdown is 10 seconds', () => {
    expect(useEmergencyStore.getState().countdown).toBe(10);
  });

  it('cancelFn is null', () => {
    expect(useEmergencyStore.getState().cancelFn).toBeNull();
  });
});

// ── setActive ─────────────────────────────────────────────────────────────────

describe('emergencyStore — setActive', () => {
  it('sets phase to countdown', () => {
    const cancelFn = () => {};
    useEmergencyStore.getState().setActive('Help me', 'medical', cancelFn);
    expect(useEmergencyStore.getState().phase).toBe('countdown');
  });

  it('stores the phrase', () => {
    useEmergencyStore.getState().setActive('I need help', 'urgent', () => {});
    expect(useEmergencyStore.getState().phrase).toBe('I need help');
  });

  it('stores the severity', () => {
    useEmergencyStore.getState().setActive('Alert', 'critical', () => {});
    expect(useEmergencyStore.getState().severity).toBe('critical');
  });

  it('stores the cancelFn', () => {
    const cancelFn = () => {};
    useEmergencyStore.getState().setActive('SOS', 'standard', cancelFn);
    expect(useEmergencyStore.getState().cancelFn).toBe(cancelFn);
  });
});

// ── setCountdown ──────────────────────────────────────────────────────────────

describe('emergencyStore — setCountdown', () => {
  it('updates countdown to given value', () => {
    useEmergencyStore.getState().setCountdown(5);
    expect(useEmergencyStore.getState().countdown).toBe(5);
  });

  it('countdown can be set to 0', () => {
    useEmergencyStore.getState().setCountdown(0);
    expect(useEmergencyStore.getState().countdown).toBe(0);
  });
});

// ── setPhase ──────────────────────────────────────────────────────────────────

describe('emergencyStore — setPhase', () => {
  it('transitions to dispatching', () => {
    useEmergencyStore.getState().setPhase('dispatching');
    expect(useEmergencyStore.getState().phase).toBe('dispatching');
  });

  it('transitions to dispatched', () => {
    useEmergencyStore.getState().setPhase('dispatched');
    expect(useEmergencyStore.getState().phase).toBe('dispatched');
  });

  it('transitions to cancelled', () => {
    useEmergencyStore.getState().setPhase('cancelled');
    expect(useEmergencyStore.getState().phase).toBe('cancelled');
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe('emergencyStore — reset', () => {
  it('restores phase to idle', () => {
    useEmergencyStore.getState().setPhase('dispatched');
    useEmergencyStore.getState().reset();
    expect(useEmergencyStore.getState().phase).toBe('idle');
  });

  it('restores phrase to empty string', () => {
    useEmergencyStore.getState().setActive('Help', 'urgent', () => {});
    useEmergencyStore.getState().reset();
    expect(useEmergencyStore.getState().phrase).toBe('');
  });

  it('restores severity to standard', () => {
    useEmergencyStore.getState().setActive('Help', 'critical', () => {});
    useEmergencyStore.getState().reset();
    expect(useEmergencyStore.getState().severity).toBe('standard');
  });

  it('restores countdown to 10', () => {
    useEmergencyStore.getState().setCountdown(3);
    useEmergencyStore.getState().reset();
    expect(useEmergencyStore.getState().countdown).toBe(10);
  });

  it('sets cancelFn to null', () => {
    useEmergencyStore.getState().setActive('SOS', 'medical', () => {});
    useEmergencyStore.getState().reset();
    expect(useEmergencyStore.getState().cancelFn).toBeNull();
  });
});
