/**
 * Phase 6 — Chemistry / Physics / Programming integration tests.
 *
 * Per-tab assertions:
 *   1. Tab swap renders the new keyboard with domain-specific glyphs
 *   2. Tapping a domain glyph commits to the cell grid
 *   3. AI tutor uses a domain-aware prompt (mocked askAI captures
 *      the request body and we assert the prompt mentions chemistry /
 *      physics / Python / Java explicitly)
 *   4. Overlay's data-domain attribute matches the active tab
 *
 * The Programming keyboards have a Python⇄Java toggle exposed as two
 * separate categories (`programming-python`, `programming-java`) so
 * the tutor can pick distinct prompt templates.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

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

function sseBody(chunks: string[]): string {
  return chunks
    .map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`)
    .join('') + 'data: [DONE]\n\n';
}

async function blockLocalOllama(page: Page) {
  await page.route('**/11434/**', (route) => route.abort());
  await page.route('**/generate', (route) => route.abort());
}

interface ChatBody {
  messages: Array<{ role: string; content: string }>;
  source?: string;
}

async function captureChatPrompt(page: Page, response: string): Promise<() => string> {
  let captured = '';
  await page.route('**/chat', async (route: Route) => {
    const body = route.request().postDataJSON() as ChatBody;
    const userMsg = body?.messages?.find((m) => m.role === 'user')?.content ?? '';
    captured = userMsg;
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody([response]),
    });
  });
  return () => captured;
}

test.describe('Phase 6 — Chemistry tab', () => {
  test('chemistry chip swaps the keyboard panel and exposes element keys', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'chemistry');
    await expect(page.locator('[data-testid="math-chemistry-keyboard"]')).toBeVisible();
    // Element row has H / O / Cl / Na buttons.
    await expect(page.locator('[data-testid="math-chemistry-elements-hydrogen"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-chemistry-elements-oxygen"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-chemistry-elements-chlorine"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-chemistry-elements-sodium"]')).toBeVisible();
    // Reaction arrow + subscript exist on the ops row.
    await expect(page.locator('[data-testid="math-chemistry-ops-yields"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-chemistry-ops-subscript-2"]')).toBeVisible();
  });

  test('typing H + ₂ + O commits 3 cells', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'chemistry');
    await page.locator('[data-testid="math-chemistry-elements-hydrogen"]').click();
    await page.locator('[data-testid="math-chemistry-ops-subscript-2"]').click();
    await page.locator('[data-testid="math-chemistry-elements-oxygen"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cells=3/);
  });

  test('AI tutor uses a chemistry prompt + overlay data-domain=chemistry', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, 'chemistry');
    await page.locator('[data-testid="math-chemistry-elements-hydrogen"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(page, 'Try balancing the H atoms first.');
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('balancing the H atoms', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-domain', 'chemistry');
    expect(getPrompt().toLowerCase(), 'prompt mentions chemistry').toContain('chemistry');
  });
});

test.describe('Phase 6 — Physics tab', () => {
  test('physics chip swaps the keyboard panel and exposes greek + units', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'physics');
    await expect(page.locator('[data-testid="math-physics-keyboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-physics-greek-alpha"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-physics-greek-omega"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-physics-units-newton"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-physics-units-joule"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-physics-ops-integral"]')).toBeVisible();
  });

  test('typing α commits one cell containing the alpha glyph', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'physics');
    await page.locator('[data-testid="math-physics-greek-alpha"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cells=1/);
  });

  test('AI tutor uses a physics prompt + overlay data-domain=physics', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, 'physics');
    await page.locator('[data-testid="math-physics-greek-lambda"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(page, 'Recall λ = v / f.');
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('λ = v / f', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-domain', 'physics');
    expect(getPrompt().toLowerCase(), 'prompt mentions physics').toContain('physics');
  });
});

test.describe('Phase 6 — Programming tabs (Python + Java)', () => {
  test('python chip renders ops + python keywords', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    await expect(page.locator('[data-testid="math-programming-python-keyboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-kw-def"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-kw-print"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-ops-colon"]')).toBeVisible();
    // Java keywords MUST NOT be on the python tab.
    await expect(page.locator('[data-testid="math-java-kw-public"]')).toHaveCount(0);
  });

  test('java chip renders ops + java keywords', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-java');
    await expect(page.locator('[data-testid="math-programming-java-keyboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-java-kw-public"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-java-kw-class"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-java-ops-semicolon"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-python-kw-def"]')).toHaveCount(0);
  });

  test('python keywords commit char-by-char with a trailing space', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'programming-python');
    // "def" + space + "return" + space → 3 + 1 + 6 + 1 = 11 cells.
    // Code is character-driven on a monospace grid; stuffing whole
    // keywords into one cell made them visually collide with the
    // next cell (Phase 7 fix).
    await page.locator('[data-testid="math-python-kw-def"]').click();
    await page.locator('[data-testid="math-python-kw-return"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cells=11/);
  });

  test('python tutor uses a Python-flavoured prompt', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, 'programming-python');
    await page.locator('[data-testid="math-python-kw-def"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(page, 'You need a colon after the def.');
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('colon after the def', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-domain', 'programming-python');
    expect(getPrompt().toLowerCase(), 'prompt mentions Python').toContain('python');
  });

  test('java tutor uses a Java-flavoured prompt', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, 'programming-java');
    await page.locator('[data-testid="math-java-kw-public"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(page, 'Add a semicolon at the end.');
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('semicolon at the end', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-domain', 'programming-java');
    expect(getPrompt().toLowerCase(), 'prompt mentions Java').toContain('java');
  });

  test('switching Python → Java updates data-domain on the overlay', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    let nth = 0;
    await page.route('**/chat', async (route: Route) => {
      nth++;
      const text = nth === 1 ? 'python-response' : 'java-response';
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody([text]),
      });
    });

    await pickCategory(page, 'programming-python');
    await page.locator('[data-testid="math-python-kw-class"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toHaveAttribute('data-domain', 'programming-python');
    await expect(overlay).toContainText('python-response', { timeout: 5000 });

    // Switch to Java + commit a Java glyph + ask again.
    await pickCategory(page, 'programming-java');
    await page.locator('[data-testid="math-java-kw-public"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-tutor-hint"]').click();
    await expect(overlay).toHaveAttribute('data-domain', 'programming-java');
    await expect(overlay).toContainText('java-response', { timeout: 5000 });
  });
});
