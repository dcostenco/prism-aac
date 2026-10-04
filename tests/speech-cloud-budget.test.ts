import { beforeEach, describe, expect, it, vi } from 'vitest';

// The browser's Say waits at most 1.5 s for the cloud voice; every other caller
// keeps the 8 s default. The budget travels aacSpeak -> speak -> speakAzure.

const azure = vi.hoisted(() => ({ speakAzure: vi.fn(async () => ({ success: true })) }));
vi.mock('@/services/azureTTS', () => ({
  speakAzure: azure.speakAzure,
  stopAzureAudio: vi.fn(),
  warmupAzureAudio: vi.fn(async () => {}),
}));
vi.mock('@/services/voiceCatalogService', () => ({
  fetchVoiceCatalog: vi.fn(async () => null),
  defaultVoiceForLanguage: vi.fn(() => undefined),
}));
vi.mock('@/lib/datadog', () => ({ ddAction: vi.fn() }));

import { speak } from '@/services/speechService';
import { aacSpeak } from '@/services/aacSpeak';
import { useMessageStore } from '@/store/messageStore';

const CLOUD_TIMEOUT_ARG = 9; // speakAzure(text, lang, tone, rate, volume, token, voiceId, interrupt, cacheOnly, timeoutMs)

beforeEach(() => {
  azure.speakAzure.mockClear();
  useMessageStore.setState({ soundEnabled: true });
});

describe('the cloud-voice wait', () => {
  it('reaches the cloud call when a caller sets it', async () => {
    await speak('hello there', 0.5, 1, 'en-US', 'auto', false, { cloudTimeoutMs: 1500 });
    expect(azure.speakAzure.mock.calls.at(-1)?.[CLOUD_TIMEOUT_ARG]).toBe(1500);
  });

  it('stays at the default when a caller does not', async () => {
    await speak('hello again', 0.5, 1, 'en-US', 'auto', false);
    expect(azure.speakAzure.mock.calls.at(-1)?.[CLOUD_TIMEOUT_ARG]).toBeUndefined();
  });

  it('passes through aacSpeak', async () => {
    await aacSpeak('good morning', 0.5, 1, undefined, true, undefined, { cloudTimeoutMs: 1500 });
    expect(azure.speakAzure.mock.calls.at(-1)?.[CLOUD_TIMEOUT_ARG]).toBe(1500);
  });
});
