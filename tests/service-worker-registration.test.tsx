import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import {
  PRISM_AAC_PUBLIC_PRECACHE_PATTERNS,
  PRISM_AAC_SERVICE_WORKER_PATH,
  PRISM_AAC_SERVICE_WORKER_SCOPE,
} from '@/lib/appPaths';
import {
  SERVICE_WORKER_KILLSWITCH_KEY,
  SERVICE_WORKER_RESET_READY_EVENT,
} from '@/lib/serviceWorkerKillswitch';
import { globSync } from 'glob';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('service-worker registration', () => {
  const register = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'test-build');
    window.localStorage.clear();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });
    register.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
