/**
 * searchKeyBridge — keyboard → category search routing
 *
 * Covers: isSearchKeyActive state, dispatchToSearch consumed / not,
 * handler receives correct char, null handler clears search mode,
 * re-registration replaces previous handler.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerSearchKeyHandler,
  dispatchToSearch,
  isSearchKeyActive,
} from '@/services/searchKeyBridge';

// Always clear handler after each test to avoid state leakage
beforeEach(() => {
  registerSearchKeyHandler(null);
  vi.clearAllMocks();
});

describe('searchKeyBridge — isSearchKeyActive', () => {
  it('returns false when no handler is registered', () => {
    expect(isSearchKeyActive()).toBe(false);
  });

  it('returns true after a handler is registered', () => {
    registerSearchKeyHandler(() => {});
    expect(isSearchKeyActive()).toBe(true);
  });

  it('returns false after handler is cleared with null', () => {
    registerSearchKeyHandler(() => {});
    registerSearchKeyHandler(null);
    expect(isSearchKeyActive()).toBe(false);
  });
});

describe('searchKeyBridge — dispatchToSearch', () => {
  it('returns false when no handler registered (key NOT consumed)', () => {
    expect(dispatchToSearch('a')).toBe(false);
  });

  it('returns true when handler is registered (key consumed)', () => {
    registerSearchKeyHandler(() => {});
    expect(dispatchToSearch('a')).toBe(true);
  });

  it('passes the character to the registered handler', () => {
    const handler = vi.fn();
    registerSearchKeyHandler(handler);
    dispatchToSearch('x');
    expect(handler).toHaveBeenCalledWith('x');
  });

  it('does NOT call handler after it is cleared', () => {
    const handler = vi.fn();
    registerSearchKeyHandler(handler);
    registerSearchKeyHandler(null);
    dispatchToSearch('z');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns false after handler is cleared', () => {
    registerSearchKeyHandler(() => {});
    registerSearchKeyHandler(null);
    expect(dispatchToSearch('q')).toBe(false);
  });

  it('re-registering replaces the previous handler', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    registerSearchKeyHandler(h1);
    registerSearchKeyHandler(h2);
    dispatchToSearch('m');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledWith('m');
  });

  it('dispatches multiple chars in sequence', () => {
    const handler = vi.fn();
    registerSearchKeyHandler(handler);
    dispatchToSearch('h');
    dispatchToSearch('i');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, 'h');
    expect(handler).toHaveBeenNthCalledWith(2, 'i');
  });
});
