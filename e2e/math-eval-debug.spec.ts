/**
 * Programming-suite e2e — visibility of 🧮 Eval / 🐛 Debug + math eval
 * happy path. Python and Java actual execution paths are NOT exercised
 * here (Pyodide CDN load and Piston API call would make CI brittle and
 * slow); they're verified by the unit tests for the evaluator services
 * and need a manual browser pass before claiming production-ready.
 */
import { test, expect, type Page } from '@playwright/test';

async function gotoDev(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-main-keyboard"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
}

async function pickCategory(page: Page, id: string) {
  await page.locator(`[data-testid="math-category-${id}"]`).click();
  await page.waitForTimeout(100);
}

test.describe('Eval button visibility per domain', () => {
  test('🧮 Eval is visible on math chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    // Default category is 'main' which maps to math domain.
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toBeVisible();
  });

  test('🧮 Eval is visible on physics chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'physics');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toBeVisible();
  });

  test('🧮 Eval is visible on statistics chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'statistics');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toBeVisible();
  });

  test('🧮 Eval is visible on programming-python chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toBeVisible();
  });

  test('🧮 Eval is visible on programming-java chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-java');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toBeVisible();
  });

  test('🧮 Eval is HIDDEN on chemistry chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'chemistry');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toHaveCount(0);
  });

  test('🧮 Eval is HIDDEN on biology chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'biology');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toHaveCount(0);
  });

  test('🧮 Eval is HIDDEN on music chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'music');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toHaveCount(0);
  });

  test('🧮 Eval is HIDDEN on history chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'history');
    await expect(page.locator('[data-testid="math-tutor-eval"]')).toHaveCount(0);
  });
});

test.describe('Debug button visibility per domain', () => {
  test('🐛 Debug is visible on programming-python chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    await expect(page.locator('[data-testid="math-tutor-debug"]')).toBeVisible();
  });

  test('🐛 Debug is HIDDEN on programming-java chip (no in-browser JVM)', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-java');
    await expect(page.locator('[data-testid="math-tutor-debug"]')).toHaveCount(0);
  });

  test('🐛 Debug is HIDDEN on math chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await expect(page.locator('[data-testid="math-tutor-debug"]')).toHaveCount(0);
  });

  test('🐛 Debug is HIDDEN on physics chip', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'physics');
    await expect(page.locator('[data-testid="math-tutor-debug"]')).toHaveCount(0);
  });

  test('switching python → math hides Debug, switching back shows it', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    await expect(page.locator('[data-testid="math-tutor-debug"]')).toBeVisible();
    await pickCategory(page, 'main');
    await expect(page.locator('[data-testid="math-tutor-debug"]')).toHaveCount(0);
    await pickCategory(page, 'programming-python');
    await expect(page.locator('[data-testid="math-tutor-debug"]')).toBeVisible();
  });
});

test.describe('Math 🧮 Eval — happy path (mathjs, no network)', () => {
  test('typing 2 + 3 then tapping Eval renders "= 5" in the overlay', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    // Type "2 + 3" via the main keyboard.
    await page.locator('[data-testid="math-key-2"]').click();
    await page.locator('[data-testid="math-key-plus"]').click();
    await page.locator('[data-testid="math-key-3"]').click();
    await page.locator('[data-testid="math-tutor-eval"]').click();
    await expect(page.locator('[data-testid="math-tutor-response"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-tutor-response"]')).toContainText('= 5');
    // Mode attribute should be 'eval', not 'help'/'check'/'solve'.
    await expect(page.locator('[data-testid="math-tutor-response"]')).toHaveAttribute('data-mode', 'eval');
  });

  test('typing nothing and tapping Eval is a no-op (no overlay)', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await page.locator('[data-testid="math-tutor-eval"]').click();
    // Overlay should not appear since there's nothing to evaluate.
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="math-tutor-response"]')).toHaveCount(0);
  });
});

test.describe('Programming chip → typeable identifiers (the surgical fix)', () => {
  test('python letters row exposes shift + page-toggle + 16 letters', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    await expect(page.locator('[data-testid="math-python-letters-row"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-letters-shift"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-letters-page-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-ltr-a"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-ltr-p"]')).toBeVisible();
    // q-z page should be reachable via toggle.
    await page.locator('[data-testid="math-python-letters-page-toggle"]').click();
    await expect(page.locator('[data-testid="math-python-ltr-q"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-ltr-z"]')).toBeVisible();
  });

  test('shift toggles letters to uppercase', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    // Initially lowercase.
    await expect(page.locator('[data-testid="math-python-ltr-a"]')).toContainText('a');
    await page.locator('[data-testid="math-python-letters-shift"]').click();
    // After shift, button should now show 'A'. The data-testid is
    // stable (always lowercased) but the visible text changes.
    await expect(page.locator('[data-testid="math-python-ltr-a"]')).toContainText('A');
  });

  test('python digit + underscore row is rendered', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    await expect(page.locator('[data-testid="math-python-digit-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-digit-9"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-underscore"]')).toBeVisible();
  });

  test('java letters row + digits + underscore are rendered', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-java');
    await expect(page.locator('[data-testid="math-java-letters-row"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-java-ltr-a"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-java-digit-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-java-underscore"]')).toBeVisible();
  });
});
