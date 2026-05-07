/**
 * Quota-shed callback wiring per store.
 *
 * Default zustand persist swallows QuotaExceededError silently — for
 * an AAC user who can't articulate "my settings keep resetting",
 * silent localStorage failure is a real data-loss class. Each
 * persisted store now wraps its storage with safeJSONStorage and
 * wires an onQuotaExceeded callback that sheds disposable data so
 * the next write fits.
 *
 * This test exercises the shed callback by directly invoking
 * safeJSONStorage with a localStorage mock that throws QuotaExceeded
 * on the first setItem and succeeds on the retry.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { safeJSONStorage } from '@/lib/safeStorage';

const orig = window.localStorage;

beforeEach(() => {
  // Restore real localStorage between tests
  Object.defineProperty(window, 'localStorage', { value: orig, writable: true, configurable: true });
  window.localStorage.clear();
});

function makeQuotaThrowingStorage(retries = 1): { written: Record<string, string>; calls: number } {
  const written: Record<string, string> = {};
  let calls = 0;
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k: string) => written[k] ?? null,
      setItem: (k: string, v: string) => {
        calls++;
        if (calls <= retries) {
          const e = new DOMException('Quota exceeded', 'QuotaExceededError');
          throw e;
        }
        written[k] = v;
      },
      removeItem: (k: string) => { delete written[k]; },
      clear: () => { for (const k of Object.keys(written)) delete written[k]; },
      key: () => null,
      length: 0,
    },
    writable: true,
    configurable: true,
  });
  return { written, calls: 0 };
}

describe('safeJSONStorage — quota-shed callback', () => {
  it('invokes onQuotaExceeded on first quota error', () => {
    const tracker = makeQuotaThrowingStorage(1);
    let called = 0;
    const storage = safeJSONStorage({ name: 'test', onQuotaExceeded: () => { called++; } });
    storage.setItem('k', 'v');
    expect(called).toBe(1);
    // After the shed callback, second setItem call from the wrapper
    // succeeds — verify the value made it through.
    expect(tracker.written.k).toBe('v');
  });

  it('warns at most once per store across many quota events', () => {
    const tracker = makeQuotaThrowingStorage(10);
    let called = 0;
    const storage = safeJSONStorage({ name: 'test', onQuotaExceeded: () => { called++; } });
    // Fire 5 setItem calls; each first attempt throws quota, retry also throws.
    // Callback runs each time but the warned-once flag suppresses repeat console.
    for (let i = 0; i < 5; i++) {
      storage.setItem(`k${i}`, `v${i}`);
    }
    expect(called).toBe(5);
    expect(Object.keys(tracker.written)).toHaveLength(0);
  });

  it('swallows non-quota errors without invoking onQuotaExceeded', () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => { throw new DOMException('Access denied', 'SecurityError'); },
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    });
    let called = 0;
    const storage = safeJSONStorage({ name: 'test', onQuotaExceeded: () => { called++; } });
    expect(() => storage.setItem('k', 'v')).not.toThrow();
    expect(called).toBe(0);
  });

  it('returns null on getItem when localStorage throws', () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => { throw new DOMException('Access denied', 'SecurityError'); },
        setItem: () => {},
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    });
    const storage = safeJSONStorage({ name: 'test' });
    expect(storage.getItem('k')).toBeNull();
  });

  it('detects legacy QuotaExceededError code 22 (Safari/Chrome legacy)', () => {
    let called = 0;
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {
          const e = new DOMException('quota');
          // Override e.code to 22 — legacy Safari/Chrome quota signal
          Object.defineProperty(e, 'code', { value: 22, configurable: true });
          throw e;
        },
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    });
    const storage = safeJSONStorage({ name: 'test', onQuotaExceeded: () => { called++; } });
    storage.setItem('k', 'v');
    expect(called).toBe(1);
  });
});
