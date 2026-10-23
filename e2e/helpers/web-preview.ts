import { expect, type Page } from '@playwright/test';

/** Follow the ordinary visible input-mode control; the app may start on pictures. */
export async function openPreviewKeyboard(page: Page) {
  const key = page.locator('button[data-key="I"]');
  if (!await key.isVisible()) await page.getByTestId('kb-cycle-btn').click();
  await expect(key).toBeVisible();
  return key;
}
