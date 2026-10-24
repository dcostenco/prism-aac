import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';
import { SpeechAudioCache, SPEECH_CACHE_POLICY } from '@/services/speechAudioCache';

const IDENTITY = { backend: 'inworld' as const, voice: 'Alex', model: 'inworld-tts-2', format: 'audio/mpeg' };
const AUDIO = new Uint8Array([1, 2, 3, 4]).buffer;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('persistent speech storage', () => {
  it('restores an encrypted last scope without persisting the account name', async () => {
    const cache = new SpeechAudioCache();
    expect(await cache.rememberScope('account-a@example.invalid')).toBe(true);
    expect(localStorage.getItem(SPEECH_CACHE_POLICY.scopePointer)).not.toContain('account-a');
    expect(await new SpeechAudioCache().savedScope()).toBe('account-a@example.invalid');
    const db = await new Promise<IDBDatabase>(resolve => {
      const open = indexedDB.open(SPEECH_CACHE_POLICY.database, SPEECH_CACHE_POLICY.version);
      open.onsuccess = () => resolve(open.result);
    });
    const records = await new Promise<unknown[]>(resolve => {
      const tx = db.transaction(SPEECH_CACHE_POLICY.scopeStore, 'readonly');
      const get = tx.objectStore(SPEECH_CACHE_POLICY.scopeStore).getAll();
      get.onsuccess = () => resolve(get.result);
    });
    db.close();
    expect(JSON.stringify(records)).not.toContain('account-a');
    // Persist buffers rather than CryptoKey objects: WebKit can stall cloning keys.
    expect((records[0] as { secret: ArrayBuffer }).secret.byteLength).toBe(32);
  });

  it('revokes a pending scope write before sign-out and keeps a later account separate', async () => {
    const cache = new SpeechAudioCache();
    const pending = cache.rememberScope('account-a@example.invalid');
    const cleared = cache.forgetScope();
    expect(await pending).toBe(false);
    await cleared;
    expect(await new SpeechAudioCache().savedScope()).toBeNull();
    expect(await cache.rememberScope('account-b@example.invalid')).toBe(true);
    expect(await new SpeechAudioCache().savedScope()).toBe('account-b@example.invalid');
    await cache.forgetScope();
    expect(await new SpeechAudioCache().savedScope()).toBeNull();
  });

  it('upgrades old clip storage without changing the saved speech keys', async () => {
    const scope = 'legacy@example.invalid';
    const key = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([scope, 'phrase'])))), x => x.toString(16).padStart(2, '0')).join('');
    const scopeKey = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope))), x => x.toString(16).padStart(2, '0')).join('');
    await new Promise<void>(resolve => {
      const open = indexedDB.open(SPEECH_CACHE_POLICY.database, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(SPEECH_CACHE_POLICY.store, { keyPath: 'key' });
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(SPEECH_CACHE_POLICY.store, 'readwrite');
        tx.objectStore(SPEECH_CACHE_POLICY.store).put({ key, scope: scopeKey, audio: AUDIO, identity: IDENTITY, updatedAt: Date.now(), usedAt: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
    const cache = new SpeechAudioCache();
    expect(await cache.rememberScope(scope)).toBe(true);
    expect((await cache.get((await cache.savedScope())!, 'phrase'))?.audio).toEqual(AUDIO);
  });
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

  it('ignores a late read callback after the watchdog aborts the transaction', async () => {
    let inactive = false;
    let lateError: unknown;
    const deleteEntry = vi.fn(() => {
      if (inactive) throw new DOMException('The transaction is inactive or finished.', 'TransactionInactiveError');
    });
    const request = {
      result: { key: 'stale', audio: 'invalid' },
      onsuccess: null as null | (() => void),
    };
    const store = {
      get: vi.fn(() => {
        setTimeout(() => {
          try { request.onsuccess?.(); } catch (error) { lateError = error; }
        }, 20);
        return request;
      }),
      delete: deleteEntry,
    };
    const transaction = {
      oncomplete: null as null | (() => void),
      onerror: null as null | (() => void),
      onabort: null as null | (() => void),
      objectStore: vi.fn(() => store),
      abort: vi.fn(() => {
        inactive = true;
        transaction.onabort?.();
      }),
    };
    const database = {
      onversionchange: null as null | (() => void),
      objectStoreNames: { contains: () => true },
      transaction: vi.fn(() => transaction),
      close: vi.fn(),
    };
    const openRequest = {
      result: database,
      onupgradeneeded: null as null | (() => void),
      onerror: null as null | (() => void),
      onblocked: null as null | (() => void),
      onsuccess: null as null | (() => void),
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        queueMicrotask(() => openRequest.onsuccess?.());
        return openRequest;
      },
    });
    const cache = new SpeechAudioCache({ ...SPEECH_CACHE_POLICY, operationTimeoutMs: 5 });

    expect(await cache.get('profile', 'late-invalid-entry')).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(lateError).toBeUndefined();
    expect(deleteEntry).not.toHaveBeenCalled();
  });
});
