/**
 * portalFetch — single fetch wrapper that owns base URL, timeout,
 * cookie inclusion, JSON parsing, and offline short-circuit. Tests
 * the contract every consumer relies on.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { portalFetch } from '@/services/portalClient';

const fetchMock = vi.fn();
beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('portalFetch — happy path', () => {
  it('parses JSON and returns ok=true with status', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ x: 1 }), { status: 200 }));
    const res = await portalFetch<{ x: number }>({ path: '/test' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ x: 1 });
      expect(res.status).toBe(200);
    }
  });

  it('handles 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await portalFetch({ path: '/test' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe(204);
  });

  it('always sends credentials: include', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    await portalFetch({ path: '/test' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
  });

  it('serializes body as JSON for POST', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    await portalFetch({ path: '/test', method: 'POST', body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ a: 1 });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});

describe('portalFetch — request body validation', () => {
  it('returns invalid_request_body on circular JSON without throwing', async () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    const res = await portalFetch({ path: '/test', method: 'POST', body: circular });
    expect(res).toEqual({ ok: false, error: 'invalid_request_body' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns invalid_request_body on BigInt body without throwing', async () => {
    // BigInt() ctor avoids the literal `n` syntax that requires ES2020.
    const res = await portalFetch({ path: '/test', method: 'POST', body: { n: BigInt('9007199254740993') } });
    expect(res).toEqual({ ok: false, error: 'invalid_request_body' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('portalFetch — error mapping', () => {
  it('returns short, sanitized error on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('something\x00broke', { status: 500 }));
    const res = await portalFetch({ path: '/test' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/^HTTP 500/);
      expect(res.error).not.toContain('\x00');
      expect(res.error.length).toBeLessThanOrEqual(80 + 'HTTP 500: '.length);
    }
  });

  it('returns ok=false with "timeout" on AbortSignal timeout', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
    const res = await portalFetch({ path: '/test' });
    expect(res).toEqual({ ok: false, error: 'timeout' });
  });

  it('combines caller cancellation with the portal deadline', async () => {
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => (
      new Promise((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener('abort', () => {
          reject(new DOMException('cancelled', 'AbortError'));
        }, { once: true });
      })
    ));
    const controller = new AbortController();

    const pending = portalFetch({
      path: '/test',
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();

    await expect(pending).resolves.toEqual({ ok: false, error: 'aborted' });
  });

  it('returns ok=false with "invalid_json" when body is not valid JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>not json</html>', {
      status: 200, headers: { 'Content-Type': 'text/html' },
    }));
    const res = await portalFetch({ path: '/test' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid_json');
  });

  it('returns ok=false with "network error" when fetch rejects unexpectedly', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'));
    const res = await portalFetch({ path: '/test' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('connection refused');
  });
});

describe('portalFetch — response size cap', () => {
  it('returns payload_too_large when Content-Length exceeds 1 MB', async () => {
    const big = new Response('x', {
      status: 200,
      headers: { 'Content-Length': String(2 * 1024 * 1024) },
    });
    fetchMock.mockResolvedValueOnce(big);
    const res = await portalFetch({ path: '/test' });
    expect(res).toEqual({ ok: false, error: 'payload_too_large', status: 200 });
  });

  it('returns payload_too_large when streaming body exceeds the cap (no Content-Length)', async () => {
    // Build a Response with a streaming body bigger than 1MB but with no
    // Content-Length header, so we hit the chunk-by-chunk reader path.
    const huge = 'A'.repeat(1024 * 1024 + 1024); // ~1 MB + 1 KB
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(huge));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200 }));
    const res = await portalFetch({ path: '/test' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('payload_too_large');
  });
});

describe('portalFetch — offline short-circuit', () => {
  const origDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  afterEach(() => {
    if (origDescriptor) Object.defineProperty(navigator, 'onLine', origDescriptor);
  });

  it('skips the round trip when navigator.onLine === false (default)', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const res = await portalFetch({ path: '/test' });
    expect(res).toEqual({ ok: false, error: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hits the network anyway when skipIfOffline is false', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    const res = await portalFetch({ path: '/test', skipIfOffline: false });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });
});
