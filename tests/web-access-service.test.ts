import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWebAccess } from '@/services/webAccessService';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('server-owned web preview response', () => {
  it.each([600_000, 60_000, 15_000])('accepts a server deadline with %i ms remaining', async remainingMs => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'preview', remainingMs })));
    const result = await fetchWebAccess();
    expect(result.state).toBe('preview');
    expect(result.remainingMs).toBeGreaterThan(remainingMs - 1_000);
    expect(result.remainingMs).toBeLessThanOrEqual(remainingMs);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/prism-aac/access'), expect.objectContaining({ credentials: 'include', cache: 'no-store' }));
  });
  it.each([600_001, -1, '600000', null])('rejects an invalid or excessive preview: %j', async remainingMs => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'preview', remainingMs })));
    await expect(fetchWebAccess()).rejects.toThrow();
  });
  it('deducts response latency instead of extending the deadline', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(250);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'preview', remainingMs: 600_000 })));
    expect((await fetchWebAccess()).remainingMs).toBe(599_850);
  });
  it('does not turn a server failure into a new preview', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchWebAccess()).rejects.toThrow();
  });
});
