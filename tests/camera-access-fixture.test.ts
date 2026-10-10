import { afterEach, expect, it, vi } from 'vitest';
import type { Page, Route, TestInfo } from '@playwright/test';
import { installLocalCameraAccess, localCameraAccessOrigin } from '../e2e/helpers/camera-access-fixture';

const LOCAL_ORIGIN = 'http://127.0.0.1:3119';
const REQUEST_CASES = [
  { path: '/prism-aac/api/v1/prism-aac/access', result: 'access' },
  { path: '/prism-aac/api/auth/session', result: 'offline' },
  { path: '/prism-aac/api/v1/speech', result: 'offline' },
  { path: 'https://example.invalid/api/speech', result: 'offline' },
  { path: 'https://example.invalid/vision.wasm', result: 'offline' },
  { path: '/prism-aac/models/mediapipe/wasm/vision_wasm_internal.js', result: 'real' },
  { path: '/prism-aac/models/mediapipe/wasm/vision_wasm_internal.wasm', result: 'real' },
  { path: '/prism-aac/models/mediapipe/face_landmarker.task', result: 'real' },
  { path: '/prism-aac/_next/static/app.js', result: 'real' },
] as const;

afterEach(() => vi.unstubAllEnvs());

it.each(REQUEST_CASES)('keeps $path $result without cloud billing or mocked model loading', async item => {
  vi.stubEnv('CAMERA_LOCAL_ACCESS_FIXTURE', '1');
  let handler!: (route: Route) => unknown;
  const page = { route: vi.fn((_pattern: string, callback: typeof handler) => { handler = callback; }) };
  const info = { annotations: [] };
  await installLocalCameraAccess(page as unknown as Page, LOCAL_ORIGIN, info as unknown as TestInfo);
  const route = { request: () => ({ url: () => new URL(item.path, LOCAL_ORIGIN).href }),
    fulfill: vi.fn(), continue: vi.fn() };
  const pattern = page.route.mock.calls[0][0];
  // Simulate route matching, not an unconditional handler call: the previous
  // access-only pattern left cloud requests entirely unintercepted.
  if (pattern === '**/*' || pattern === route.request().url()) await handler(route as unknown as Route);
  else await route.continue();
  if (item.result === 'real') {
    expect(route.continue).toHaveBeenCalledOnce(); expect(route.fulfill).not.toHaveBeenCalled();
  } else {
    expect(route.continue).not.toHaveBeenCalled();
    expect(route.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: item.result === 'access' ? 200 : 503 }));
    if (item.result === 'access') expect(JSON.parse(route.fulfill.mock.calls[0][0].body))
      .toEqual({ state: 'disabled', remainingMs: 0 });
  }
});

it('does not register any interception without explicit local opt-in', async () => {
  vi.stubEnv('CAMERA_LOCAL_ACCESS_FIXTURE', '0');
  const page = { route: vi.fn() };
  await installLocalCameraAccess(page as unknown as Page, 'https://synalux.ai', { annotations: [] } as unknown as TestInfo);
  expect(page.route).not.toHaveBeenCalled();
});

it('does nothing without explicit opt-in, including for deployed apps', () => {
  expect(localCameraAccessOrigin('https://synalux.ai', false)).toBeNull();
});
it.each(['http://localhost:3092', 'http://127.0.0.1:3092', 'http://[::1]:3092'])(
  'allows only the opted-in local origin %s', url => {
    expect(localCameraAccessOrigin(url, true)).toBe(new URL(url).origin);
  });
it.each(['https://synalux.ai', 'https://prism-aac.vercel.app', 'http://localhost.example.com',
  'http://localhost@evil.example', 'file:///localhost', undefined])(
  'fails closed for nonlocal or invalid %s', url => {
    expect(() => localCameraAccessOrigin(url, true)).toThrow();
  });
