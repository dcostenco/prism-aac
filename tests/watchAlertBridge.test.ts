import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the alert dispatcher — we only want to verify the bridge routes the
// payload, not the underlying portal call.
vi.mock('@/services/sendAlertToCaregiver', () => ({
  sendAlertToCaregiver: vi.fn().mockResolvedValue({ ok: true, via: { id: 'p' } }),
}));

import { registerWatchAlertBridge } from '@/services/watchAlertBridge';
import { sendAlertToCaregiver } from '@/services/sendAlertToCaregiver';

describe('watchAlertBridge', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).prismOnWatchMessage;
    delete (window as unknown as Record<string, unknown>).__prismWatchBridgeInstalled;
    (sendAlertToCaregiver as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).prismOnWatchMessage;
    delete (window as unknown as Record<string, unknown>).__prismWatchBridgeInstalled;
  });

  it('installs window.prismOnWatchMessage on first call', () => {
    expect(window.prismOnWatchMessage).toBeUndefined();
    registerWatchAlertBridge();
    expect(typeof window.prismOnWatchMessage).toBe('function');
  });

  it('is idempotent — second call does not overwrite the handler', () => {
    registerWatchAlertBridge();
    const first = window.prismOnWatchMessage;
    registerWatchAlertBridge();
    expect(window.prismOnWatchMessage).toBe(first);
  });

  it('routes send_alert payload to sendAlertToCaregiver with the body', async () => {
    registerWatchAlertBridge();
    window.prismOnWatchMessage!({ type: 'send_alert', body: '⚠️ test alert' });
    // The handler dispatches asynchronously; flush microtasks.
    await Promise.resolve();
    expect(sendAlertToCaregiver).toHaveBeenCalledTimes(1);
    expect((sendAlertToCaregiver as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('⚠️ test alert');
  });

  it('routes send_message payload to sendAlertToCaregiver (v1: caregiver-first)', async () => {
    registerWatchAlertBridge();
    window.prismOnWatchMessage!({ type: 'send_message', body: 'composed message', to: '+15551234567' });
    await Promise.resolve();
    expect(sendAlertToCaregiver).toHaveBeenCalledTimes(1);
  });

  it('ignores unsupported types', async () => {
    registerWatchAlertBridge();
    window.prismOnWatchMessage!({ type: 'speak', body: 'hello' });
    await Promise.resolve();
    expect(sendAlertToCaregiver).not.toHaveBeenCalled();
  });

  it('ignores empty body', async () => {
    registerWatchAlertBridge();
    window.prismOnWatchMessage!({ type: 'send_alert', body: '   ' });
    await Promise.resolve();
    expect(sendAlertToCaregiver).not.toHaveBeenCalled();
  });
});
