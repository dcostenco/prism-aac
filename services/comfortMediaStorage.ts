const DB_NAME = 'prism-aac-comfort';
const STORE_NAME = 'media';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  // WebKit workaround: storing Blobs directly in IDB often fails in Playwright/Safari.
  // Store as ArrayBuffer + type object instead.
  const buffer = await blob.arrayBuffer();
  const data = { buffer, type: blob.type };
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Transaction failed without error'));
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      const result = req.result;
      if (!result) {
        resolve(null);
      } else if (result instanceof Blob) {
        // Legacy support if there are existing Blobs
        resolve(result);
      } else if (result.buffer && typeof result.type === 'string') {
        resolve(new Blob([result.buffer], { type: result.type }));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error || new Error('Request failed without error'));
  });
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllBlobs(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
