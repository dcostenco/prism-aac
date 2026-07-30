/**
 * Legacy Supabase device sync has no authenticated-account or language key.
 * It must never read or write prediction personalization, because a stale
 * remote response could otherwise contaminate the active AAC user's cards.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const syncMocks = vi.hoisted(() => ({
  push: vi.fn(async () => undefined),
  pushKeepalive: vi.fn(),
  pull: vi.fn(),
  subscriber: null as ((value: Record<string, unknown>) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock('@/services/syncService', () => ({
  pushToCloud: (...args: unknown[]) => syncMocks.push(...args),
  pushToCloudKeepalive: (...args: unknown[]) => syncMocks.pushKeepalive(...args),
  pullFromCloud: (...args: unknown[]) => syncMocks.pull(...args),
  subscribeToChanges: (callback: (value: Record<string, unknown>) => void) => {
    syncMocks.subscriber = callback;
    return syncMocks.unsubscribe;
  },
  mergeCustomItems: (local: unknown[]) => local,
  mergeHistory: (local: unknown[]) => local,
  onSyncStatus: () => () => {},
  isSupabaseConfigured: () => true,
}));

const { default: SyncProvider } = await import('@/components/SyncProvider');
const { usePredictionStore } = await import('@/store/predictionStore');
const { useAuthStore } = await import('@/store/authStore');
const { useSettingsStore } = await import('@/store/settingsStore');

beforeEach(() => {
  vi.useFakeTimers();
  syncMocks.push.mockClear();
  syncMocks.pushKeepalive.mockClear();
  syncMocks.pull.mockReset();
  syncMocks.subscriber = null;
  syncMocks.unsubscribe.mockClear();

  useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
  useAuthStore.setState({
    profile: {
      email: 'sync-isolation@example.com',
      name: 'Sync Isolation',
      plan: 'free',
      isPlatformAdmin: false,
    },
    loaded: true,
    loading: false,
  });
  usePredictionStore.getState().learnWord('localonlyzzq');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SyncProvider prediction isolation', () => {
  it('ignores pulled/realtime prediction maps and never pushes local maps', async () => {
    let resolveUserAPull!: (value: Record<string, unknown>) => void;
    syncMocks.pull.mockReturnValue(new Promise((resolve) => {
      resolveUserAPull = resolve;
    }));

    render(
      <SyncProvider>
        <div>child</div>
      </SyncProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(usePredictionStore.getState().wordFreq.localonlyzzq).toBeDefined();

    // The active portal account changes while User A's pull is pending.
    act(() => {
      useAuthStore.setState({
        profile: {
          email: 'sync-user-b@example.com',
          name: 'Sync User B',
          plan: 'free',
          isPlatformAdmin: false,
        },
      });
    });
    expect(usePredictionStore.getState().wordFreq.localonlyzzq).toBeUndefined();

    await act(async () => {
      resolveUserAPull({
        word_freq: {
          stalepullzzq: { count: 100_000, lastUsed: Date.now() },
        },
        bigrams: {
          'private|routine': { count: 100_000, lastUsed: Date.now() },
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(usePredictionStore.getState().wordFreq.stalepullzzq).toBeUndefined();

    act(() => {
      syncMocks.subscriber?.({
        word_freq: {
          stalerealtimezzq: { count: 100_000, lastUsed: Date.now() },
        },
        bigrams: {
          'another|private': { count: 100_000, lastUsed: Date.now() },
        },
      });
    });
    expect(usePredictionStore.getState().wordFreq.stalerealtimezzq).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    await usePredictionStore.persist.rehydrate();
    expect(usePredictionStore.getState().wordFreq.stalepullzzq).toBeUndefined();
    expect(usePredictionStore.getState().wordFreq.stalerealtimezzq).toBeUndefined();

    expect(syncMocks.push).toHaveBeenCalled();
    for (const [payload] of syncMocks.push.mock.calls) {
      expect(payload).not.toHaveProperty('word_freq');
      expect(payload).not.toHaveProperty('bigrams');
    }
  });
});
