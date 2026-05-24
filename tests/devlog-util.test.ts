/**
 * lib/devLog — reportSwallowedError
 *
 * reportSwallowedError() is a curried logger: it returns a function that logs
 * to console.error in non-production environments and silently drops the error
 * in production. It guards promise-rejection swallowing patterns across the
 * codebase. This file covers all four meaningful branches.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportSwallowedError } from '@/lib/devLog';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('reportSwallowedError', () => {
  it('returns a function', () => {
    const handler = reportSwallowedError('poller');
    expect(typeof handler).toBe('function');
  });

  it('logs to console.error in test/dev environment', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = reportSwallowedError('my-scope');
    handler(new Error('test error'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('includes the scope string in the console.error output', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = reportSwallowedError('sync-poller');
    handler(new Error('boom'));
    const [msg] = spy.mock.calls[0];
    expect(String(msg)).toContain('sync-poller');
  });

  it('passes the error object to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('network timeout');
    reportSwallowedError('inbox')(err);
    expect(spy).toHaveBeenCalledWith(expect.any(String), err);
  });

  it('does not log in production (NODE_ENV = production)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = reportSwallowedError('prod-scope');
    handler(new Error('should be silent'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('handles non-Error values (string, number, null) without throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = reportSwallowedError('any-scope');
    expect(() => handler('string error')).not.toThrow();
    expect(() => handler(42)).not.toThrow();
    expect(() => handler(null)).not.toThrow();
    expect(() => handler(undefined)).not.toThrow();
  });

  it('multiple calls with the same handler all log correctly', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = reportSwallowedError('multi');
    handler(new Error('first'));
    handler(new Error('second'));
    handler(new Error('third'));
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('different scopes produce different log messages', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportSwallowedError('scope-a')(new Error('e'));
    reportSwallowedError('scope-b')(new Error('e'));
    const msgs = spy.mock.calls.map(([m]) => String(m));
    expect(msgs[0]).toContain('scope-a');
    expect(msgs[1]).toContain('scope-b');
  });
});
