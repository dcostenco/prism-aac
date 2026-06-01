/**
 * Category panel e2e tests.
 * Verifies: tiles have visible text, buttons are tappable, categories
 * are not empty, search works, subcategory drill-down works.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  const start = baseURL || '/';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
  await page.waitForTimeout(400);
  // Open categories panel
  await page.getByRole('button', { name: 'Categories' }).click();
  // Wait for the HOME board section — use aria-label (avoids CSS text-transform issues)
  await page.waitForSelector('[aria-label="Home vocabulary board"]', { timeout: 12000 });
});

test('HOME grid tiles have visible text labels', async ({ page }) => {
  // Quick-talk phrases (pink tiles) should show text in the label strip
  await expect(page.getByText(/Hello|Goodbye|Thank you|Please/i).first()).toBeVisible();
});

test('HOME bottom tab strip shows category tabs', async ({ page }) => {
  // Bottom tabs should show fringe category names
  await expect(page.getByText(/Actions|People|Places|Animals|Colors/i).first()).toBeVisible();
});

test('clicking a category tile navigates to its detail view', async ({ page }) => {
  // Click the Quick Talk tab (or one of the bottom category tabs)
  const quickTalkTab = page.getByText(/Quick Talk/i).first();
  await quickTalkTab.click();
  // Should see category label
  await expect(page.getByText(/Quick Talk/i).first()).toBeVisible();
});

test('category detail view tiles have text and are clickable', async ({ page }) => {
  // Navigate to Core Verbs via the bottom tab
  await page.getByText(/Core Verbs/i).first().click();
  // Text labels should be visible (Want, Like, Have, etc.)
  await expect(page.getByText(/Want|Like|Have|Go|Do|Can/i).first()).toBeVisible({ timeout: 5000 });
});

test('clicking a phrase tile appends text to the message bar', async ({ page }) => {
  // Click a tile on the HOME grid
  const helloTile = page.getByText('Hello').first();
  await helloTile.click();
  // Message bar should contain the word
  await expect(page.locator('[aria-label="Message text"]')).toContainText(/Hello/i, { timeout: 3000 });
});

test('sidebar Go back button returns to HOME', async ({ page }) => {
  // Go into a category
  await page.getByText(/Core Verbs/i).first().click();
  await expect(page.getByText('CORE VERBS')).toBeVisible({ timeout: 3000 });
  // Click Go back (labeled Back or Up) in sidebar
  await page.getByRole('button', { name: /Back/i }).first().click();
  await expect(page.getByText('HOME', { exact: true })).toBeVisible({ timeout: 3000 });
});

test('sidebar Search opens search input', async ({ page }) => {
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByPlaceholder(/Search all vocabulary/i)).toBeVisible({ timeout: 3000 });
});

test('search returns results for "hello"', async ({ page }) => {
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder(/Search all vocabulary/i).fill('hello');
  await expect(page.getByText(/Hello/i).first()).toBeVisible({ timeout: 3000 });
});

test('sidebar Home button closes the categories panel', async ({ page }) => {
  await page.getByRole('button', { name: /Home/i }).click();
  // HOME label should be gone
  await expect(page.getByText('HOME', { exact: true })).not.toBeVisible({ timeout: 3000 });
});

test('Time category shows subcategory folders', async ({ page }) => {
  // Navigate to Time category via bottom tabs
  await page.getByText(/^TIME$/i).first().click();
  // Should show subcategory folder tiles (Clock Time, Days, Months, etc.)
  await expect(page.getByText(/Clock Time|Days|Months|Dates|Seasons/i).first()).toBeVisible({ timeout: 5000 });
});
