import type { Page, TestInfo } from '@playwright/test';

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
  // Intercept only the LOCAL app rewrite. Never mock a production portal
  // request or fabricate a signed-in identity/cloud credential.
  await page.route(`${origin}/prism-aac/api/v1/prism-aac/access`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'disabled', remainingMs: 0 }),
  }));
}
