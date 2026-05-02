import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCatalog,
  fetchInstalled,
  installRemote,
  uninstallRemote,
} from '@/lib/marketplace/api';
import { LOCAL_CATALOG } from '@/lib/marketplace/manifests/local';

const VALID_REMOTE = {
  modules: [
    {
      slug: 'remote-only-module',
      version: '2.0.0',
      kind: 'vocab-set',
      tier: 'free',
      category: 'vocab',
      nameKey: 'mp_remote',
      descKey: 'mp_remote_desc',
      icon: '🆕',
      status: 'available',
      handlerPayload: { vocabSetId: 'remote-only' },
    },
  ],
  fetched_at: 1700000000000,
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(impl as typeof fetch);
}

describe('marketplace/api — fetchCatalog (Phase 3)', () => {
  it('returns remote modules when portal responds 200', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify(VALID_REMOTE), { status: 200 }),
    );
    const result = await fetchCatalog();
    expect(result.source).toBe('remote');
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].slug).toBe('remote-only-module');
    expect(result.fetchedAt).toBe(1700000000000);
  });

  it('falls back to LOCAL_CATALOG when portal returns 500', async () => {
    mockFetch(async () => new Response('boom', { status: 500 }));
    const result = await fetchCatalog();
    expect(result.source).toBe('local');
    expect(result.modules.length).toBe(LOCAL_CATALOG.length);
  });

  it('falls back when portal throws (network down)', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));
    const result = await fetchCatalog();
    expect(result.source).toBe('local');
    expect(result.modules.length).toBeGreaterThan(0);
  });

  it('falls back when portal returns malformed JSON', async () => {
    mockFetch(async () => new Response('not json', { status: 200 }));
    const result = await fetchCatalog();
    expect(result.source).toBe('local');
  });

  it('falls back when portal returns empty modules array', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ modules: [] }), { status: 200 }),
    );
    const result = await fetchCatalog();
    expect(result.source).toBe('local');
  });

  it('drops invalid manifests from remote response', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({
          modules: [
            VALID_REMOTE.modules[0],
            { slug: 'bad', kind: 'unknown-kind' }, // schema violation
          ],
          fetched_at: 1,
        }),
        { status: 200 },
      ),
    );
    const result = await fetchCatalog();
    expect(result.source).toBe('remote');
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].slug).toBe('remote-only-module');
  });

  it('aborts on timeout and falls back to local', async () => {
    mockFetch((_url, init) => {
      // Simulate the AbortSignal firing.
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'TimeoutError')));
        setTimeout(() => reject(new DOMException('Timeout', 'TimeoutError')), 10);
      });
    });
    const result = await fetchCatalog();
    expect(result.source).toBe('local');
  });
});

describe('marketplace/api — fetchInstalled', () => {
  it('returns server installs on 200', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({
          installs: [
            { slug: 'vocab-my-core', version: '1.0.0', installedAt: 1700000000000 },
          ],
        }),
        { status: 200 },
      ),
    );
    const installs = await fetchInstalled();
    expect(installs).toHaveLength(1);
    expect(installs[0].slug).toBe('vocab-my-core');
  });

  it('returns [] on 401 (signed out)', async () => {
    mockFetch(async () => new Response('Unauthorized', { status: 401 }));
    const installs = await fetchInstalled();
    expect(installs).toEqual([]);
  });

  it('returns [] on network error', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));
    const installs = await fetchInstalled();
    expect(installs).toEqual([]);
  });

  it('drops malformed install records', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({
          installs: [
            { slug: 'good', version: '1.0.0' },
            { slug: 42 }, // bad type
            null,
          ],
        }),
        { status: 200 },
      ),
    );
    const installs = await fetchInstalled();
    expect(installs).toHaveLength(1);
    expect(installs[0].slug).toBe('good');
  });
});

describe('marketplace/api — installRemote', () => {
  it('returns ok=true on 200', async () => {
    mockFetch(async () => new Response(JSON.stringify({ install: {} }), { status: 200 }));
    const result = await installRemote('vocab-my-core');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it('returns ok=false with status on 403', async () => {
    mockFetch(async () => new Response('forbidden', { status: 403 }));
    const result = await installRemote('aac-designer');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('returns ok=false on network error', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));
    const result = await installRemote('vocab-my-core');
    expect(result.ok).toBe(false);
  });

  it('sends slug in JSON body and credentials=include', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    mockFetch(async (url, init) => {
      captured = { url: url as string, init: init as RequestInit };
      return new Response(JSON.stringify({ install: {} }), { status: 200 });
    });
    await installRemote('test-slug');
    expect(captured).not.toBeNull();
    expect(captured!.url).toContain('/marketplace/install');
    expect(captured!.init?.method).toBe('POST');
    expect(captured!.init?.credentials).toBe('include');
    const body = JSON.parse(captured!.init?.body as string);
    expect(body.slug).toBe('test-slug');
  });
});

describe('marketplace/api — uninstallRemote', () => {
  it('returns ok=true on 200', async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await uninstallRemote('vocab-my-core');
    expect(result.ok).toBe(true);
  });

  it('returns ok=false on network error', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));
    const result = await uninstallRemote('vocab-my-core');
    expect(result.ok).toBe(false);
  });

  it('hits the uninstall endpoint with POST', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    mockFetch(async (url, init) => {
      captured = { url: url as string, init: init as RequestInit };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    await uninstallRemote('test-slug');
    expect(captured!.url).toContain('/marketplace/uninstall');
    expect(captured!.init?.method).toBe('POST');
  });
});
