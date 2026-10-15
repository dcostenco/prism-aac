/**
 * When the portal refuses cloud AI for an account (402: no cloud subscription,
 * or the month's allowance used up), the person must be told that, not told to
 * "check your internet or start local Ollama".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/textCorrectService', () => ({ correctText: vi.fn(async (t: string) => t) }));
vi.mock('@/services/voiceInputService', () => ({ isVoiceInputSupported: () => false, startVoiceInput: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/crisisSafetyFilter', () => ({ checkCrisisSafety: () => ({ safe: true }), checkModelOutputSafety: () => ({ safe: true }) }));
vi.mock('@/services/ttsHighlightBus', () => ({ estimateSpeechDurationMs: () => 200 }));

Element.prototype.scrollIntoView = vi.fn();

import AIChatPanel from '@/components/AIChatPanel';
import { askAI, CloudAccessError } from '@/services/aiService';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';

const fetchMock = vi.fn();
const realFetch = globalThis.fetch;

/** Local Ollama is not running; the portal answers the chat request with `chat`. */
function portalAnswers(chat: () => Response) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('localhost:11434') || String(url).includes('127.0.0.1:11434')) return new Response('', { status: 503 });
    if (String(url).includes('/prism-aac/chat')) return chat();
    return new Response('', { status: 404 });
  });
}
const refusal = (body: unknown, contentType = 'application/json') =>
  () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 402, headers: { 'Content-Type': contentType } });

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('askAI reports a cloud refusal as what it is', () => {
  it.each([
    ['no subscription', { error: 'Cloud access requires a subscription.', code: 'payment_required' }, 'payment_required'],
    ['allowance used', { error: 'Your cloud allowance has been used.', code: 'exhausted' }, 'exhausted'],
    ['an unreadable body', '<html>Payment Required</html>', 'payment_required'],
  ] as const)('%s', async (_name, body, code) => {
    portalAnswers(refusal(body, typeof body === 'string' ? 'text/html' : 'application/json'));
    const error = await askAI('Tell me about the moon').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CloudAccessError);
    expect((error as CloudAccessError).code).toBe(code);
  });

  it('a server fault still reads as unreachable', async () => {
    portalAnswers(() => new Response('', { status: 500 }));
    const error = await askAI('Tell me about the moon').catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(CloudAccessError);
    expect((error as Error).message).toMatch(/No AI available/);
  });
});

describe('the AI chat says why it cannot answer', () => {
  beforeEach(() => {
    useUIStore.setState({ sidePanel: 'ai-chat' });
    useMessageStore.setState({ text: 'tell me about the moon', soundEnabled: true, autoSpeak: true } as never);
    useSettingsStore.setState({ language: 'en', outputLanguage: 'en' } as never);
  });

  async function ask() {
    render(<AIChatPanel />);
    const { triggerAISubmit } = await import('@/services/aiChatBridge');
    await act(async () => {
      triggerAISubmit();
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    return screen.getByTestId('ai-chat-panel').textContent ?? '';
  }

  it('no subscription: says a cloud subscription is needed, not "could not reach"', async () => {
    portalAnswers(refusal({ code: 'payment_required' }));
    const text = await ask();
    expect(text).toContain('Cloud AI needs a cloud subscription');
    expect(text).not.toContain('Could not reach AI');
  });

  it('allowance used: says the month\'s allowance is used up', async () => {
    portalAnswers(refusal({ code: 'exhausted' }));
    const text = await ask();
    expect(text).toContain("This month's cloud AI allowance is used up");
  });

  it('a real outage still says it could not reach the AI', async () => {
    portalAnswers(() => new Response('', { status: 503 }));
    const text = await ask();
    expect(text).toContain('Could not reach AI');
  });

  it('askAI itself is not mocked here: the panel sees the real service error', () => {
    expect(vi.isMockFunction(askAI)).toBe(false);
  });
});
