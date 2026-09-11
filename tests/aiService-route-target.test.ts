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
 * synalux-platform explicitly built as unauthenticated-by-design with
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
    // Both routes authenticate now — the AAC route stopped being anonymous when
    // the portal separated authentication from metering, because leaving it open
    // meant anyone could stream paid models for free. The reason to keep using
    // the prism-aac route is no longer that it is unauthenticated; it is that it
    // carries the AAC system prompt, safety interception and tier routing that
    // /api/v1/chat does not. What still must work for everyone without an
    // account is speech — that lives on the public TTS endpoints, not here.
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const hitAac = calledUrls.some((u: string) => u.endsWith('/api/v1/prism-aac/chat'));
    const hitGeneric = calledUrls.some((u: string) => /\/api\/v1\/chat$/.test(u));
    expect(hitAac, `expected a POST to /api/v1/prism-aac/chat — calls: ${calledUrls.join(', ')}`).toBe(true);
    expect(hitGeneric, `must NOT hit the auth-gated /api/v1/chat — calls: ${calledUrls.join(', ')}`).toBe(false);
  });

  // A 401 from a cloud route is now the ordinary answer for someone who has
  // never signed in — on iOS especially, where the sign-in gate does not apply
  // and the board works without an account. Telling that person their session
  // "expired" describes something that never happened and sends them looking
  // for a problem that is not there.
  it('tells a never-signed-in caller to sign in, not that a session expired', async () => {
    fetchSpy.mockImplementation(async () => new Response('', { status: 401 }));
    await expect(askAI('hi', 'math-tutor')).rejects.toThrow(/sign in to use cloud/i);
  });

  it('still reports an expired session as expired when a token was held', async () => {
    sessionStorage.setItem('prism-aac-auth-token', 'held-token');
    sessionStorage.setItem('prism-aac-auth-token-exp', String(Date.now() + 600_000));
    fetchSpy.mockImplementation(async () => new Response('', { status: 401 }));
    await expect(askAI('hi', 'math-tutor')).rejects.toThrow(/session expired/i);
  });

  it('sends credentials:include so signed-in synalux users still get their tier routing', async () => {
    await askAI('hi', 'math-tutor');
    const aacCall = fetchSpy.mock.calls.find((c: unknown[]) => String(c[0]).includes('/prism-aac/chat'));
    const opts = aacCall?.[1] as RequestInit | undefined;
    expect(opts?.credentials).toBe('include');
  });

  it('threads the source=prism-aac body field for portal observability', async () => {
    await askAI('hi', 'math-tutor');
    const aacCall = fetchSpy.mock.calls.find((c: unknown[]) => String(c[0]).includes('/prism-aac/chat'));
    const opts = aacCall?.[1] as RequestInit | undefined;
    const body = opts?.body ? JSON.parse(opts.body as string) : {};
    expect(body.source).toBe('prism-aac');
  });
});
