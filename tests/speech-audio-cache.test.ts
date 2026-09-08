import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';
import { SpeechAudioCache, SPEECH_CACHE_POLICY } from '@/services/speechAudioCache';

const IDENTITY = { backend: 'inworld' as const, voice: 'Alex', model: 'inworld-tts-2', format: 'audio/mpeg' };
const AUDIO = new Uint8Array([1, 2, 3, 4]).buffer;

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('persistent speech storage', () => {
  it.each(['inworld', 'azure'] as const)('retains %s audio across service recreation without exposing another profile', async backend => {
    const identity = { ...IDENTITY, backend };
    expect(await new SpeechAudioCache().put('profile-a', 'hello', AUDIO, identity)).toBe(true);
    const reloaded = new SpeechAudioCache();
    const clip = await reloaded.get('profile-a', 'hello');
    expect(clip?.audio).toEqual(AUDIO);
    expect(clip?.identity).toEqual(identity);
    expect(JSON.stringify(clip)).not.toContain('profile-a');
    expect(JSON.stringify(clip)).not.toContain('hello');
    expect(await reloaded.get('profile-b', 'hello')).toBeNull();
    expect(await reloaded.get('profile-a', 'different settings')).toBeNull();
  });

  it('evicts least recently used audio to keep the byte budget, preserving reused phrases', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now++);
    const cache = new SpeechAudioCache({ ...SPEECH_CACHE_POLICY, maxBytes: 8 });
    await cache.put('a', 'first', AUDIO, IDENTITY);
    await cache.put('a', 'second', AUDIO, IDENTITY);
    await cache.get('a', 'first');
    await cache.put('a', 'third', AUDIO, IDENTITY);
    expect(await cache.get('a', 'second')).toBeNull();
    expect((await cache.get('a', 'first'))?.audio).toEqual(AUDIO);
    expect(await cache.stats('a')).toEqual({ available: true, clips: 2, bytes: 8 });
  });

  it('bounds entry count across profiles and rejects oversized or empty clips', async () => {
    const cache = new SpeechAudioCache({ ...SPEECH_CACHE_POLICY, maxEntries: 1, maxClipBytes: 4 });
    await cache.put('a', 'first', AUDIO, IDENTITY);
    await cache.put('b', 'second', AUDIO, IDENTITY);
    expect(await cache.get('a', 'first')).toBeNull();
    expect(await cache.put('b', 'large', new ArrayBuffer(5), IDENTITY)).toBe(false);
    expect(await cache.put('b', 'empty', new ArrayBuffer(0), IDENTITY)).toBe(false);
  });

  it('expires retained audio, and clear prevents a pending synthesis from saving it again', async () => {
    const cache = new SpeechAudioCache();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    await cache.put('a', 'old', AUDIO, IDENTITY);
    clock.mockReturnValue(now + SPEECH_CACHE_POLICY.maxAgeMs + 1);
    expect(await cache.get('a', 'old')).toBeNull();
    const generation = cache.generation();
    expect(await cache.clear()).toBe(true);
    expect(await cache.put('a', 'late', AUDIO, IDENTITY, generation)).toBe(false);
    expect((await cache.stats('a')).clips).toBe(0);
  });

  it('fails open when private browsing blocks storage or the API is absent', async () => {
    const cache = new SpeechAudioCache();
    vi.stubGlobal('indexedDB', { open() { throw new DOMException('Blocked', 'SecurityError'); } });
    expect(await cache.get('a', 'hello')).toBeNull();
    expect(await cache.put('a', 'hello', AUDIO, IDENTITY)).toBe(false);
    expect((await cache.stats('a')).available).toBe(false);
    vi.stubGlobal('indexedDB', undefined);
    expect(await cache.clear()).toBe(false);
  });

  it('does not hold up speaking when storage never responds', async () => {
    const cache = new SpeechAudioCache({ ...SPEECH_CACHE_POLICY, operationTimeoutMs: 10 });
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    expect(await cache.get('a', 'hello')).toBeNull();
  });
});
