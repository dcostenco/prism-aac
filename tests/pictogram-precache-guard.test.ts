/**
 * pictogramService::precacheAllPictograms — guard paths
 *
 * Two guard paths are testable without network:
 *   1. mode='off' → returns immediately (no fetch, no import)
 *   2. _precacheDone flag → once set, second call is a no-op
 *
 * The real fetch path requires network + service worker cache — not tested here.
 */
import { describe, it, expect } from 'vitest';
import { precacheAllPictograms } from '@/services/pictogramService';

describe('precacheAllPictograms', () => {
  it('resolves immediately when mode is "off"', async () => {
    await expect(precacheAllPictograms('en', 'off')).resolves.toBeUndefined();
  });

  it('does not throw for mode="off"', async () => {
    await expect(precacheAllPictograms('en', 'off')).resolves.not.toThrow();
  });

  it('calling with mode="off" multiple times does not throw', async () => {
    await precacheAllPictograms('en', 'off');
    await precacheAllPictograms('en', 'off');
    await precacheAllPictograms('ro', 'off');
  });

  it('returns undefined (void) for mode="off"', async () => {
    const result = await precacheAllPictograms('en', 'off');
    expect(result).toBeUndefined();
  });
});
