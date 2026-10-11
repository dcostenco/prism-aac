import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { FIXTURE_PACK, OLD_PACK, RETIRED_ENTRY_PACK, REVISED_ENTRY_PACK, IMAGES, hash } from './fixtures/picture-pack';
import { picturePackVersionKey } from '@/lib/picturePackStorage';

vi.unmock('@/services/bundledPicturePack');
vi.mock('@/constants/generated/picturePack.json', async () => ({ default: (await import('./fixtures/picture-pack')).FIXTURE_PACK.manifest }));
vi.mock('@/constants/generated/phraseSymbolFiles.json', async () => {
  const { IMAGES, hash } = await import('./fixtures/picture-pack');
  return { default: { files: Object.fromEntries(Object.entries(IMAGES).map(([name, bytes]) => [name, { sha256: hash(bytes) }])) } };
});
const VIRTUAL = '/prism-aac/symbols/one.png';
let requests: string[];
let expiresOnce = false;
let corrupt = false;
let fetcher: ReturnType<typeof vi.fn>;

async function saved(record?: { version: string; bytes: ArrayBuffer }, key = 'active') {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('prism-aac-bundled-pictures', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('packs');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<{ version: string; bytes: ArrayBuffer } | undefined>((resolve, reject) => {
      const tx = db.transaction('packs', record ? 'readwrite' : 'readonly');
      const request = record ? tx.objectStore('packs').put(record, key) : tx.objectStore('packs').get(key);
      tx.oncomplete = () => resolve(record || request.result); tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
beforeEach(() => {
  vi.resetModules(); requests = []; expiresOnce = false; corrupt = false;
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('caches', undefined);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => `blob:picture-${Math.random()}`) });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fetcher = vi.fn(async (url: string, options: RequestInit) => {
    requests.push(url);
    if (/\/access(?:\?|$)/.test(url)) {
      expect(options.method).toBe('POST'); expect(options.credentials).toBe('include');
      return Response.json({ token: 'fixture-access', version: FIXTURE_PACK.manifest.version });
    }
    expect(options.headers).toEqual({ Authorization: 'Bearer fixture-access' });
    if (expiresOnce) { expiresOnce = false; return new Response(null, { status: 401 }); }
    const id = Number(url.match(/chunks\/(\d+)/)?.[1]);
    const bytes = corrupt ? new Uint8Array(FIXTURE_PACK.chunks[id].length) : Uint8Array.from(FIXTURE_PACK.chunks[id]);
    return new Response(bytes.buffer, { status: 200, headers: { 'Content-Length': String(bytes.length) } });
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('complete offline picture packs', () => {
  it.each(['active', 'archive'] as const)('keeps unchanged core art from an older pack containing retired entries after interrupted replacement and cold restart: %s', async location => {
    const record = { version: RETIRED_ENTRY_PACK.manifest.version, bytes: RETIRED_ENTRY_PACK.bytes };
    await saved(record, location === 'active' ? 'active' : picturePackVersionKey(record.version));
    fetcher.mockRejectedValue(new Error('replacement interrupted'));
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.picturesAvailableOffline()).toBe(true);
    expect(service.isBundledPicture('/prism-aac/symbols/retired.png')).toBe(false);
    expect(service.localPictureUrl('/prism-aac/symbols/retired.png')).not.toMatch(/^blob:/);
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect((await saved(undefined, picturePackVersionKey(record.version)))?.version).toBe(record.version);

    vi.resetModules();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fetcher.mockClear();
    const restarted = await import('@/services/bundledPicturePack');
    await restarted.ensurePicturePack();
    expect(restarted.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(restarted.picturesAvailableOffline()).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    const { hasDurablePicturePack } = await import('@/lib/durablePicturePack');
    expect(await hasDurablePicturePack()).toBe(false);
  });
  it('keeps unchanged art without exposing a superseded picture under a current approved name', async () => {
    await saved({ version: REVISED_ENTRY_PACK.manifest.version, bytes: REVISED_ENTRY_PACK.bytes });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.localPictureUrl('/prism-aac/symbols/two.png')).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(service.picturesAvailableOffline()).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects a retired entry with a false per-file checksum even when the overall pack hash matches', async () => {
    const bytes = new Uint8Array(RETIRED_ENTRY_PACK.bytes.slice(0));
    bytes[bytes.length - 1] ^= 1;
    const version = hash(bytes);
    await saved({ version, bytes: bytes.buffer });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toBeNull();
    expect(service.picturesAvailableOffline()).toBe(false);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(await saved(undefined, picturePackVersionKey(version))).toBeUndefined();
  });
  it('coalesces anonymous downloads and persists only the complete verified pack', async () => {
    const service = await import('@/services/bundledPicturePack');
    expect(service.localPictureUrl(VIRTUAL)).toBeNull();
    await Promise.all([service.ensurePicturePack(), service.ensurePicturePack(), service.ensurePicturePack()]);
    expect(requests).toHaveLength(3);
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.picturesAvailableOffline()).toBe(true);
    expect((await saved())?.version).toBe(FIXTURE_PACK.manifest.version);
    expect(hash(new Uint8Array((await saved())!.bytes))).toBe(FIXTURE_PACK.manifest.version);
    expect(service.localPictureUrl('blob:caregiver-photo')).toBe('blob:caregiver-photo');
    expect(service.localPictureUrl('/prism-aac/symbols/../not-owned.png')).toBe('/prism-aac/symbols/../not-owned.png');
  });
  it('hydrates a warm pack after restart while completely offline, with zero network calls', async () => {
    await saved({ version: FIXTURE_PACK.manifest.version, bytes: FIXTURE_PACK.bytes });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fetcher.mockRejectedValue(new Error('offline'));
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.picturesAvailableOffline()).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps the current version available after an older tab overwrites the legacy active record', async () => {
    await saved({ version: OLD_PACK.manifest.version, bytes: OLD_PACK.bytes });
    const first = await import('@/services/bundledPicturePack');
    await first.ensurePicturePack();
    expect((await saved(undefined, picturePackVersionKey(FIXTURE_PACK.manifest.version)))?.version).toBe(FIXTURE_PACK.manifest.version);
    expect((await saved(undefined, picturePackVersionKey(OLD_PACK.manifest.version)))?.version).toBe(OLD_PACK.manifest.version);

    // Simulate an already-installed older app that knows only the legacy key.
    await saved({ version: OLD_PACK.manifest.version, bytes: OLD_PACK.bytes });
    vi.resetModules();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fetcher.mockClear();
    const restarted = await import('@/services/bundledPicturePack');
    await restarted.ensurePicturePack();
    expect(restarted.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(restarted.picturesAvailableOffline()).toBe(true);
    expect((await saved(undefined, 'active'))?.version).toBe(OLD_PACK.manifest.version);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([false, true])('recovers an intact archived pack when mutable active is unusable and download fails: %s', async corruptActive => {
    await saved({ version: OLD_PACK.manifest.version, bytes: OLD_PACK.bytes }, picturePackVersionKey(OLD_PACK.manifest.version));
    if (corruptActive) await saved({ version: FIXTURE_PACK.manifest.version, bytes: new Uint8Array(FIXTURE_PACK.bytes.byteLength).buffer });
    fetcher.mockRejectedValue(new Error('replacement unavailable'));
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.picturesAvailableOffline()).toBe(true);
    expect((await saved(undefined, picturePackVersionKey(OLD_PACK.manifest.version)))?.version).toBe(OLD_PACK.manifest.version);
    const { hasDurablePicturePack } = await import('@/lib/durablePicturePack');
    expect(await hasDurablePicturePack()).toBe(false);
  });
  it.each([false, true])('protects legacy hydration before an older tab can replace it, repairing corrupt version storage: %s', async corruptExact => {
    if (corruptExact) await saved({ version: FIXTURE_PACK.manifest.version, bytes: new Uint8Array(FIXTURE_PACK.bytes.byteLength).buffer }, picturePackVersionKey(FIXTURE_PACK.manifest.version));
    await saved({ version: FIXTURE_PACK.manifest.version, bytes: FIXTURE_PACK.bytes });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const { hasDurablePicturePack } = await import('@/lib/durablePicturePack');
    expect(await hasDurablePicturePack()).toBe(false);
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect(await hasDurablePicturePack()).toBe(true);
    await saved({ version: OLD_PACK.manifest.version, bytes: OLD_PACK.bytes });
    vi.resetModules();
    const restarted = await import('@/services/bundledPicturePack');
    await restarted.ensurePicturePack();
    expect(restarted.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(restarted.picturesAvailableOffline()).toBe(true);
    expect(await hasDurablePicturePack()).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('renews an expired grant during chunk download, without paying or signing in', async () => {
    expiresOnce = true;
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(requests.filter(url => /\/access(?:\?|$)/.test(url))).toHaveLength(2);
    expect(service.picturesAvailableOffline()).toBe(true);
  });
  it('rejects corrupt chunks without saving a partial pack and recovers on a later request', async () => {
    corrupt = true;
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(await saved()).toBeUndefined(); expect(service.localPictureUrl(VIRTUAL)).toBeNull();
    corrupt = false; await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/); expect(service.picturesAvailableOffline()).toBe(true);
  });
  it('keeps the prior complete copy usable when a newer download is corrupt', async () => {
    await saved({ version: OLD_PACK.manifest.version, bytes: OLD_PACK.bytes }); corrupt = true;
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect((await saved())?.version).toBe(OLD_PACK.manifest.version);
    expect(service.picturesAvailableOffline()).toBe(true);
  });
  it('keeps the prior complete copy when storage refuses the replacement', async () => {
    await saved({ version: OLD_PACK.manifest.version, bytes: OLD_PACK.bytes });
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect((await saved())?.version).toBe(OLD_PACK.manifest.version);
    expect(await saved(undefined, picturePackVersionKey(OLD_PACK.manifest.version))).toBeUndefined();
    expect(await saved(undefined, picturePackVersionKey(FIXTURE_PACK.manifest.version))).toBeUndefined();
    expect(service.picturesAvailableOffline()).toBe(false);
  });
  it('does not archive a corrupt legacy record when saving a verified replacement', async () => {
    await saved({ version: OLD_PACK.manifest.version, bytes: new Uint8Array(OLD_PACK.bytes.byteLength).buffer });
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect((await saved(undefined, 'active'))?.version).toBe(FIXTURE_PACK.manifest.version);
    expect(await saved(undefined, picturePackVersionKey(OLD_PACK.manifest.version))).toBeUndefined();
    expect((await saved(undefined, picturePackVersionKey(FIXTURE_PACK.manifest.version)))?.version).toBe(FIXTURE_PACK.manifest.version);
  });
  it('does not describe memory-only pictures as available offline', async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.picturesAvailableOffline()).toBe(false);
  });
  it('rejects altered saved bytes and leaves custom pictures untouched', async () => {
    await saved({ version: FIXTURE_PACK.manifest.version, bytes: new Uint8Array(FIXTURE_PACK.bytes.byteLength).buffer });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toBeNull(); expect(service.localPictureUrl('data:image/png;base64,custom')).toBe('data:image/png;base64,custom');
    expect(service.picturesAvailableOffline()).toBe(false); expect(fetcher).not.toHaveBeenCalled();
  });
  it('falls back to a validated legacy active record when its exact version record is corrupt', async () => {
    await saved({ version: FIXTURE_PACK.manifest.version, bytes: new Uint8Array(FIXTURE_PACK.bytes.byteLength).buffer }, picturePackVersionKey(FIXTURE_PACK.manifest.version));
    await saved({ version: OLD_PACK.manifest.version, bytes: OLD_PACK.bytes });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const service = await import('@/services/bundledPicturePack');
    await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.picturesAvailableOffline()).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('migrates the complete older service-worker library without any network access', async () => {
    const entries = Object.entries(IMAGES);
    const cache = {
      keys: async () => entries.map(([name]) => new Request(`${window.location.origin}/prism-aac/symbols/${name}?__WB_REVISION__=fixture`)),
      match: async (request: Request) => new Response(Uint8Array.from(IMAGES[new URL(request.url).pathname.split('/').pop() as keyof typeof IMAGES]).buffer),
    };
    vi.stubGlobal('caches', { keys: async () => ['serwist-precache-previous'], open: async () => cache });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(service.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(service.picturesAvailableOffline()).toBe(true);
    expect((await saved())?.version).toBe(FIXTURE_PACK.manifest.version);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps installed pictures from the smaller previous library when the new download fails', async () => {
    const image = IMAGES['one.png'];
    const cache = {
      keys: async () => [new Request(`${window.location.origin}/prism-aac/symbols/one.png?__WB_REVISION__=previous`)],
      match: async () => new Response(Uint8Array.from(image).buffer),
    };
    vi.stubGlobal('caches', { keys: async () => ['serwist-precache-previous'], open: async () => cache });
    fetcher.mockRejectedValue(new Error('download unavailable'));
    const first = await import('@/services/bundledPicturePack');
    await first.ensurePicturePack();
    expect(first.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(first.localPictureUrl('/prism-aac/symbols/two.png')).toBeNull();
    expect((await saved())?.version).toBe(OLD_PACK.manifest.version);
    const { hasDurablePicturePack } = await import('@/lib/durablePicturePack');
    expect(await hasDurablePicturePack()).toBe(false);
    vi.resetModules();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fetcher.mockClear();
    const restarted = await import('@/services/bundledPicturePack');
    await restarted.ensurePicturePack();
    expect(restarted.localPictureUrl(VIRTUAL)).toMatch(/^blob:/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('retries persistence of memory-only pictures after storage space becomes available', async () => {
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const service = await import('@/services/bundledPicturePack'); await service.ensurePicturePack();
    expect(service.picturesAvailableOffline()).toBe(false);
    const downloads = fetcher.mock.calls.length;
    put.mockRestore();
    const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 30_001);
    await service.ensurePicturePack();
    expect(service.picturesAvailableOffline()).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(downloads);
    expect((await saved())?.version).toBe(FIXTURE_PACK.manifest.version);
  });
});
