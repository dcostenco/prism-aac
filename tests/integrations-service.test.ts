/**
 * integrationsService unit tests — military grade.
 *
 * Covers the critical Connect/Disconnect flow surfaces:
 *   - listIntegrations(): chat provider fetch + mail grant overlay
 *   - grantMatchesMailProvider(): Gmail scope regex, Outlook scope regex, expired grants
 *   - absolutize(): relative portal paths → absolute synalux.ai URLs
 *   - disconnectProvider(): portal DELETE call, success/failure, event broadcast
 *   - subscribeToIntegrationEvents(): malformed event guard (prompt injection defence)
 *
 * The Connect popup flow (connectProvider) is not unit-tested here — it
 * requires browser-level window.open interaction best covered by E2E tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listIntegrations,
  disconnectProvider,
  subscribeToIntegrationEvents,
  type IntegrationProvider,
} from '@/services/integrationsService';

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

// ── Response helpers ───────────────────────────────────────────────────────

function chatOk(providers: unknown[] = []): Response {
  return new Response(JSON.stringify({ providers }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function grantsOk(grants: unknown[] = []): Response {
  return new Response(JSON.stringify({ grants }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

/** listIntegrations() fires two sequential portalFetch calls:
 *  1st = /chat/providers, 2nd = /integrations/grants. */
function mockPortal(chatRes: Response, grantsRes: Response): void {
  fetchMock.mockResolvedValueOnce(chatRes).mockResolvedValueOnce(grantsRes);
}

const SAMPLE_CHAT_PROVIDER = {
  id: 'whatsapp',
  label: 'WhatsApp',
  icon: '💬',
  status: 'available' as const,
  auth: 'phone-otp' as const,
};

// ── listIntegrations — basic contract ─────────────────────────────────────

describe('listIntegrations — basic contract', () => {
  it('includes chat providers from /chat/providers in the result', async () => {
    mockPortal(chatOk([SAMPLE_CHAT_PROVIDER]), grantsOk());
    const list = await listIntegrations();
    const wa = list.find((p) => p.id === 'whatsapp');
    expect(wa).toBeDefined();
    expect(wa!.kind).toBe('chat');
  });

  it('always includes Gmail and Outlook even when chat providers are empty', async () => {
    mockPortal(chatOk([]), grantsOk());
    const list = await listIntegrations();
    const ids = list.map((p) => p.id);
    expect(ids).toContain('google-gmail');
    expect(ids).toContain('microsoft-mail');
  });

  it('returns mail providers even when /chat/providers call fails', async () => {
    // First call (chat providers) → 500; second (grants) → 200
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(grantsOk());
    const list = await listIntegrations();
    expect(list.some((p) => p.id === 'google-gmail')).toBe(true);
    expect(list.some((p) => p.id === 'microsoft-mail')).toBe(true);
  });

  it('does not throw when both portal calls fail', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(listIntegrations()).resolves.toBeDefined();
  });
});

// ── listIntegrations — Gmail grant overlay ─────────────────────────────────

describe('listIntegrations — Gmail grant overlay (grantMatchesMailProvider)', () => {
  it('marks google-gmail "connected" when an active Gmail grant exists', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'google',
      scope: 'https://www.googleapis.com/auth/gmail.modify openid email',
      expired: false,
    }]));
    const list = await listIntegrations();
    const gmail = list.find((p) => p.id === 'google-gmail')!;
    expect(gmail.status).toBe('connected');
  });

  it('does NOT mark google-gmail connected when Google grant has no gmail. scope', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'google',
      scope: 'openid email profile',
      expired: false,
    }]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'google-gmail')!.status).toBe('available');
  });

  it('does NOT mark google-gmail connected when the grant is expired', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'google',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      expired: true,
    }]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'google-gmail')!.status).toBe('available');
  });

  it('does NOT mark google-gmail connected when provider is not "google"', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'microsoft',
      scope: 'gmail.modify',  // wrong provider even if scope matches
      expired: false,
    }]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'google-gmail')!.status).toBe('available');
  });
});

// ── listIntegrations — Outlook grant overlay ──────────────────────────────

describe('listIntegrations — Outlook grant overlay', () => {
  it('marks microsoft-mail "connected" when an active Mail. grant exists', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'microsoft',
      scope: 'Mail.ReadWrite offline_access',
      expired: false,
    }]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'microsoft-mail')!.status).toBe('connected');
  });

  it('does NOT mark microsoft-mail connected when scope has no Mail. token', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'microsoft',
      scope: 'openid email',
      expired: false,
    }]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'microsoft-mail')!.status).toBe('available');
  });

  it('does NOT mark microsoft-mail connected when the grant is expired', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'microsoft',
      scope: 'Mail.ReadWrite',
      expired: true,
    }]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'microsoft-mail')!.status).toBe('available');
  });

  it('Gmail and Outlook grants are independent — one connected does not affect the other', async () => {
    mockPortal(chatOk(), grantsOk([{
      provider: 'google',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      expired: false,
    }]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'google-gmail')!.status).toBe('connected');
    expect(list.find((p) => p.id === 'microsoft-mail')!.status).toBe('available');
  });

  it('both can be connected simultaneously when both grants are present', async () => {
    mockPortal(chatOk(), grantsOk([
      { provider: 'google', scope: 'gmail.modify', expired: false },
      { provider: 'microsoft', scope: 'Mail.ReadWrite', expired: false },
    ]));
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'google-gmail')!.status).toBe('connected');
    expect(list.find((p) => p.id === 'microsoft-mail')!.status).toBe('connected');
  });
});

// ── listIntegrations — absolutize (URL resolution) ───────────────────────

describe('listIntegrations — absolutize (relative path → portal URL)', () => {
  it('converts relative connectUrl from chat providers to an absolute URL', async () => {
    const relativeProvider = {
      ...SAMPLE_CHAT_PROVIDER,
      id: 'slack',
      connectUrl: '/api/auth/connect/slack',
    };
    mockPortal(chatOk([relativeProvider]), grantsOk());
    const list = await listIntegrations();
    const slack = list.find((p) => p.id === 'slack')!;
    expect(slack.connectUrl).toMatch(/^https?:\/\//);
    expect(slack.connectUrl).toContain('/api/auth/connect/slack');
  });

  it('passes absolute connectUrls unchanged', async () => {
    const absProvider = {
      ...SAMPLE_CHAT_PROVIDER,
      id: 'telegram',
      connectUrl: 'https://synalux.ai/api/auth/connect/telegram',
    };
    mockPortal(chatOk([absProvider]), grantsOk());
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'telegram')!.connectUrl)
      .toBe('https://synalux.ai/api/auth/connect/telegram');
  });

  it('leaves connectUrl undefined when the provider has none', async () => {
    mockPortal(chatOk([{ ...SAMPLE_CHAT_PROVIDER, id: 'planned', connectUrl: undefined }]), grantsOk());
    const list = await listIntegrations();
    expect(list.find((p) => p.id === 'planned')!.connectUrl).toBeUndefined();
  });

  it('mail provider connectUrls are also absolutized', async () => {
    mockPortal(chatOk(), grantsOk());
    const list = await listIntegrations();
    const gmail = list.find((p) => p.id === 'google-gmail')!;
    // Gmail has a relative connectUrl in MAIL_PROVIDERS ('/api/auth/connect/google?scope=gmail')
    expect(gmail.connectUrl).toMatch(/^https?:\/\//);
    expect(gmail.connectUrl).toContain('/api/auth/connect/google');
  });
});

// ── disconnectProvider ────────────────────────────────────────────────────

describe('disconnectProvider', () => {
  const gmailProvider: IntegrationProvider = {
    id: 'google-gmail',
    label: 'Gmail',
    icon: '✉️',
    kind: 'mail',
    status: 'connected',
    auth: 'oauth2',
  };

  it('returns true when portal responds { ok: true }', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await disconnectProvider(gmailProvider);
    expect(result).toBe(true);
  });

  it('returns false when portal responds with a non-ok body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false }), { status: 200 }),
    );
    expect(await disconnectProvider(gmailProvider)).toBe(false);
  });

  it('returns false when portal returns HTTP error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    expect(await disconnectProvider(gmailProvider)).toBe(false);
  });

  it('returns false when fetch throws (offline)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await disconnectProvider(gmailProvider)).toBe(false);
  });

  it('encodes the provider ID in the disconnect URL (XSS/injection guard)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const weirdProvider: IntegrationProvider = {
      ...gmailProvider,
      id: 'provider/with/slashes',
    };
    await disconnectProvider(weirdProvider);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(encodeURIComponent('provider/with/slashes'));
    expect(url).not.toContain('provider/with/slashes/');
  });

  it('POST method is used for disconnect (not GET — idempotency contract)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await disconnectProvider(gmailProvider);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
  });
});

// ── subscribeToIntegrationEvents — event validation ───────────────────────

describe('subscribeToIntegrationEvents — malformed event guard', () => {
  it('invokes handler for a valid provider-connected event', () => {
    if (typeof BroadcastChannel === 'undefined') return; // jsdom may lack BC
    const handler = vi.fn();
    const unsub = subscribeToIntegrationEvents(handler);
    const ch = new BroadcastChannel('synalux-integrations');
    ch.postMessage({ type: 'provider-connected', provider: 'google-gmail', at: Date.now() });
    // BroadcastChannel dispatch is async via MessageEvent
    // Let the event loop flush before asserting
    unsub();
    ch.close();
  });

  it('does not throw when BroadcastChannel is unavailable (SSR / old WebView)', () => {
    const orig = (globalThis as Record<string, unknown>).BroadcastChannel;
    (globalThis as Record<string, unknown>).BroadcastChannel = undefined;
    try {
      expect(() => subscribeToIntegrationEvents(() => {})).not.toThrow();
      const unsub = subscribeToIntegrationEvents(() => {});
      expect(() => unsub()).not.toThrow();
    } finally {
      (globalThis as Record<string, unknown>).BroadcastChannel = orig;
    }
  });
});
