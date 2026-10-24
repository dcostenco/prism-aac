import { expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ rules: [] as Array<{ matcher: (context: { url: URL; request: Request }) => boolean; handler: unknown }> }));
vi.mock('@serwist/next/worker', () => ({ defaultCache: [{ matcher: () => true, handler: 'cached-api-fallback' }] }));
vi.mock('serwist', () => ({
  Serwist: class { constructor(options: { runtimeCaching: typeof captured.rules }) { captured.rules = options.runtimeCaching; } addEventListeners() {} },
  NetworkOnly: class NetworkOnly {}, NetworkFirst: class {}, CacheFirst: class {}, ExpirationPlugin: class {},
}));

it('uses the network before cached API defaults for direct and rewritten billing identities, preserving offline navigation', async () => {
  await import('@/app/sw');
  for (const path of ['/api/v1/prism-aac/billing', '/api/v1/prism-aac/session',
    '/prism-aac/api/v1/prism-aac/billing', '/prism-aac/api/v1/prism-aac/session']) {
    const url = new URL(path, window.location.origin);
    const rule = captured.rules.find(rule => rule.matcher({ url, request: new Request(url) }));
    expect(rule?.handler?.constructor.name).toBe('NetworkOnly');
  }
  const url = new URL('/prism-aac', window.location.origin);
  const request = { mode: 'navigate', headers: new Headers() } as Request;
  const navigation = captured.rules.find(rule => rule.matcher({ url, request }));
  expect(navigation?.handler).toHaveProperty('handle');
});
