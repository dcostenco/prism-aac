import type { Page, TestInfo } from '@playwright/test';

const OFFLINE_RESPONSE = { status: 503, contentType: 'application/json',
  body: JSON.stringify({ error: 'Offline local camera regression' }) };
const LOCAL_CAMERA_ACCESS_PATH = '/prism-aac/api/v1/prism-aac/access';
const LOCAL_CAMERA_ACCESS_RESPONSE = { status: 200, contentType: 'application/json',
  body: JSON.stringify({ state: 'disabled', remainingMs: 0 }) };

export function localCameraAccessOrigin(baseURL: string | undefined, enabled: boolean): string | null {
  if (!enabled) return null;
  const url = new URL(baseURL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Camera access fixture is allowed only on localhost, never a deployed app');
  }
  return url.origin;
}

export async function installLocalCameraAccess(page: Page, baseURL: string | undefined, info: TestInfo) {
  const origin = localCameraAccessOrigin(baseURL, process.env.CAMERA_LOCAL_ACCESS_FIXTURE === '1');
  if (!origin) return;
  info.annotations.push({ type: 'access-fixture', description: 'Local camera capability only; not authentication/cloud proof' });
  // Opted-in loopback tests only; never fabricate a signed-in identity.
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin && url.pathname === LOCAL_CAMERA_ACCESS_PATH) {
      return route.fulfill(LOCAL_CAMERA_ACCESS_RESPONSE);
    }
    // A loopback rewrite can still call the paid portal. Keep local model,
    // WASM and app assets real, but don't make cloud/auth calls in this fixture.
    if (url.pathname.includes('/api/') || url.origin !== origin) {
      return route.fulfill({ ...OFFLINE_RESPONSE, headers: {
        'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
      } });
    }
    return route.continue();
  });
}
