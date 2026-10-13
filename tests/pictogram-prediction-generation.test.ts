import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const picture = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });
beforeEach(() => {
  vi.resetModules();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:generated-fixture') });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('cache-first generated predictions', () => {
  it('recognizes cache misses and quota cooldowns even when CORS hides custom headers', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ styleVersion: 3, error: 'Picture not cached' }, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ retryAfter: 60 }, { status: 429 }))
      .mockResolvedValueOnce(picture());
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('cors-protocol-fixture', 'en', 'symbols-ai')).rejects.toMatchObject({ retryAfterMs: 60_000 });
    expect(String(fetcher.mock.calls[1][0])).toContain('/pictogram/v3');
    expect(await getPictogramUrl('cors-protocol-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
  });

  it('never reaches legacy generation when the matching backend is not deployed yet', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl, PicturePendingError } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('old-backend-fixture', 'en', 'symbols-ai')).rejects.toBeInstanceOf(PicturePendingError);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('/pictogram/v3?cacheOnly=1');
  });

  it('recovers after a temporary quota response without negative-caching the concept', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '60' } })).mockResolvedValueOnce(picture());
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl, PicturePendingError } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('quota-recovery-fixture', 'en', 'symbols-ai')).rejects.toMatchObject({ retryAfterMs: 60_000 });
    expect(await getPictogramUrl('quota-recovery-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('returns a cloud cache hit without starting generation or waiting for the debounce', async () => {
    const fetcher = vi.fn(async (_url: string) => picture()); vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('cloud-hit-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('cacheOnly=1');
  });

  it('cancels obsolete cache misses without suppressing another consumer of the same word', async () => {
    const fetcher = vi.fn(async (url: string) => url.includes('cacheOnly=1') ? new Response('', { status: 404, headers: { 'X-AAC-Picture-Version': '3' } }) : picture());
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const left = new AbortController();
    const first = getPictogramUrl('shared-consumer-fixture', 'en', 'symbols-ai', undefined, { signal: left.signal });
    const second = getPictogramUrl('shared-consumer-fixture', 'en', 'symbols-ai');
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    left.abort();
    expect(await first).toBeNull();
    expect(await second).toBe('blob:generated-fixture');
    expect(fetcher.mock.calls.filter(([url]) => !url.includes('cacheOnly=1'))).toHaveLength(1);
  });

  it('never submits the paid job when all observers leave during the debounce', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 404, headers: { 'X-AAC-Picture-Version': '3' } })); vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const controller = new AbortController();
    const request = getPictogramUrl('obsolete-consumer-fixture', 'en', 'symbols-ai', undefined, { signal: controller.signal });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    controller.abort();
    expect(await request).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps qualified meanings distinct rather than collapsing their longest word', async () => {
    const fetcher = vi.fn(async () => picture()); vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    await getPictogramUrl('computer mouse', 'en', 'symbols-ai');
    await getPictogramUrl('computer monitor', 'en', 'symbols-ai');
    await getPictogramUrl('garden chair', 'en', 'symbols-ai');
    await getPictogramUrl('garden hose', 'en', 'symbols-ai');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('can request a concept again immediately after its previous queued observation was discarded', async () => {
    const fetcher = vi.fn(async (url: string) => url.includes('cacheOnly=1') ? new Response('', { status: 404, headers: { 'X-AAC-Picture-Version': '3' } }) : picture());
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    const controller = new AbortController();
    const previous = getPictogramUrl('returning-prediction-fixture', 'en', 'symbols-ai', undefined, { signal: controller.signal });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    controller.abort();
    const renewed = getPictogramUrl('returning-prediction-fixture', 'en', 'symbols-ai');
    expect(await previous).toBeNull();
    expect(await renewed).toBe('blob:generated-fixture');
    expect(fetcher.mock.calls.filter(([url]) => !url.includes('cacheOnly=1'))).toHaveLength(1);
  });

  it('waits for another server job by probing the shared cache, without another generation call', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ pollToken: 'opaque-fixture-token' }, { status: 202 })).mockResolvedValueOnce(picture());
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('pending-other-user-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
    expect(fetcher.mock.calls.every(([url]) => String(url).includes('cacheOnly=1'))).toBe(true);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).pollToken).toBe('opaque-fixture-token');
  });

  it('does not negative-cache a pending timeout when the shared image becomes ready afterward', async () => {
    let now = Date.now(); let ready = false; let probes = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const fetcher = vi.fn(async () => {
      if (ready) return picture();
      if (++probes > 1) now += 35_001;
      return Response.json({ pollToken: 'pending-timeout-fixture' }, { status: 202 });
    });
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl, PicturePendingError } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('recover-pending-timeout-fixture', 'en', 'symbols-ai')).rejects.toBeInstanceOf(PicturePendingError);
    ready = true;
    expect(await getPictogramUrl('recover-pending-timeout-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('keeps a transport failure after pending retryable rather than hiding a ready shared image', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ pollToken: 'network-retry-fixture' }, { status: 202 }))
      .mockRejectedValueOnce(new TypeError('fixture network interruption')).mockResolvedValueOnce(picture());
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl, PicturePendingError } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('pending-network-recovery-fixture', 'en', 'symbols-ai')).rejects.toBeInstanceOf(PicturePendingError);
    expect(await getPictogramUrl('pending-network-recovery-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('allows a generation within the server deadline to finish instead of timing out at ten seconds', async () => {
    // Scale both request deadlines and the 15-second provider delay by 1000.
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('fixture timeout', 'TimeoutError')), ms / 1000);
      return controller.signal;
    });
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('cacheOnly=1')) return Promise.resolve(new Response('', { status: 404, headers: { 'X-AAC-Picture-Version': '3' } }));
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        setTimeout(() => resolve(picture()), 15);
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('within-provider-deadline-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries immediately after an initial cache-probe transport failure without poisoning the cache', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('initial fixture network interruption')).mockResolvedValueOnce(picture());
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl, PicturePendingError } = await import('@/services/pictogramService');
    await expect(getPictogramUrl('initial-network-recovery-fixture', 'en', 'symbols-ai')).rejects.toBeInstanceOf(PicturePendingError);
    expect(await getPictogramUrl('initial-network-recovery-fixture', 'en', 'symbols-ai')).toBe('blob:generated-fixture');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
