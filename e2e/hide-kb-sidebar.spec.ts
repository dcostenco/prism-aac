import { test, expect } from '@playwright/test';
import path from 'node:path';

test('reproduce empty sidebar bug', async ({ page }) => {
  await page.goto('/');
  // Wait for the kb-cycle-btn to appear (it should be on the Home screen sidebar)
  await page.waitForSelector('[data-testid="kb-cycle-btn"]', { timeout: 30000 });
  
  const kbBtn = page.getByTestId('kb-cycle-btn');
  
  // 1. Initially closed. Click KB button to toggle (open drawer mode)
  await kbBtn.click();
  await page.waitForSelector('button[data-key="Q"]', { timeout: 10000 });
  
  // Take screenshot of drawer state
  await page.screenshot({ path: path.join('e2e', '_screenshots', 'after-kb-1.png') });
  
  // 2. Click KB button again (maximize mode)
  await kbBtn.click();
  await page.waitForTimeout(1000);
  
  // Take screenshot of maximized state
  await page.screenshot({ path: path.join('e2e', '_screenshots', 'after-kb-2.png') });
  
  // In the buggy version, the KB button was removed from the DOM when maximized.
  // We expect the KB button to still be visible and functional.
  await expect(kbBtn).toBeVisible();
  
  // 3. Click KB button again (close mode)
  await kbBtn.click();
  await page.waitForTimeout(1000);
  
  // Ensure keyboard is closed
  await expect(page.locator('button[data-key="Q"]')).toBeHidden();
});
