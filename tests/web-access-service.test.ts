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

describe('paid-plan entitlement in the access response', () => {
  const reply = (entitlement: unknown) => vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, entitlement })));
  it('passes a well-formed entitlement through', async () => {
    const entitlement = { state: 'grace', accessUntil: '2026-12-10T00:00:00.000Z', policyVersion: '2026-10-27-v1' };
    reply(entitlement);
    expect((await fetchWebAccess()).entitlement).toEqual(entitlement);
  });
  it('omits it when the server sends none (policy off)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0 })));
    expect(await fetchWebAccess()).toEqual({ state: 'signed_in', remainingMs: 0 });
  });
  it.each([
    ['an unknown state', { state: 'free_forever', accessUntil: null, policyVersion: 'v' }],
    ['an unreadable date', { state: 'grace', accessUntil: 'soon', policyVersion: 'v' }],
    ['a missing policy version', { state: 'paid', accessUntil: null }],
    ['a non-object', 'paid'],
  ])('ignores %s instead of trusting it', async (_name, entitlement) => {
    reply(entitlement);
    const result = await fetchWebAccess();
    expect(result.state).toBe('signed_in');
    expect(result.entitlement).toBeUndefined();
  });
});

describe('one access request at a time', () => {
  it('same-tick callers share one request and its answer', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0 })));
    const [a, b] = await Promise.all([fetchWebAccess(), fetchWebAccess()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    await fetchWebAccess();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('paid-plan policy flag and lease in the access response', () => {
  it('passes paidPlan and a well-formed lease through', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, paidPlan: true,
      entitlement: { state: 'paid', accessUntil: null, policyVersion: 'v' }, lease: 'aGVhZA.cGF5bG9hZA.c2ln' })));
    expect(await fetchWebAccess()).toMatchObject({ paidPlan: true, lease: 'aGVhZA.cGF5bG9hZA.c2ln' });
  });
  it('tells the copy whether the paid-only policy is in force', async () => {
    const { usePaidPlanStore } = await import('@/store/paidPlanStore');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, paidPlan: true })));
    await fetchWebAccess();
    expect(usePaidPlanStore.getState().active).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0 })));
    await fetchWebAccess();
    expect(usePaidPlanStore.getState().active).toBe(false);
  });
  it('flags an entitlement it cannot read, rather than dropping it silently', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, paidPlan: true,
      entitlement: { state: 'comped', accessUntil: null, policyVersion: 'v' } })));
    expect(await fetchWebAccess()).toMatchObject({ paidPlan: true, entitlementUnreadable: true });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, paidPlan: true })));
    expect((await fetchWebAccess()).entitlementUnreadable).toBeUndefined();
  });
  it('a fresh request never reuses one that started before it', async () => {
    let release!: (r: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(r => { release = r; }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, paidPlan: true,
      entitlement: { state: 'paid', accessUntil: null, policyVersion: 'v' } })));
    const stale = fetchWebAccess();
    const fresh = fetchWebAccess({ fresh: true });
    release(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, paidPlan: true,
      entitlement: { state: 'expired', accessUntil: null, policyVersion: 'v' } })));
    expect((await stale).entitlement?.state).toBe('expired');
    expect((await fresh).entitlement?.state).toBe('paid');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('drops a malformed lease and any lease without an entitlement', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0,
      entitlement: { state: 'paid', accessUntil: null, policyVersion: 'v' }, lease: 'not a lease' })));
    expect((await fetchWebAccess()).lease).toBeUndefined();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ state: 'signed_in', remainingMs: 0, lease: 'a.b.c' })));
    expect((await fetchWebAccess()).lease).toBeUndefined();
  });
});
