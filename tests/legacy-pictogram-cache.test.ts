import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function seed(name: string, value: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('blobs');
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('blobs', 'readwrite');
      transaction.objectStore('blobs').put(new Blob([value]), 'fixture');
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

it('removes only retired origin HTTP entries and the retired DB, preserving current Flux and pack caches', async () => {
  await seed('prism-aac-pictograms', 'retired bytes');
  await seed('prism-aac-generated-pictures', 'current Flux bytes');
  localStorage.setItem('prism-legacy-pictograms-cleared', '1');
  localStorage.setItem('prism-arasaac-misses', '["en:fixture"]');
  const entries = new Set([
    'https://api.arasaac.org/v1/pictograms/en/search/fixture',
    'https://static.arasaac.org/pictograms/1/1_500.png',
    'https://example.supabase.co/storage/v1/object/public/prism-pictograms/current.png',
    'http://localhost/prism-aac/symbols/an-whale.png',
    'http://localhost/prism-aac',
    'https://arasaac.org.example.test/keep.png',
  ]);
  const cache = { keys: async () => [...entries].map(url => new Request(url)),
    delete: vi.fn(async (request: Request) => entries.delete(request.url)) };
  vi.stubGlobal('caches', { keys: async () => ['mixed-cache'], open: async () => cache });
  const { clearLegacyPictogramCache } = await import('@/services/legacyPictogramCache');
  await clearLegacyPictogramCache();
  expect(entries).toHaveLength(4);
  expect([...entries].some(url => new URL(url).hostname === 'static.arasaac.org')).toBe(false);
  expect(entries.has('http://localhost/prism-aac/symbols/an-whale.png')).toBe(true);
  expect(entries.has('https://arasaac.org.example.test/keep.png')).toBe(true);
  expect((await indexedDB.databases()).map(database => database.name)).not.toContain('prism-aac-pictograms');
  expect((await indexedDB.databases()).map(database => database.name)).toContain('prism-aac-generated-pictures');
  expect(localStorage.getItem('prism-arasaac-misses')).toBeNull();
  expect(localStorage.getItem('prism-legacy-pictograms-cleared')).toBe('2');
});

it('does not mark a blocked database deletion complete until its old connection closes', async () => {
  await seed('prism-aac-pictograms', 'retired bytes');
  const database = await new Promise<IDBDatabase>(resolve => {
    const request = indexedDB.open('prism-aac-pictograms', 1);
    request.onsuccess = () => resolve(request.result);
  });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { clearLegacyPictogramCache } = await import('@/services/legacyPictogramCache');
  const removal = clearLegacyPictogramCache();
  await vi.waitFor(() => expect(warning).toHaveBeenCalled());
  expect(localStorage.getItem('prism-legacy-pictograms-cleared')).not.toBe('2');
  database.close();
  await removal;
  expect(localStorage.getItem('prism-legacy-pictograms-cleared')).toBe('2');
});

it('runs once: after a completed cleanup, later loads touch neither the database nor Cache Storage', async () => {
  localStorage.setItem('prism-legacy-pictograms-cleared', '2');
  const deleteDatabase = vi.spyOn(indexedDB, 'deleteDatabase');
  const cacheKeys = vi.fn(async () => [] as string[]);
  vi.stubGlobal('caches', { keys: cacheKeys, open: vi.fn() });
  const { clearLegacyPictogramCache } = await import('@/services/legacyPictogramCache');
  await clearLegacyPictogramCache();
  await clearLegacyPictogramCache();
  expect(deleteDatabase).not.toHaveBeenCalled();
  expect(cacheKeys).not.toHaveBeenCalled();
});

it('an earlier cleanup version runs again, and a failed cleanup is retried on the next load', async () => {
  localStorage.setItem('prism-legacy-pictograms-cleared', '1');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const cacheKeys = vi.fn()
    .mockRejectedValueOnce(new Error('storage error'))
    .mockResolvedValue([] as string[]);
  vi.stubGlobal('caches', { keys: cacheKeys, open: vi.fn() });
  const { clearLegacyPictogramCache } = await import('@/services/legacyPictogramCache');
  await expect(clearLegacyPictogramCache()).rejects.toThrow('storage error');
  expect(localStorage.getItem('prism-legacy-pictograms-cleared')).toBe('1');
  await clearLegacyPictogramCache();
  expect(cacheKeys).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem('prism-legacy-pictograms-cleared')).toBe('2');
});
