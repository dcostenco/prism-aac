/**
 * integrationsService::openConnectPopup + pythonRuntime::prewarmPython
 *
 * openConnectPopup calls window.open() and returns the result.
 * In jsdom, window.open returns null — the function must not throw.
 *
 * prewarmPython calls getWorker() which returns null in jsdom (no Worker
 * support), so the function resolves immediately as a no-op.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { openConnectPopup } from '@/services/integrationsService';
import { prewarmPython } from '@/services/pythonRuntime';

afterEach(() => {
  vi.restoreAllMocks();
});

// ── openConnectPopup ──────────────────────────────────────────────────────────

describe('openConnectPopup', () => {
  it('does not throw when window.open returns null (blocked popup)', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => openConnectPopup()).not.toThrow();
  });

  it('returns null when popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const result = openConnectPopup();
    expect(result).toBeNull();
  });

  it('calls window.open with about:blank', () => {
    const spy = vi.spyOn(window, 'open').mockReturnValue(null);
    openConnectPopup();
    expect(spy).toHaveBeenCalledWith('about:blank', 'synalux-connect', expect.any(String));
  });

  it('does not throw when window.open returns a mock popup', () => {
    const mockPopup = { focus: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(mockPopup);
    expect(() => openConnectPopup()).not.toThrow();
  });

  it('calls focus on the popup when available', () => {
    const mockPopup = { focus: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(mockPopup);
    openConnectPopup();
    expect(mockPopup.focus).toHaveBeenCalled();
  });
});

// ── prewarmPython ─────────────────────────────────────────────────────────────

describe('prewarmPython', () => {
  it('resolves without throwing when Worker is unavailable', async () => {
    await expect(prewarmPython()).resolves.toBeUndefined();
  });

  it('is callable multiple times without throwing', async () => {
    await prewarmPython();
    await prewarmPython();
  });

  it('returns a Promise', () => {
    const result = prewarmPython();
    expect(result instanceof Promise).toBe(true);
    return result; // clean up
  });
});
