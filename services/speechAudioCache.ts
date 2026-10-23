/** Private, bounded audio storage. Never stores the phrase or account in clear text. */
export const SPEECH_CACHE_POLICY = {
  database: 'prism-aac-speech-audio-v1',
  store: 'clips',
  scopeStore: 'identity',
  scopePointer: 'prism-aac-speech-scope-v1',
  version: 2,
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
const SCOPE_RECORD_KEY = 'last-confirmed';
const SCOPE_MAX_CHARS = 320;
const SCOPE_MAX_BYTES = 2048;
const SCOPE_IV_BYTES = 12;
const SCOPE_KEY_BYTES = 32;
interface SavedScope { key: string; token: string; secret: ArrayBuffer; iv: ArrayBuffer; payload: ArrayBuffer }

export class SpeechAudioCache {
  private epoch = 0;
  private scopeMemo: { token: string; value: string } | null = null;
  constructor(private readonly policy: typeof SPEECH_CACHE_POLICY = SPEECH_CACHE_POLICY) {}

  private async digest(value: string): Promise<string | null> {
    try {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  }

  private transaction<T>(mode: IDBTransactionMode, fallback: T,
    work: (store: IDBObjectStore, done: (value: T) => void, active: () => boolean) => void,
    storeName: string = this.policy.store): Promise<T> {
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
          for (const name of [this.policy.store, this.policy.scopeStore]) {
            if (!open.result.objectStoreNames.contains(name)) open.result.createObjectStore(name, { keyPath: 'key' });
          }
        };
        open.onerror = () => finish(fallback);
        open.onblocked = () => finish(fallback);
        open.onsuccess = () => {
          db = open.result;
          if (settled) { db.close(); return; }
          db.onversionchange = () => db?.close();
          try {
            tx = db.transaction(storeName, mode);
            tx.oncomplete = () => finish(value);
            tx.onerror = tx.onabort = () => finish(fallback);
            work(
              tx.objectStore(storeName),
              result => { if (!settled) value = result; },
              () => !settled,
            );
          } catch { finish(fallback); }
        };
      } catch { finish(fallback); }
    });
  }

  private scopeToken(): string | null {
    try { return localStorage.getItem(this.policy.scopePointer); } catch { return null; }
  }

  /** Read-only offline identity; never an authentication or entitlement grant. */
  async savedScope(): Promise<string | null> {
    const token = this.scopeToken();
    if (!token) return null;
    if (this.scopeMemo?.token === token) return this.scopeMemo.value;
    const record = await this.transaction<SavedScope | null>('readonly', null, (store, done) => {
      const request = store.get(SCOPE_RECORD_KEY);
      request.onsuccess = () => done(request.result ?? null);
    }, this.policy.scopeStore);
    if (!record || record.token !== token || record.iv?.byteLength !== SCOPE_IV_BYTES
      || !record.payload?.byteLength || record.payload.byteLength > SCOPE_MAX_BYTES
      || record.secret?.byteLength !== SCOPE_KEY_BYTES) return null;
    try {
      const secret = await crypto.subtle.importKey('raw', record.secret, 'AES-GCM', false, ['decrypt']);
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, secret, record.payload);
      const value = new TextDecoder().decode(bytes);
      if (!value || value.length > SCOPE_MAX_CHARS || this.scopeToken() !== token) return null;
      this.scopeMemo = { token, value };
      return value;
    } catch { return null; }
  }

  async rememberScope(value: string): Promise<boolean> {
    if (!value || value.length > SCOPE_MAX_CHARS) return false;
    if (this.scopeMemo?.value === value && this.scopeToken() === this.scopeMemo.token) return true;
    let token: string;
    try {
      token = crypto.randomUUID();
      // Publish the opaque generation before asynchronous encryption. A later
      // sign-out or account switch can revoke even an unfinished write.
      localStorage.setItem(this.policy.scopePointer, token);
      this.scopeMemo = { token, value };
      // WebKit can stall while cloning CryptoKey into IndexedDB. Keep bounded
      // device-local key bytes; imported keys stay nonextractable in memory.
      // This hides identity text at rest, not from scripts running on this origin.
      const keyBytes = crypto.getRandomValues(new Uint8Array(SCOPE_KEY_BYTES));
      const secret = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(SCOPE_IV_BYTES));
      const payload = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, secret, new TextEncoder().encode(value));
      return await this.transaction('readwrite', false, (store, done) => {
        if (this.scopeToken() !== token) return;
        store.put({ key: SCOPE_RECORD_KEY, token, secret: keyBytes.buffer, iv: iv.buffer, payload } satisfies SavedScope);
        done(true);
      }, this.policy.scopeStore);
    } catch { return false; }
  }

  async forgetScope(): Promise<boolean> {
    this.scopeMemo = null;
    try { localStorage.removeItem(this.policy.scopePointer); } catch { /* storage unavailable */ }
    return this.transaction('readwrite', false, (store, done) => {
      // Another tab may already have confirmed a new account.
      if (this.scopeToken()) return;
      store.delete(SCOPE_RECORD_KEY);
      done(true);
    }, this.policy.scopeStore);
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
    const clip = await this.transaction<Clip | null>('readwrite', null, (store, done, active) => {
      const req = store.get(key);
      req.onsuccess = () => {
        if (!active()) return;
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
    return this.transaction('readwrite', false, (store, done, active) => {
      const req = store.getAll();
      req.onsuccess = () => {
        if (!active()) return;
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
    return this.transaction('readonly', EMPTY_STATS, (store, done, active) => {
      const req = store.getAll();
      req.onsuccess = () => {
        if (!active()) return;
        const rows = (req.result as Clip[]).filter(row => row.scope === scopeKey && this.valid(row));
        done({ available: true, clips: rows.length, bytes: rows.reduce((sum, row) => sum + row.audio.byteLength, 0) });
      };
    });
  }
}

export const speechAudioCache = new SpeechAudioCache();
