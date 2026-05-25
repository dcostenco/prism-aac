/**
 * contactsIntegrationService::stopContactsSync
 * integrationsService::broadcastIntegrationEvent
 *
 * stopContactsSync: clears the sync interval — must not throw in cold state.
 * broadcastIntegrationEvent: posts to BroadcastChannel — must not throw when
 *   BroadcastChannel is unavailable (jsdom does not implement it).
 */
import { describe, it, expect } from 'vitest';
import { stopContactsSync } from '@/services/contactsIntegrationService';
import { broadcastIntegrationEvent } from '@/services/integrationsService';

// ── stopContactsSync ──────────────────────────────────────────────────────────

describe('stopContactsSync', () => {
  it('does not throw when sync was never started', () => {
    expect(() => stopContactsSync()).not.toThrow();
  });

  it('is idempotent — calling multiple times does not throw', () => {
    expect(() => {
      stopContactsSync();
      stopContactsSync();
      stopContactsSync();
    }).not.toThrow();
  });

  it('returns undefined', () => {
    expect(stopContactsSync()).toBeUndefined();
  });
});

// ── broadcastIntegrationEvent ─────────────────────────────────────────────────

describe('broadcastIntegrationEvent', () => {
  it('does not throw when BroadcastChannel is unavailable (jsdom)', () => {
    // jsdom may not implement BroadcastChannel; broadcastIntegrationEvent
    // checks bc() and returns early if null — must never throw.
    expect(() => broadcastIntegrationEvent({
      type: 'provider-connected',
      provider: 'google',
      at: Date.now(),
    })).not.toThrow();
  });

  it('does not throw for provider-disconnected event', () => {
    expect(() => broadcastIntegrationEvent({
      type: 'provider-disconnected',
      provider: 'microsoft',
      at: Date.now(),
    })).not.toThrow();
  });

  it('does not throw for provider-refreshed event', () => {
    expect(() => broadcastIntegrationEvent({
      type: 'provider-refreshed',
      provider: 'google',
      scope: 'contacts',
      at: Date.now(),
    })).not.toThrow();
  });

  it('returns undefined', () => {
    expect(broadcastIntegrationEvent({
      type: 'provider-connected',
      provider: 'test',
      at: Date.now(),
    })).toBeUndefined();
  });
});
