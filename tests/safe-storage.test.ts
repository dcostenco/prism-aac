/**
 * safeJSONStorage — quota-safe localStorage adapter for zustand persist.
 * Validates the recovery path: when setItem throws QuotaExceededError,
 * the onQuotaExceeded callback fires and a retry happens. Existing
 * in-memory state must survive even if persist write ultimately fails.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safeJSONStorage } from '@/lib/safeStorage';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeJSONStorage — happy path', () => {
  it('round-trips set/get/remove via real localStorage', () => {
    const store = safeJSONStorage({ name: 'unit' });
    store.setItem('k', '{"a":1}');
    expect(store.getItem('k')).toBe('{"a":1}');
    store.removeItem('k');
    expect(store.getItem('k')).toBeNull();
  });
});

describe('safeJSONStorage — quota path', () => {
  /** Replaces window.localStorage.setItem directly (vi.spyOn through
   *  jsdom's Storage descriptor doesn't reliably forward to the real
   *  store after re-throw). Maintains a side-channel `written` map so
   *  we can assert what the retry path produced. */
  function patchSetItem(opts: { throwAlways?: boolean } = {}): {
    restore: () => void; written: Map<string, string>; calls: number;
  } {
    const original = window.localStorage.setItem.bind(window.localStorage);
    const written = new Map<string, string>();
    let calls = 0;
    let firstCall = true;
    Object.defineProperty(window.localStorage, 'setItem', {
      configurable: true,
      value: (k: string, v: string) => {
        calls++;
        if (opts.throwAlways || firstCall) {
          firstCall = false;
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        }
        written.set(k, v);
        original(k, v);
      },
    });
    return {
      written,
      get calls() { return calls; },
      restore: () => {
        Object.defineProperty(window.localStorage, 'setItem', {
          configurable: true,
          value: original,
        });
      },
    };
  }

  it('calls onQuotaExceeded then retries the write on first quota failure', () => {
    const onQuotaExceeded = vi.fn();
    const patch = patchSetItem();
    const store = safeJSONStorage({ name: 'unit', onQuotaExceeded });
    store.setItem('k', 'v');
    expect(onQuotaExceeded).toHaveBeenCalledTimes(1);
    // setItem invoked twice (initial throw + retry that landed).
    expect(patch.calls).toBe(2);
    expect(patch.written.get('k')).toBe('v');
    patch.restore();
  });

  it('only emits the warn log once per store instance even on repeat quota failures', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const patch = patchSetItem({ throwAlways: true });
    const store = safeJSONStorage({ name: 'unit' });
    store.setItem('k1', 'v');
    store.setItem('k2', 'v');
    store.setItem('k3', 'v');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    patch.restore();
  });

  it('swallows non-quota DOMExceptions (e.g. Safari private mode SecurityError)', () => {
    const original = window.localStorage.setItem.bind(window.localStorage);
    Object.defineProperty(window.localStorage, 'setItem', {
      configurable: true,
      value: () => { throw new DOMException('private', 'SecurityError'); },
    });
    try {
      const store = safeJSONStorage({ name: 'unit' });
      expect(() => store.setItem('k', 'v')).not.toThrow();
    } finally {
      Object.defineProperty(window.localStorage, 'setItem', { configurable: true, value: original });
    }
  });
});
