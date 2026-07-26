import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  anonymousDatadogUserId,
  DATADOG_RUM_PRIVACY_OPTIONS,
} from '@/lib/datadog';

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
});

describe('Datadog AAC privacy boundary', () => {
  it('keeps performance telemetry without replay or automatic click capture', () => {
    expect(DATADOG_RUM_PRIVACY_OPTIONS).toEqual({
      sessionReplaySampleRate: 0,
      trackUserInteractions: false,
      defaultPrivacyLevel: 'mask',
    });
  });

  it('uses a stable one-way pseudonym instead of an email prefix', async () => {
    const first = await anonymousDatadogUserId('Person@example.com');
    const second = await anonymousDatadogUserId(' person@example.com ');

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{24}$/);
    expect(first).not.toContain('Person');
    expect(first).not.toContain('example');
  });
});
