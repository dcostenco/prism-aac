import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TRANSPORT_IMAGE } from './fixtures/transport-image';

const RECOVERY_DELAY_MS = 120_000;
const FIXTURE_WORD = 'fixtureflower';
const FIXTURE_IMAGE = TRANSPORT_IMAGE;
const HEALTHY_BLOB_URL = 'blob:healthy-picture-fixture';
const TURKISH_BLOCKED_FORMS = ['SİKTİR', 'İBNE'] as const;

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('a transient backend failure expires so a later explicit request can obtain its picture', async () => {
 vi.spyOn(console, 'warn').mockImplementation(() => {});
 Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => HEALTHY_BLOB_URL) });
 const fetch = vi.fn()
  .mockResolvedValueOnce(new Response('', { status: 503 }))
  .mockResolvedValueOnce(new Response(new Uint8Array(FIXTURE_IMAGE).buffer, { status: 200, headers: { 'Content-Type': 'image/png' } }));
 vi.stubGlobal('fetch', fetch);
 const { getPictogramUrl } = await import('@/services/pictogramService');
 expect(await getPictogramUrl(FIXTURE_WORD, 'en', 'symbols-ai')).toBeNull();
 expect(fetch).toHaveBeenCalledOnce();
 const later = Date.now() + RECOVERY_DELAY_MS;
 vi.spyOn(Date, 'now').mockReturnValue(later);
 const recovered = await getPictogramUrl(FIXTURE_WORD, 'en', 'symbols-ai');
 expect(fetch).toHaveBeenCalledTimes(2);
 expect(recovered).toBe(HEALTHY_BLOB_URL);
});

it.each(TURKISH_BLOCKED_FORMS)('Turkish %s never reaches generation through an English source', async text => {
 const fetch = vi.fn();
 vi.stubGlobal('fetch', fetch);
 const { getPictogramUrl } = await import('@/services/pictogramService');
 expect(await getPictogramUrl('house', 'en', 'symbols-ai', { text, lang: 'tr' })).toBeNull();
 expect(fetch).not.toHaveBeenCalled();
});
