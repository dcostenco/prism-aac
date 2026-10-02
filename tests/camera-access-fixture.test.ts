import { expect, it } from 'vitest';
import { localCameraAccessOrigin } from '../e2e/helpers/camera-access-fixture';

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
