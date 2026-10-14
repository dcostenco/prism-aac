import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import {
  buildServiceWorkerKillswitchScript,
  SERVICE_WORKER_KILLSWITCH_KEY,
  SERVICE_WORKER_RESET_READY_EVENT,
} from '@/lib/serviceWorkerKillswitch';

const KEY = SERVICE_WORKER_KILLSWITCH_KEY;
const VERSION = 'test-build';

async function executeKillswitch(options: {
  storedVersion?: string;
  registrationCount?: number;
  cacheKeys?: string[];
  hasController?: boolean;
  unregisterRejects?: boolean;
  preserveOffline?: boolean;
  hostname?: string;
  nativeBridge?: boolean;
  parentContext?: 'native' | 'web' | 'different-origin' | 'inaccessible';
} = {}) {
  const storage = new Map<string, string>();
  if (options.storedVersion !== undefined) storage.set(KEY, options.storedVersion);

  const reload = vi.fn();
  const unregister = options.unregisterRejects
    ? vi.fn().mockRejectedValue(new Error('unregister failed'))
    : vi.fn().mockResolvedValue(true);
  const getRegistrations = vi.fn().mockResolvedValue(
    Array.from({ length: options.registrationCount ?? 0 }, () => ({ unregister })),
  );
  const deleteCache = vi.fn().mockResolvedValue(true);
  const getCacheKeys = vi.fn().mockResolvedValue(options.cacheKeys ?? []);
  let controllerChange: (() => void) | undefined;
  const addEventListener = vi.fn((event: string, handler: () => void) => {
    if (event === 'controllerchange') controllerChange = handler;
  });
  const dispatchEvent = vi.fn();

  const hostname = options.hostname ?? 'preview.example.test';
  const testWindow = {
      location: { hostname, origin: `http://${hostname}`, reload },
      prismNativeBridge: options.nativeBridge ? {} : undefined,
      dispatchEvent,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      parent: null as unknown,
  };
  testWindow.parent = options.parentContext ? {
    location: { origin: options.parentContext === 'different-origin' ? 'https://different.example.test' : testWindow.location.origin },
    prismNativeBridge: options.parentContext === 'web' ? undefined : {},
  } : testWindow;
  if (options.parentContext === 'inaccessible') {
    Object.defineProperty(testWindow.parent, 'location', { get() { throw new Error('Cross-origin access denied'); } });
  }
  runInNewContext(buildServiceWorkerKillswitchScript(VERSION, options.preserveOffline), {
    window: testWindow,
    navigator: {
      serviceWorker: {
        controller: options.hasController ? {} : null,
        addEventListener,
        getRegistrations,
      },
    },
    caches: {
      keys: getCacheKeys,
      delete: deleteCache,
    },
    Promise,
    Event,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    storage,
    reload,
    unregister,
    getRegistrations,
    deleteCache,
    getCacheKeys,
    triggerControllerChange: () => controllerChange?.(),
    dispatchEvent,
    childNativeBridge: testWindow.prismNativeBridge,
  };
}

describe('service-worker kill switch', () => {
  it('keeps an installed worker and its app document during an offline-preserving update', async () => {
    const result = await executeKillswitch({ storedVersion: 'old-build', registrationCount: 1,
      cacheKeys: ['prism-core-navigation', 'serwist-precache-old', 'prism-static'], preserveOffline: true });
    expect(result.unregister).not.toHaveBeenCalled();
    expect(result.deleteCache).not.toHaveBeenCalled();
    expect(result.reload).not.toHaveBeenCalled();
    expect(result.storage.get(KEY)).toBe(VERSION);
    expect(result.dispatchEvent).toHaveBeenCalledOnce();
  });
  it('retains a worker for the native app on its trusted loopback test origin', async () => {
    const result = await executeKillswitch({ hostname: 'localhost', nativeBridge: true,
      preserveOffline: true, registrationCount: 1, cacheKeys: ['prism-core-navigation'] });
    expect(result.unregister).not.toHaveBeenCalled();
    expect(result.deleteCache).not.toHaveBeenCalled();
    expect(result.storage.get(KEY)).toBe(VERSION);
  });

  it('keeps ordinary local browser development free of installed workers', async () => {
    const result = await executeKillswitch({ hostname: 'localhost', preserveOffline: true,
      registrationCount: 1, cacheKeys: ['prism-core-navigation'] });
    expect(result.unregister).toHaveBeenCalledOnce();
    expect(result.deleteCache).toHaveBeenCalledWith('prism-core-navigation');
    expect(result.storage.get(KEY)).toBeUndefined();
  });

  it('keeps native offline storage for an unmarked same-origin child without copying its parent native bridge', async () => {
    const result = await executeKillswitch({ hostname: 'localhost', parentContext: 'native',
      preserveOffline: true, registrationCount: 1, cacheKeys: ['prism-core-navigation', 'serwist-precache'] });
    expect(result.unregister).not.toHaveBeenCalled();
    expect(result.deleteCache).not.toHaveBeenCalled();
    expect(result.storage.get(KEY)).toBe(VERSION);
    expect(result.childNativeBridge).toBeUndefined();
  });

  it.each(['web', 'different-origin', 'inaccessible'] as const)('does not inherit native context from a %s parent', async parentContext => {
    const result = await executeKillswitch({ hostname: 'localhost', parentContext,
      preserveOffline: true, registrationCount: 1, cacheKeys: ['prism-core-navigation'] });
    expect(result.unregister).toHaveBeenCalledOnce();
    expect(result.deleteCache).toHaveBeenCalledWith('prism-core-navigation');
    expect(result.storage.get(KEY)).toBeUndefined();
  });

  it('does not turn a non-preserving build into a native offline build through its parent', async () => {
    const result = await executeKillswitch({ hostname: 'localhost', parentContext: 'native',
      preserveOffline: false, registrationCount: 1, cacheKeys: ['prism-core-navigation'] });
    expect(result.unregister).toHaveBeenCalledOnce();
    expect(result.deleteCache).toHaveBeenCalledWith('prism-core-navigation');
  });

  it('records the build without reloading a first-time visitor', async () => {
    const result = await executeKillswitch();

    expect(result.storage.get(KEY)).toBe(VERSION);
    result.triggerControllerChange();
    expect(result.reload).not.toHaveBeenCalled();
    expect(result.unregister).not.toHaveBeenCalled();
    expect(result.deleteCache).not.toHaveBeenCalled();
    expect(result.dispatchEvent).toHaveBeenCalledOnce();
    expect(result.dispatchEvent.mock.calls[0][0].type).toBe(
      SERVICE_WORKER_RESET_READY_EVENT,
    );
  });

  it('reloads once when an already-controlled page receives a replacement worker', async () => {
    const result = await executeKillswitch({
      storedVersion: VERSION,
      hasController: true,
    });

    result.triggerControllerChange();
    result.triggerControllerChange();
    expect(result.reload).toHaveBeenCalledOnce();
    expect(result.dispatchEvent).not.toHaveBeenCalled();
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

  it('does not record the new build when stale-worker cleanup fails', async () => {
    const result = await executeKillswitch({
      storedVersion: 'old-build',
      registrationCount: 1,
      unregisterRejects: true,
    });

    expect(result.storage.get(KEY)).toBe('old-build');
    expect(result.reload).not.toHaveBeenCalled();
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
