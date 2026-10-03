/**
 * iOS app AI chat — the native pipeline's failure placeholder.
 *
 * ios-native AACPipeline.ask() answers "I'm having trouble responding right now."
 * when no on-device model is loaded and its own cloud call fails. That call carries
 * no account, and the cloud chat route authenticates, so it is always refused.
 * askAI accepted the placeholder as the answer (it is longer than the 12-character
 * near-empty rule), so the web route — which sends the signed-in session cookie —
 * never ran. Owner report 2026-10-02: "ai chat is broken", "doesn't work even after
 * sign in anyway".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type BridgeWindow = Window & {
  prismNativeBridge?: { askAI: (question: string, lang: string) => void };
  prismNativeAIResult?: (token: string) => void;
  prismNativeAIDone?: () => void;
};

const PLACEHOLDER = "I'm having trouble responding right now.";

function installBridge(reply: string | string[]) {
  const tokens = Array.isArray(reply) ? reply : [reply];
  (window as BridgeWindow).prismNativeBridge = {
    askAI: () => {
      setTimeout(() => {
        for (const token of tokens) (window as BridgeWindow).prismNativeAIResult?.(token);
        (window as BridgeWindow).prismNativeAIDone?.();
      }, 0);
    },
  };
}

const chatCalls = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([url]) => String(url).includes('/prism-aac/chat'));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete (window as BridgeWindow).prismNativeBridge;
  vi.restoreAllMocks();
});

describe('askAI in the iOS app — native failure placeholder', () => {
  it('signed in: falls through to the web route, which sends the session cookie, and returns its answer', async () => {
    installBridge(PLACEHOLDER);
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/prism-aac/chat')) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello! I am here to help.' } }] }), { status: 200 });
      }
      throw new TypeError(`unexpected fetch ${String(input)}`);
    });
    const { askAI } = await import('@/services/aiService');

    const res = await askAI('?');

    expect(res.text).toBe('Hello! I am here to help.');
    const calls = chatCalls(fetchSpy);
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as RequestInit).credentials).toBe('include');
  });

  it('a curly apostrophe in the placeholder is still recognised', async () => {
    installBridge('I’m having trouble responding right now.');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Here I am.' } }] }), { status: 200 }),
    );
    const { askAI } = await import('@/services/aiService');

    expect((await askAI('?')).text).toBe('Here I am.');
    expect(chatCalls(fetchSpy)).toHaveLength(1);
  });

  it('signed out: says to sign in instead of showing the opaque placeholder', async () => {
    installBridge(PLACEHOLDER);
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/prism-aac/chat')) {
        return new Response(JSON.stringify({ error: 'Not authenticated. Please sign in at /auth.' }), { status: 401 });
      }
      throw new TypeError(`unexpected fetch ${String(input)}`);
    });
    const { askAI } = await import('@/services/aiService');

    await expect(askAI('?')).rejects.toThrow(/sign in/i);
  });

  it('a real on-device answer is used as before, with no cloud call', async () => {
    installBridge('Hi! I like dogs too. Do you have a dog?');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const { askAI } = await import('@/services/aiService');

    expect((await askAI('?')).text).toBe('Hi! I like dogs too. Do you have a dog?');
    expect(chatCalls(fetchSpy)).toHaveLength(0);
  });

  it('"AI is turned off" is the user\'s own setting: the cloud does not answer instead', async () => {
    // The bridge's own reply when AI is declined (ios-native ContentView.swift, case "askAI").
    installBridge('AI is turned off. Enable it in Settings.');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const { askAI } = await import('@/services/aiService');

    expect((await askAI('?')).text).toMatch(/AI is turned off/);
    expect(chatCalls(fetchSpy)).toHaveLength(0);
  });

  it('streaming: the placeholder the bridge streamed never reaches the caller; only the cloud answer does', async () => {
    installBridge(["I'm having trouble ", 'responding right now.']);
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" there."}}]}',
      'data: [DONE]',
      '',
    ].join('\n\n');
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const { askAI } = await import('@/services/aiService');
    const chunks: string[] = [];

    const res = await askAI('?', undefined, (delta) => chunks.push(delta));

    expect(res.text).toBe('Hello there.');
    expect(chunks.join('')).toBe('Hello there.');
  });
});
