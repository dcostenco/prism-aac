/**
 * emergencyService::flushQueuedAlerts — empty-queue guard path
 *
 * When the alert queue is empty (localStorage has no prism_queued_alerts),
 * flushQueuedAlerts resolves immediately to 0 without making any network
 * calls. This is the only path testable without mocking the Synalux API.
 *
 * The mutex (isFlushing) guard is also exercised: concurrent calls must
 * both resolve without throwing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { flushQueuedAlerts } from '@/services/emergencyService';

beforeEach(() => {
  // Ensure clean queue state
  localStorage.removeItem('prism_queued_alerts');
});

describe('flushQueuedAlerts', () => {
  it('resolves to 0 when queue is empty', async () => {
    const result = await flushQueuedAlerts();
    expect(result).toBe(0);
  });

  it('does not throw when queue is empty', async () => {
    await expect(flushQueuedAlerts()).resolves.not.toThrow();
  });

  it('second concurrent call returns 0 immediately (mutex guard)', async () => {
    // Fire two concurrent flushes — the second should hit isFlushing=true
    // and return 0 without waiting for the first
    const [r1, r2] = await Promise.all([flushQueuedAlerts(), flushQueuedAlerts()]);
    expect(r1).toBe(0);
    expect(r2).toBe(0);
  });

  it('is callable repeatedly without throwing', async () => {
    await flushQueuedAlerts();
    await flushQueuedAlerts();
    await flushQueuedAlerts();
  });

  it('resolves to a number', async () => {
    const result = await flushQueuedAlerts();
    expect(typeof result).toBe('number');
  });
});
