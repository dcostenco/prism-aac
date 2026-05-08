/**
 * askAI / translateAI route target — pin the endpoint URL so the
 * tutor never silently regresses back to the auth-gated /api/v1/chat
 * surface.
 *
 * History: prism-aac shipped pointing at SYNALUX_API + /chat — the
 * synalux web-app chat surface, which requires a signed-in NextAuth
 * cookie. Cross-origin from prism-aac.vercel.app the SameSite=Lax
 * cookie doesn't propagate, so every anonymous tutor tap ended up at
 * "Couldn't reach the tutor. Check your internet." (May 2026 user
 * reports Image #29 / #30). The fix is to route through
 * /api/v1/prism-aac/chat — the dedicated AAC chat endpoint that
 * synalux-private explicitly built as unauthenticated-by-design with
 * per-IP rate limit + tier routing.
 *
 * Test asserts the URL the askAI service actually fetches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askAI } from '@/services/aiService';

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('askAI — endpoint URL', () => {
  it('POSTs to /api/v1/prism-aac/chat (anonymous-friendly), NOT /api/v1/chat', async () => {
    await askAI('What is 2+3?', 'math-tutor');
    // The prism-aac route is unauthenticated by design (synalux-private
    // route.ts:110 "AAC must work for everyone"). Routing through
    // /chat gates anonymous users at 401.
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const hitAac = calledUrls.some((u: string) => u.endsWith('/api/v1/prism-aac/chat'));
    const hitGeneric = calledUrls.some((u: string) => /\/api\/v1\/chat$/.test(u));
    expect(hitAac, `expected a POST to /api/v1/prism-aac/chat — calls: ${calledUrls.join(', ')}`).toBe(true);
    expect(hitGeneric, `must NOT hit the auth-gated /api/v1/chat — calls: ${calledUrls.join(', ')}`).toBe(false);
  });

  it('sends credentials:include so signed-in synalux users still get their tier routing', async () => {
    await askAI('hi', 'math-tutor');
    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(opts?.credentials).toBe('include');
  });

  it('threads the source=prism-aac body field for portal observability', async () => {
    await askAI('hi', 'math-tutor');
    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = opts?.body ? JSON.parse(opts.body as string) : {};
    expect(body.source).toBe('prism-aac');
  });
});
