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
    // Past the whole one-second delay: the paid request still never starts.
    await new Promise(resolve => setTimeout(resolve, 1_100));
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

  // The portal answers a word that failed recently with a final "no picture
  // for now" (404, generation:false) on the drawing request or a poll too, not
  // only on the cache probe. Each answer must keep the word off the paid path
  // for GENERATION_OFF_MISS_TTL_MS, not for the 30-second plain-miss time.
  const v3Miss = () => new Response('', { status: 404, headers: { 'X-AAC-Picture-Version': '3' } });
  const finalMiss = () => new Response(JSON.stringify({ styleVersion: 3, generation: false, retryAt: Date.now() + 259_200_000 }), {
    status: 404, headers: { 'Content-Type': 'application/json', 'X-AAC-Picture-Version': '3', 'X-AAC-Picture-Generation': 'off' },
  });
  it.each([
    ['the drawing request', (url: string, calls: number) => url.includes('cacheOnly=1') ? v3Miss() : finalMiss()],
    ['a poll after pending', (_url: string, calls: number) => calls === 1 ? v3Miss()
      : calls === 2 ? Response.json({ pollToken: 'final-miss-poll-fixture' }, { status: 202 }) : finalMiss()],
  ])('remembers a final miss from %s for the long time, so the word is not asked (or paid for) again', async (_label, answer) => {
    let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now);
    let calls = 0;
    const fetcher = vi.fn(async (url: string) => answer(String(url), ++calls)); vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('final-miss-fixture', 'ro', 'symbols-ai')).toBeNull();
    const asked = fetcher.mock.calls.length;
    now += 31_000; // past the plain-miss time, well inside the final-miss time
    expect(await getPictogramUrl('final-miss-fixture', 'ro', 'symbols-ai')).toBeNull();
    expect(fetcher, 'a remembered final miss must not reach the portal again').toHaveBeenCalledTimes(asked);
    now += 30 * 60_000; // and once that time passes, the word is asked again
    await getPictogramUrl('final-miss-fixture', 'ro', 'symbols-ai');
    expect(fetcher.mock.calls.length).toBeGreaterThan(asked);
  });

  it('remembers a plain miss from the drawing request only briefly', async () => {
    let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now);
    const fetcher = vi.fn(async (url: string) => url.includes('cacheOnly=1') ? v3Miss() : Response.json({ error: 'pictogram unavailable' }, { status: 422 }));
    vi.stubGlobal('fetch', fetcher);
    const { getPictogramUrl } = await import('@/services/pictogramService');
    expect(await getPictogramUrl('plain-miss-fixture', 'ro', 'symbols-ai')).toBeNull();
    const asked = fetcher.mock.calls.length;
    now += 31_000;
    await getPictogramUrl('plain-miss-fixture', 'ro', 'symbols-ai');
    expect(fetcher.mock.calls.length).toBeGreaterThan(asked);
  });

  it('waits a full second of the word staying on screen before any paid drawing is asked for', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { PictogramQueue } = await import('@/services/pictogramQueue');
      const queue = new PictogramQueue();
      const draw = vi.fn(async () => 'drawn');
      const job = queue.enqueue(draw, () => true);
      await vi.advanceTimersByTimeAsync(999);
      expect(draw, 'no drawing before one second').not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(draw).toHaveBeenCalledOnce();
      expect(await job.promise).toBe('drawn');
      // A word that left the screen during that second is never drawn, even long after.
      const gone = vi.fn(async () => 'drawn');
      const cancelled = queue.enqueue(gone, () => true);
      await vi.advanceTimersByTimeAsync(500);
      expect(cancelled.cancel()).toBe(true);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(gone).not.toHaveBeenCalled();
      expect(await cancelled.promise).toBeNull();
      // Nor is a word no tile wants any more when the second ends.
      const unwanted = vi.fn(async () => 'drawn');
      const left = queue.enqueue(unwanted, () => false);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(unwanted).not.toHaveBeenCalled();
      expect(await left.promise).toBeNull();
    } finally { vi.useRealTimers(); }
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
