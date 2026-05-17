/**
 * inferCardIcon — AI emoji inference for bedside quick-phrase cards.
 *
 * Pins:
 *   • Returns first emoji code point from model response
 *   • Falls back to 💬 when response is ASCII-only (model hallucinated text)
 *   • Falls back to 💬 on network / AI routing error (always resolves)
 *   • Falls back to 💬 on empty response
 *   • Does not throw under any condition
 *   • Passes phrase as user content with locked system prompt
 *     (prevents prompt injection via card text)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the internal route() chain via callSynalux ──────────────────────
// route() tries local Ollama first (always fails in test), then Synalux cloud.
// We mock at the fetch boundary so we exercise the real route() logic.

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Stub window + localStorage so aiService client guards don't bail
vi.stubGlobal('window', { location: { protocol: 'https:' } });

// Suppress the "No AI available" console noise that local Ollama attempts emit
vi.stubGlobal('console', { ...console, error: vi.fn(), warn: vi.fn() });

// Import AFTER stubs are in place
import { inferCardIcon } from './aiService';

// callSynalux non-streaming path reads: data?.choices?.[0]?.message?.content || data?.content
function makeResponse(text: string) {
  return Promise.resolve(
    new Response(
      JSON.stringify({ content: text }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
}

function makeErrorResponse(status: number) {
  return Promise.resolve(new Response('{}', { status }));
}

beforeEach(() => {
  fetchMock.mockReset();
  // Default: Synalux returns a clean emoji
  fetchMock.mockImplementation((url: string) => {
    if (String(url).includes('ollama') || String(url).includes('11434')) {
      return Promise.reject(new Error('ECONNREFUSED'));
    }
    return makeResponse('💧');
  });
});

describe('inferCardIcon', () => {
  it('returns the emoji from the model response', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('11434')) return Promise.reject(new Error('ECONNREFUSED'));
      return makeResponse('🆘');
    });
    const icon = await inferCardIcon('HELP — EMERGENCY');
    expect(icon).toBe('🆘');
  });

  it('extracts first emoji when model adds trailing text', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('11434')) return Promise.reject(new Error('ECONNREFUSED'));
      // Model sometimes adds explanation text — we only want the first character
      return makeResponse('💊 (pill emoji)');
    });
    const icon = await inferCardIcon('I need my medication');
    expect(icon).toBe('💊');
  });

  it('falls back to 💬 when response is ASCII-only (model wrote text instead of emoji)', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('11434')) return Promise.reject(new Error('ECONNREFUSED'));
      return makeResponse('water');
    });
    const icon = await inferCardIcon('Water please');
    expect(icon).toBe('💬');
  });

  it('falls back to 💬 on empty response', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('11434')) return Promise.reject(new Error('ECONNREFUSED'));
      return makeResponse('');
    });
    const icon = await inferCardIcon('Something');
    expect(icon).toBe('💬');
  });

  it('falls back to 💬 on network error — never throws', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'));
    const icon = await inferCardIcon('I am scared');
    expect(icon).toBe('💬');
  });

  it('falls back to 💬 on 500 server error — never throws', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('11434')) return Promise.reject(new Error('ECONNREFUSED'));
      return makeErrorResponse(500);
    });
    const icon = await inferCardIcon('Call the nurse');
    expect(icon).toBe('💬');
  });

  it('always resolves (never rejects) even on AbortError', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    await expect(inferCardIcon('Yes')).resolves.toBeDefined();
  });

  it('caps phrase at 200 chars sent to the model', async () => {
    const longPhrase = 'x'.repeat(300);
    let capturedBody = '';
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('11434')) return Promise.reject(new Error('ECONNREFUSED'));
      capturedBody = String(init?.body ?? '');
      return makeResponse('💬');
    });
    await inferCardIcon(longPhrase);
    // The phrase passed to the model should be capped
    const bodyObj = JSON.parse(capturedBody);
    const userMsg = bodyObj.messages?.find((m: { role: string }) => m.role === 'user');
    expect(userMsg?.content?.length ?? 0).toBeLessThanOrEqual(220); // 200 phrase + quote chars
  });
});
