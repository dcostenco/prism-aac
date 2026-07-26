import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { buildServiceWorkerKillswitchScript } from '@/lib/serviceWorkerKillswitch';

const KEY = 'prism-aac-sw-killswitch';
const VERSION = 'test-build';

async function executeKillswitch(options: {
  storedVersion?: string;
  registrationCount?: number;
  cacheKeys?: string[];
} = {}) {
  const storage = new Map<string, string>();
  if (options.storedVersion !== undefined) storage.set(KEY, options.storedVersion);

  const reload = vi.fn();
  const unregister = vi.fn().mockResolvedValue(true);
  const getRegistrations = vi.fn().mockResolvedValue(
    Array.from({ length: options.registrationCount ?? 0 }, () => ({ unregister })),
  );
  const deleteCache = vi.fn().mockResolvedValue(true);
  const getCacheKeys = vi.fn().mockResolvedValue(options.cacheKeys ?? []);

  runInNewContext(buildServiceWorkerKillswitchScript(VERSION), {
    window: {
      location: { hostname: 'preview.example.test', reload },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
    navigator: {
      serviceWorker: {
        addEventListener: vi.fn(),
        getRegistrations,
      },
    },
    caches: {
      keys: getCacheKeys,
      delete: deleteCache,
    },
    Promise,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { storage, reload, unregister, getRegistrations, deleteCache, getCacheKeys };
}

describe('service-worker kill switch', () => {
  it('records the build without reloading a first-time visitor', async () => {
    const result = await executeKillswitch();

    expect(result.storage.get(KEY)).toBe(VERSION);
    expect(result.reload).not.toHaveBeenCalled();
    expect(result.unregister).not.toHaveBeenCalled();
    expect(result.deleteCache).not.toHaveBeenCalled();
  });

  it('does no cleanup when the current build is already recorded', async () => {
    const result = await executeKillswitch({ storedVersion: VERSION });

    expect(result.getRegistrations).not.toHaveBeenCalled();
    expect(result.getCacheKeys).not.toHaveBeenCalled();
    expect(result.reload).not.toHaveBeenCalled();
  });

  it('unregisters a stale worker and reloads after a build change', async () => {
    const result = await executeKillswitch({
      storedVersion: 'old-build',
      registrationCount: 1,
    });

    expect(result.unregister).toHaveBeenCalledOnce();
    expect(result.reload).toHaveBeenCalledOnce();
  });

  it('deletes stale runtime caches but preserves precaches', async () => {
    const result = await executeKillswitch({
      storedVersion: 'old-build',
      cacheKeys: ['prism-navigation', 'serwist-precache-v1'],
    });

    expect(result.deleteCache).toHaveBeenCalledOnce();
    expect(result.deleteCache).toHaveBeenCalledWith('prism-navigation');
    expect(result.reload).toHaveBeenCalledOnce();
  });
});
