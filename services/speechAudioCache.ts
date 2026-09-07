/** Private, bounded audio storage. Never stores the phrase or account in clear text. */
export const SPEECH_CACHE_POLICY = {
  database: 'prism-aac-speech-audio-v1',
  store: 'clips',
  version: 1,
  maxBytes: 20 * 1024 * 1024,
  maxClipBytes: 1024 * 1024,
  maxEntries: 512,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
  operationTimeoutMs: 250,
};

export interface SpeechAudioIdentity {
  backend: 'inworld' | 'azure';
  voice: string;
  model: string;
  format: string;
}
interface Clip {
  key: string;
  scope: string;
  audio: ArrayBuffer;
  identity: SpeechAudioIdentity;
  updatedAt: number;
  usedAt: number;
}
export interface SpeechCacheStats { bytes: number; clips: number; available: boolean }
const EMPTY_STATS: SpeechCacheStats = { bytes: 0, clips: 0, available: false };

export class SpeechAudioCache {
  private epoch = 0;
  constructor(private readonly policy: typeof SPEECH_CACHE_POLICY = SPEECH_CACHE_POLICY) {}

  private async digest(value: string): Promise<string | null> {
    try {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  }

  private transaction<T>(mode: IDBTransactionMode, fallback: T,
    work: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
    return new Promise(resolve => {
      if (typeof indexedDB === 'undefined') { resolve(fallback); return; }
      let db: IDBDatabase | undefined;
      let tx: IDBTransaction | undefined;
      let settled = false;
      let value = fallback;
      const finish = (result: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        db?.close();
        resolve(result);
      };
      const timer = setTimeout(() => {
        try { tx?.abort(); } catch { /* already complete */ }
        finish(fallback);
      }, this.policy.operationTimeoutMs);
      try {
        const open = indexedDB.open(this.policy.database, this.policy.version);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains(this.policy.store)) {
            open.result.createObjectStore(this.policy.store, { keyPath: 'key' });
          }
        };
        open.onerror = () => finish(fallback);
        open.onblocked = () => finish(fallback);
        open.onsuccess = () => {
          db = open.result;
          if (settled) { db.close(); return; }
          db.onversionchange = () => db?.close();
          try {
            tx = db.transaction(this.policy.store, mode);
            tx.oncomplete = () => finish(value);
            tx.onerror = tx.onabort = () => finish(fallback);
            work(tx.objectStore(this.policy.store), result => { value = result; });
          } catch { finish(fallback); }
        };
      } catch { finish(fallback); }
    });
  }

  private valid(clip: Clip | undefined): clip is Clip {
    // IndexedDB structured clones can originate in another realm (WebViews
    // and test DOMs); instanceof incorrectly rejects those valid buffers.
    return !!clip && Object.prototype.toString.call(clip.audio) === '[object ArrayBuffer]' && clip.audio.byteLength > 0
      && clip.audio.byteLength <= this.policy.maxClipBytes
      && Number.isFinite(clip.updatedAt) && Number.isFinite(clip.usedAt)
      && clip.updatedAt <= Date.now() && Date.now() - clip.updatedAt <= this.policy.maxAgeMs
      && (clip.identity?.backend === 'inworld' || clip.identity?.backend === 'azure')
      && !!clip.identity.voice && !!clip.identity.model && !!clip.identity.format;
  }

  async get(scope: string, requestKey: string): Promise<Clip | null> {
    const epoch = this.epoch;
    const key = await this.digest(JSON.stringify([scope, requestKey]));
    if (!key || epoch !== this.epoch) return null;
    const clip = await this.transaction<Clip | null>('readwrite', null, (store, done) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as Clip | undefined;
        if (!this.valid(entry)) { if (entry) store.delete(key); return; }
        store.put({ ...entry, usedAt: Date.now() });
        done(entry);
      };
    });
    return epoch === this.epoch ? clip : null;
  }

  async put(scope: string, requestKey: string, audio: ArrayBuffer, identity: SpeechAudioIdentity,
    expectedEpoch = this.epoch): Promise<boolean> {
    if (audio.byteLength > this.policy.maxClipBytes || audio.byteLength === 0) return false;
    const [key, scopeKey] = await Promise.all([this.digest(JSON.stringify([scope, requestKey])), this.digest(scope)]);
    if (!key || !scopeKey || expectedEpoch !== this.epoch) return false;
    const now = Date.now();
    const clip: Clip = { key, scope: scopeKey, audio: audio.slice(0), identity, updatedAt: now, usedAt: now };
    if (!this.valid(clip) || audio.byteLength > this.policy.maxBytes) return false;
    return this.transaction('readwrite', false, (store, done) => {
      const req = store.getAll();
      req.onsuccess = () => {
        if (expectedEpoch !== this.epoch) return;
        const survivors: Clip[] = [];
        for (const row of req.result as Clip[]) {
          if (row.key === key || !this.valid(row)) store.delete(row.key);
          else survivors.push(row);
        }
        survivors.sort((a, b) => a.usedAt - b.usedAt);
        let bytes = survivors.reduce((sum, row) => sum + row.audio.byteLength, audio.byteLength);
        while (survivors.length && (bytes > this.policy.maxBytes || survivors.length >= this.policy.maxEntries)) {
          const oldest = survivors.shift()!;
          bytes -= oldest.audio.byteLength;
          store.delete(oldest.key);
        }
        store.put(clip);
        done(true);
      };
    });
  }

  generation(): number { return this.epoch; }

  async remove(scope: string, requestKey: string): Promise<void> {
    const key = await this.digest(JSON.stringify([scope, requestKey]));
    if (key) await this.transaction('readwrite', false, (store, done) => { store.delete(key); done(true); });
  }

  async clear(): Promise<boolean> {
    this.epoch++;
    return this.transaction('readwrite', false, (store, done) => { store.clear(); done(true); });
  }

  async stats(scope: string): Promise<SpeechCacheStats> {
    const scopeKey = await this.digest(scope);
    if (!scopeKey) return EMPTY_STATS;
    return this.transaction('readonly', EMPTY_STATS, (store, done) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as Clip[]).filter(row => row.scope === scopeKey && this.valid(row));
        done({ available: true, clips: rows.length, bytes: rows.reduce((sum, row) => sum + row.audio.byteLength, 0) });
      };
    });
  }
}

export const speechAudioCache = new SpeechAudioCache();
