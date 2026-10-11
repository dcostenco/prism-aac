// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasDurablePicturePack } from '../lib/durablePicturePack';
import manifest from '../constants/generated/picturePack.json';

afterEach(() => vi.unstubAllGlobals());

function storedRecord(record: unknown, keys?: Record<string, unknown>) {
  const db = {
    objectStoreNames: { contains: () => true }, close: vi.fn(),
    transaction: () => {
      const tx = { oncomplete: undefined as (() => void) | undefined, objectStore: () => ({ get: (key: string) => ({ result: keys ? keys[key] : record }) }) };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };
  vi.stubGlobal('indexedDB', { open: () => {
    const request = { result: db, onsuccess: undefined as (() => void) | undefined };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  } });
  return db;
}

describe('durable picture pack check', () => {
  it('retains legacy pictures when browser storage is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await hasDurablePicturePack()).toBe(false);
  });
  it('does not hang while another context blocks storage access', async () => {
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { onblocked: undefined as (() => void) | undefined };
      queueMicrotask(() => request.onblocked?.());
      return request;
    } });
    expect(await hasDurablePicturePack()).toBe(false);
  });
  it.each([null, { version: 'wrong', bytes: new ArrayBuffer(1) }, { version: manifest.version, bytes: new ArrayBuffer(1) }])('rejects absent, mismatched or incomplete data: %j', async record => {
    const db = storedRecord(record);
    expect(await hasDurablePicturePack()).toBe(false);
    expect(db.close).toHaveBeenCalled();
  });
  it('checks actual bytes instead of trusting a valid version and length', async () => {
    vi.stubGlobal('crypto', webcrypto);
    storedRecord({ version: manifest.version, bytes: new ArrayBuffer(manifest.byteLength) });
    expect(await hasDurablePicturePack()).toBe(false);
  });
  it('looks up the versioned record before the legacy active record', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const exact = { version: manifest.version, bytes: new ArrayBuffer(manifest.byteLength) };
    const db = storedRecord(null, { [`version:${manifest.version}`]: exact, active: { version: 'older', bytes: new ArrayBuffer(1) } });
    expect(await hasDurablePicturePack()).toBe(false);
    expect(db.close).toHaveBeenCalled();
  });
  it('does not treat an older legacy active pack as durable for the current version', async () => {
    vi.stubGlobal('crypto', webcrypto);
    storedRecord(null, { active: { version: 'older', bytes: new ArrayBuffer(manifest.byteLength) } });
    expect(await hasDurablePicturePack()).toBe(false);
  });
});
