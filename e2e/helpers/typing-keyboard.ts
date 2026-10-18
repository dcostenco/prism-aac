import { expect, type Page } from '@playwright/test';

/** Current first-use UI opens the picture board. Enter typing through the
 * visible KB control, never by changing persisted preferences or app state. */
export async function showTypingKeyboard(page: Page) {
  const letter = page.locator('button[data-key="C"]');
  if (await letter.isVisible()) return;
  await page.getByTestId('kb-cycle-btn').click();
  await expect(letter).toBeVisible();
}
