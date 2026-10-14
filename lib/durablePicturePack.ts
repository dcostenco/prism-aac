import manifest from '@/constants/generated/picturePack.json';
import { PICTURE_PACK_DATABASE, PICTURE_PACK_STORE, PICTURE_PACK_DATABASE_VERSION, picturePackVersionKey } from './picturePackStorage';

/** Old picture caches are expendable only after the approved pack is durable. */
export async function hasDurablePicturePack(): Promise<boolean> {
  try {
    const record = await new Promise<{ version: string; bytes: ArrayBuffer } | null>(resolve => {
      const request = indexedDB.open(PICTURE_PACK_DATABASE, PICTURE_PACK_DATABASE_VERSION);
      request.onupgradeneeded = () => { request.transaction?.abort(); };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PICTURE_PACK_STORE)) { db.close(); resolve(null); return; }
        const tx = db.transaction(PICTURE_PACK_STORE, 'readonly');
        const store = tx.objectStore(PICTURE_PACK_STORE);
        const exact = store.get(picturePackVersionKey(manifest.version));
        tx.oncomplete = () => { resolve(exact.result ?? null); db.close(); };
        tx.onabort = tx.onerror = () => { resolve(null); db.close(); };
      };
    });
    if (!record || record.version !== manifest.version || Object.prototype.toString.call(record.bytes) !== '[object ArrayBuffer]' || record.bytes.byteLength !== manifest.byteLength) return false;
    const digest = await crypto.subtle.digest('SHA-256', record.bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') === manifest.version;
  } catch { return false; }
}
