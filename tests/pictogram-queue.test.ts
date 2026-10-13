import { afterEach, describe, expect, it, vi } from 'vitest';
import { PictogramQueue, PICTURE_DEBOUNCE_MS, MAX_CONCURRENT_PICTURES } from '@/services/pictogramQueue';

afterEach(() => vi.useRealTimers());
describe('missing-picture scheduling', () => {
  it('lets a complete prediction row start concurrently after the brief debounce', async () => {
    vi.useFakeTimers();
    const queue = new PictogramQueue();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const run = vi.fn(async () => { await gate; return 'picture'; });
    const jobs = Array.from({ length: 6 }, () => queue.enqueue(run, () => true));
    await vi.advanceTimersByTimeAsync(PICTURE_DEBOUNCE_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(MAX_CONCURRENT_PICTURES);
    release();
    await Promise.all(jobs.map(job => job.promise));
    expect(run).toHaveBeenCalledTimes(6);
  });

  it('discards a word that leaves the row before its provider call starts', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => 'obsolete picture');
    const job = new PictogramQueue().enqueue(run, () => true);
    job.cancel();
    await vi.advanceTimersByTimeAsync(PICTURE_DEBOUNCE_MS);
    expect(await job.promise).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('drops obsolete work waiting behind a full row but retains already started work', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queue = new PictogramQueue();
    const running = Array.from({ length: 5 }, () => queue.enqueue(async () => { await gate; return 'cached'; }, () => true));
    const obsolete = vi.fn(async () => 'obsolete');
    const queued = queue.enqueue(obsolete, () => true);
    await vi.advanceTimersByTimeAsync(PICTURE_DEBOUNCE_MS);
    running[0].cancel();
    queued.cancel();
    release();
    expect(await running[0].promise).toBe('cached');
    expect(await queued.promise).toBeNull();
    await Promise.all(running.map(job => job.promise));
    expect(obsolete).not.toHaveBeenCalled();
  });

  it('frees a slot after provider failure so another current word can load', async () => {
    vi.useFakeTimers();
    const queue = new PictogramQueue();
    const failed = queue.enqueue(async () => { throw new Error('provider unavailable'); }, () => true);
    const assertion = expect(failed.promise).rejects.toThrow('provider unavailable');
    const next = queue.enqueue(async () => 'next picture', () => true);
    await vi.advanceTimersByTimeAsync(PICTURE_DEBOUNCE_MS);
    await assertion;
    expect(await next.promise).toBe('next picture');
  });
});
