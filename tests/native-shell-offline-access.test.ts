import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportOfflineAccess } from '@/services/nativeShell';

type BridgeWindow = Window & { prismNativeBridge?: Record<string, unknown> };
afterEach(() => { delete (window as BridgeWindow).prismNativeBridge; });

describe('offline access report to the app', () => {
  it('passes the state to a bridge that can take it', () => {
    const offlineAccess = vi.fn();
    (window as BridgeWindow).prismNativeBridge = { offlineAccess };
    reportOfflineAccess({ policySeen: true, leaseUntil: 5 });
    expect(offlineAccess).toHaveBeenCalledWith({ policySeen: true, leaseUntil: 5 });
  });

  it('does nothing in a browser or an older build without the capability', () => {
    expect(() => reportOfflineAccess({ policySeen: true, leaseUntil: null })).not.toThrow();
    (window as BridgeWindow).prismNativeBridge = { speak: vi.fn() };
    expect(() => reportOfflineAccess({ policySeen: true, leaseUntil: null })).not.toThrow();
  });
});
