'use client';

import manifest from '@/constants/generated/picturePack.json';
import pictures from '@/constants/generated/phraseSymbolFiles.json';
import { SYMBOL_BASE_PATH } from '@/lib/pictogramSources';
import { SYNALUX_API, timeoutSignal } from '@/lib/portalConfig';
import { PICTURE_PACK_DATABASE as DB_NAME, PICTURE_PACK_STORE as STORE, PICTURE_PACK_ACTIVE_KEY as ACTIVE_KEY, PICTURE_PACK_DATABASE_VERSION, picturePackVersionKey } from '@/lib/picturePackStorage';
const MAX_PACK_BYTES = 16 * 1024 * 1024;
const MAX_INDEX_BYTES = 512 * 1024;
const FILE_NAME = /^[a-z0-9][a-z0-9_-]*\.png$/;
const HASH = /^[a-f0-9]{64}$/;
const RETRY_DELAY_MS = 2_000;
const MAX_RETRIES = 2;
const STORAGE_RETRY_DELAY_MS = 30_000;
const MAX_RECOVERY_PACKS = 16;
const approved: Record<string, { sha256: string }> = pictures.files;

interface Entry { offset: number; length: number; sha256: string }
interface Pack { version: string; bytes: ArrayBuffer; entries: Map<string, Entry>; dataStart: number }
interface SavedPack { version: string; bytes: ArrayBuffer }
let active: Pack | null = null;
let persisted = false;
let storageRetryAfter = 0;
let hydration: Promise<void> | null = null;
let inflight: Promise<void> | null = null;
let database: Promise<IDBDatabase> | null = null;
let epoch = 0;
let failures = 0;
let watchers = 0;
let retry: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const urls = new Map<string, string>();
const online = () => { failures = 0; storageRetryAfter = 0; void ensurePicturePack(); };

function notify() { epoch++; listeners.forEach(listener => listener()); }
export const picturePackVersion = () => epoch;
export function subscribePicturePack(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const picturesAvailableOffline = () => persisted;

async function digest(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}

/** Validate every byte before a pack can replace the saved working copy. */
async function decodePack(bytes: ArrayBuffer, version: string): Promise<Pack> {
  if (!HASH.test(version) || bytes.byteLength < 12 || bytes.byteLength > MAX_PACK_BYTES || await digest(bytes) !== version) {
    throw new Error('Invalid picture pack');
  }
  const view = new DataView(bytes);
  if (new TextDecoder().decode(new Uint8Array(bytes, 0, 8)) !== 'PAACPK01') throw new Error('Invalid picture pack header');
  const indexLength = view.getUint32(8);
  const dataStart = 12 + indexLength;
  if (indexLength > MAX_INDEX_BYTES || dataStart >= bytes.byteLength) throw new Error('Invalid picture index');
  const index = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes, 12, indexLength)));
  if (!index?.files || typeof index.files !== 'object' || Array.isArray(index.files)) throw new Error('Invalid picture index');
  const items = Object.entries(index.files) as [string, Entry][];
  if (!items.length || items.length > 2_000) throw new Error('Invalid picture count');
  const entries = new Map<string, Entry>();
  let end = 0;
  for (const [name, item] of items) {
    if (!FILE_NAME.test(name) || !item || !HASH.test(item.sha256) || item.offset !== end
      || !Number.isSafeInteger(item.length) || item.length < 33 || dataStart + end + item.length > bytes.byteLength) {
      throw new Error('Invalid picture entry');
    }
    const image = new Uint8Array(bytes, dataStart + end, item.length);
    if (Array.from(image.subarray(0, 8)).join(',') !== '137,80,78,71,13,10,26,10') throw new Error('Invalid picture bytes');
    entries.set(name, item);
    end += item.length;
  }
  if (dataStart + end !== bytes.byteLength) throw new Error('Unindexed picture bytes');
  // Bounded parallel hashing also checks a previously saved version before use.
  for (let start = 0; start < items.length; start += 32) {
    await Promise.all(items.slice(start, start + 32).map(async ([, item]) => {
      if (await digest(bytes.slice(dataStart + item.offset, dataStart + item.offset + item.length)) !== item.sha256) {
        throw new Error('Invalid picture checksum');
      }
    }));
  }
  // Older installed packs can include retired art. localPictureUrl still exposes
  // only entries matching today's approved hash; current downloads must match all metadata.
  if (version === manifest.version && (bytes.byteLength !== manifest.byteLength || indexLength !== manifest.indexByteLength
    || items.length !== manifest.fileCount || items.some(([name, item]) => approved[name]?.sha256 !== item.sha256))) {
    throw new Error('Unexpected picture pack contents');
  }
  return { version, bytes, entries, dataStart };
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, PICTURE_PACK_DATABASE_VERSION);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Picture storage is blocked'));
  });
  database.catch(() => { database = null; });
  return database;
}

async function readSaved(key: IDBValidKey): Promise<SavedPack | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

async function readSavedVersionKeys(): Promise<string[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAllKeys();
    tx.oncomplete = () => resolve(request.result.filter((key): key is string =>
      typeof key === 'string' && /^version:[a-f0-9]{64}$/.test(key)
        && key !== picturePackVersionKey(manifest.version)).slice(-MAX_RECOVERY_PACKS).reverse());
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

async function save(pack: Pack): Promise<void> {
  const db = await openDatabase();
  const next = { version: pack.version, bytes: pack.bytes };
  // WebCrypto cannot run inside an IndexedDB transaction. Validate a snapshot
  // first, then compare that exact record in the write transaction before
  // archiving it. If an older tab changed active in between, retry validation.
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await readSaved(ACTIVE_KEY);
    let validatedPrevious: SavedPack | undefined;
    if (previous) {
      try { await decodePack(previous.bytes, previous.version); validatedPrevious = previous; }
      catch { /* A corrupt legacy record is replaced, never archived or trusted. */ }
    }
    const outcome = await new Promise<'saved' | 'changed'>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.get(ACTIVE_KEY);
      let changed = false;
      let writeError: unknown;
      request.onsuccess = () => {
        const current = request.result as SavedPack | undefined;
        const previousBytes = Object.prototype.toString.call(previous?.bytes) === '[object ArrayBuffer]' ? new Uint8Array(previous!.bytes) : null;
        const currentBytes = Object.prototype.toString.call(current?.bytes) === '[object ArrayBuffer]' ? new Uint8Array(current!.bytes) : null;
        const same = (!current && !previous) || (!!current && !!previous && current.version === previous.version
          && Object.prototype.toString.call(current.bytes) === '[object ArrayBuffer]'
          && Number.isSafeInteger(current.bytes?.byteLength) && current.bytes.byteLength === previous.bytes.byteLength
          && currentBytes && previousBytes && currentBytes.every((byte, index) => byte === previousBytes[index]));
        if (!same) { changed = true; return; }
        try {
          if (validatedPrevious) store.put(validatedPrevious, picturePackVersionKey(validatedPrevious.version));
          store.put(next, ACTIVE_KEY);
          store.put(next, picturePackVersionKey(pack.version));
        } catch (error) {
          writeError = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(changed ? 'changed' : 'saved');
      tx.onabort = tx.onerror = () => reject(writeError ?? tx.error);
    });
    if (outcome === 'saved') return;
  }
  throw new Error('Picture storage changed during pack update');
}

/** Preserve a fully installed library when updating from the older PWA cache. */
async function restoreLegacyPack(): Promise<Pack | null> {
  if (typeof caches === 'undefined') return null;
  const available = new Map<string, { cache: Cache; request: Request }>();
  for (const cacheName of await caches.keys()) {
    if (!cacheName.includes('precache') && !cacheName.includes('serwist')) continue;
    const cache = await caches.open(cacheName);
    for (const request of await cache.keys()) {
      const source = new URL(request.url);
      if (source.origin !== window.location.origin || !source.pathname.startsWith(SYMBOL_BASE_PATH)) continue;
      const name = source.pathname.slice(SYMBOL_BASE_PATH.length);
      if (approved[name]) available.set(name, { cache, request });
    }
  }
  const names = [...available.keys()].sort();
  if (!names.length) return null;
  const images = new Map<string, ArrayBuffer>();
  for (let start = 0; start < names.length; start += 16) {
    await Promise.all(names.slice(start, start + 16).map(async name => {
      const entry = available.get(name)!;
      const response = await entry.cache.match(entry.request);
      if (!response) throw new Error('Incomplete installed picture library');
      const bytes = await boundedBody(response, 2 * 1024 * 1024);
      if (await digest(bytes) !== approved[name].sha256) throw new Error('Invalid installed picture');
      images.set(name, bytes);
    }));
  }
  const files: Record<string, Entry> = {};
  let size = 0;
  for (const name of names) {
    const bytes = images.get(name)!;
    files[name] = { offset: size, length: bytes.byteLength, sha256: approved[name].sha256 };
    size += bytes.byteLength;
  }
  const index = new TextEncoder().encode(JSON.stringify({ files }));
  if (index.length > MAX_INDEX_BYTES || 12 + index.length + size > MAX_PACK_BYTES) throw new Error('Installed picture library too large');
  const bytes = new Uint8Array(12 + index.length + size);
  bytes.set(new TextEncoder().encode('PAACPK01'));
  new DataView(bytes.buffer).setUint32(8, index.length);
  bytes.set(index, 12);
  let offset = 12 + index.length;
  for (const name of names) { const image = images.get(name)!; bytes.set(new Uint8Array(image), offset); offset += image.byteLength; }
  return decodePack(bytes.buffer, await digest(bytes.buffer));
}

async function boundedBody(response: Response, limit: number): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error(`Picture download ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > limit) throw new Error('Picture response too large');
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > limit) throw new Error('Picture response too large');
    return bytes;
  }
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Picture response too large'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes.buffer;
}

async function accessToken(): Promise<string> {
  const timer = timeoutSignal(15_000);
  try {
    const response = await fetch(`${SYNALUX_API}/prism-aac/pictures/access?version=${manifest.version}`, {
      method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: '{}', signal: timer.signal,
    });
    const access = JSON.parse(new TextDecoder().decode(await boundedBody(response, 2_048)));
    if (access.version !== manifest.version || typeof access.token !== 'string' || access.token.length > 1_024) {
      throw new Error('Unexpected picture access');
    }
    return access.token;
  } finally { timer.cancel(); }
}

async function download(): Promise<Pack> {
  let token = await accessToken();
  const bytes = new Uint8Array(manifest.byteLength);
  let offset = 0;
  for (const chunk of manifest.chunks) {
    const timer = timeoutSignal(30_000);
    try {
      const url = `${SYNALUX_API}/prism-aac/pictures/chunks/${chunk.id}?version=${manifest.version}`;
      const request = () => fetch(url, { credentials: 'include', cache: 'no-store', headers: { Authorization: `Bearer ${token}` }, signal: timer.signal });
      let response = await request();
      if (response.status === 401) { token = await accessToken(); response = await request(); }
      const part = await boundedBody(response, chunk.byteLength);
      if (part.byteLength !== chunk.byteLength || await digest(part) !== chunk.sha256) throw new Error('Invalid picture chunk');
      bytes.set(new Uint8Array(part), offset);
      offset += part.byteLength;
    } finally { timer.cancel(); }
  }
  if (offset !== bytes.byteLength) throw new Error('Incomplete picture download');
  return decodePack(bytes.buffer, manifest.version);
}

export function preparePictureStorage(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      try {
        const exact = await readSaved(picturePackVersionKey(manifest.version));
        if (exact) {
          try {
            if (exact.version !== manifest.version) throw new Error('Versioned picture key mismatch');
            active = await decodePack(exact.bytes, exact.version); persisted = true; notify();
          }
          catch (error) { console.warn('[pictures] Versioned pack unavailable:', error); }
        }
        if (!active) {
          const saved = await readSaved(ACTIVE_KEY);
          if (saved) {
            active = await decodePack(saved.bytes, saved.version);
            try { await save(active); persisted = true; }
            catch (error) {
              storageRetryAfter = Date.now() + STORAGE_RETRY_DELAY_MS;
              console.warn('[pictures] Could not protect the saved pack:', error);
            }
            notify();
          }
        }
      } catch (error) { console.warn('[pictures] Saved pack unavailable:', error); }
      if (!active) {
        try {
          for (const key of await readSavedVersionKeys()) {
            const saved = await readSaved(key);
            if (!saved || key !== picturePackVersionKey(saved.version)) continue;
            try {
              active = await decodePack(saved.bytes, saved.version);
              persisted = true; notify(); break;
            } catch (error) { console.warn('[pictures] Archived pack unavailable:', error); }
          }
        } catch (error) { console.warn('[pictures] Archived storage unavailable:', error); }
      }
      if (!active) {
        try {
          const installed = await restoreLegacyPack();
          if (installed) {
            try { await save(installed); persisted = true; }
            catch (error) { storageRetryAfter = Date.now() + STORAGE_RETRY_DELAY_MS; console.warn('[pictures] Could not retain the installed pack:', error); }
            active = installed; notify();
          }
        } catch (error) { console.warn('[pictures] Installed picture migration unavailable:', error); }
      }
    })();
  }
  return hydration;
}

export function ensurePicturePack(): Promise<void> {
  if (inflight) return inflight;
  if (active?.version === manifest.version && (persisted || Date.now() < storageRetryAfter)) return Promise.resolve();
  inflight = (async () => {
    await preparePictureStorage();
    if (active?.version === manifest.version) {
      if (!persisted && Date.now() >= storageRetryAfter) {
        try { await save(active); persisted = true; notify(); }
        catch (error) { storageRetryAfter = Date.now() + STORAGE_RETRY_DELAY_MS; console.warn('[pictures] Offline storage still unavailable:', error); }
      }
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const next = await download();
      try { await save(next); persisted = true; }
      catch (error) {
        console.warn('[pictures] Could not save the pack for offline use:', error);
        if (active) return;
        persisted = false;
        storageRetryAfter = Date.now() + STORAGE_RETRY_DELAY_MS;
      }
      active = next;
      void navigator.storage?.persist?.().catch(() => false);
      failures = 0;
      notify();
    } catch (error) {
      console.warn('[pictures] Download unavailable; keeping the saved pack:', error);
      failures++;
      if (watchers && failures <= MAX_RETRIES && !retry) {
        retry = setTimeout(() => { retry = null; void ensurePicturePack(); }, RETRY_DELAY_MS * failures);
      }
      notify();
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

export function watchPicturePack() {
  watchers++;
  void ensurePicturePack();
  if (watchers === 1) window.addEventListener('online', online);
  return () => {
    watchers--;
    if (!watchers) {
      if (retry) { clearTimeout(retry); retry = null; }
      window.removeEventListener('online', online);
    }
  };
}

export function isBundledPicture(url: string | null): boolean {
  return !!url && url.startsWith(SYMBOL_BASE_PATH) && !!approved[url.slice(SYMBOL_BASE_PATH.length)];
}

export function localPictureUrl(url: string | null): string | null {
  if (!isBundledPicture(url)) return url;
  const name = url!.slice(SYMBOL_BASE_PATH.length);
  const entry = active?.entries.get(name);
  if (!active || !entry || entry.sha256 !== approved[name].sha256) return null;
  let local = urls.get(entry.sha256);
  if (!local) {
    local = URL.createObjectURL(new Blob([active.bytes.slice(active.dataStart + entry.offset, active.dataStart + entry.offset + entry.length)], { type: 'image/png' }));
    urls.set(entry.sha256, local);
  }
  return local;
}
