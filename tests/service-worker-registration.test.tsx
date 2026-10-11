import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import {
  PRISM_AAC_PUBLIC_PRECACHE_PATTERNS,
  PRISM_AAC_SERVICE_WORKER_PATH,
  PRISM_AAC_SERVICE_WORKER_SCOPE,
  PRISM_AAC_BASE_PATH,
  PRISM_AAC_OFFLINE_NAVIGATION_HEADER,
} from '@/lib/appPaths';
import {
  SERVICE_WORKER_KILLSWITCH_KEY,
  SERVICE_WORKER_RESET_READY_EVENT,
} from '@/lib/serviceWorkerKillswitch';
import { globSync } from 'glob';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AAC_BUILD_REPORT, AAC_BUILD_REQUEST } from '@/lib/offlinePrecacheRetention';
const { prepare } = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock('@/services/bundledPicturePack', () => ({ preparePictureStorage: prepare }));

describe('service-worker registration', () => {
  const register = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'test-build');
    window.localStorage.clear();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: Object.assign(new EventTarget(), { register, controller: null, ready: Promise.resolve({}) }),
    });
    register.mockClear();
    prepare.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('registers one worker whose scope includes the canonical document', async () => {
    window.localStorage.setItem(
      SERVICE_WORKER_KILLSWITCH_KEY,
      'test-build',
    );
    render(<ServiceWorkerRegistrar />);
    fireEvent(window, new Event('load'));

    await waitFor(() => {
      expect(register).toHaveBeenCalledOnce();
    });
    expect(register).toHaveBeenCalledWith(PRISM_AAC_SERVICE_WORKER_PATH, {
      scope: PRISM_AAC_SERVICE_WORKER_SCOPE,
    });
    expect(PRISM_AAC_SERVICE_WORKER_SCOPE).toBe('/prism-aac');
  });

  it('waits for successful kill-switch cleanup before registering', async () => {
    render(<ServiceWorkerRegistrar />);
    fireEvent(window, new Event('load'));
    expect(register).not.toHaveBeenCalled();

    window.localStorage.setItem(
      SERVICE_WORKER_KILLSWITCH_KEY,
      'test-build',
    );
    fireEvent(window, new Event(SERVICE_WORKER_RESET_READY_EVENT));

    await waitFor(() => {
      expect(register).toHaveBeenCalledOnce();
    });
  });

  it('preserves old pictures by finishing migration before a worker can clean its precache', async () => {
    let finish!: () => void;
    prepare.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    window.localStorage.setItem(SERVICE_WORKER_KILLSWITCH_KEY, 'test-build');
    render(<ServiceWorkerRegistrar />);
    fireEvent(window, new Event('load'));
    expect(register).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(register).toHaveBeenCalledOnce());
  });
  it('warms the offline app document on first installation without another page visit', async () => {
    window.localStorage.setItem(SERVICE_WORKER_KILLSWITCH_KEY, 'test-build');
    Object.defineProperty(navigator.serviceWorker, 'controller', { value: {}, configurable: true });
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    render(<ServiceWorkerRegistrar />);
    fireEvent(window, new Event('load'));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(PRISM_AAC_BASE_PATH, {
      credentials: 'same-origin', cache: 'no-store', headers: { [PRISM_AAC_OFFLINE_NAVIGATION_HEADER]: '1' },
    });
  });

  it('reports the loaded build after activation and answers worker requests', async () => {
    window.localStorage.setItem(SERVICE_WORKER_KILLSWITCH_KEY, 'test-build');
    const postMessage = vi.fn();
    Object.defineProperty(navigator.serviceWorker, 'controller', { value: { postMessage }, configurable: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    const { unmount } = render(<ServiceWorkerRegistrar />);
    fireEvent(window, new Event('load'));
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: AAC_BUILD_REPORT, buildId: 'test-build' }));
    postMessage.mockClear();
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: AAC_BUILD_REQUEST } }));
    expect(postMessage).toHaveBeenCalledWith({ type: AAC_BUILD_REPORT, buildId: 'test-build' });
    unmount(); postMessage.mockClear();
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: AAC_BUILD_REQUEST } }));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('uses the Webpack deploy build and defers optional model downloads', () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve('vercel.json'), 'utf8'),
    );
    const packageJson = JSON.parse(
      readFileSync(resolve('package.json'), 'utf8'),
    );
    const publicPrecache = globSync(PRISM_AAC_PUBLIC_PRECACHE_PATTERNS, {
      cwd: resolve('public'),
      nodir: true,
    });

    expect(vercelConfig.buildCommand).toBe('npm run build');
    expect(packageJson.scripts.build).toContain('next build --webpack');
    expect(publicPrecache).toContain('manifest.json');
    expect(
      publicPrecache.some((file) => file.startsWith('models/')),
    ).toBe(false);
  });
});
