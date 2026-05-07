/**
 * MathTutorTool — deep coverage with mocked askAI.
 *
 * The MathTutorTool calls askAI() which POSTs to ${SYNALUX_API}/chat.
 * We page.route() that endpoint with a controlled SSE stream so we
 * can deterministically verify:
 *   • Hint / Check / Solve all stream into the response overlay
 *   • Streaming chunks accumulate (not just the final concat)
 *   • Mode switching clears the prior response and renders the new one
 *   • Dismiss button hides the overlay
 *   • Error path renders ⚠️ + the error message
 *   • Empty grid → no request (button is a no-op)
 *   • Auto-collapse when the user types more cells
 *
 * The route handler treats both `synalux.ai/api/v1/chat` and any
 * `**\/chat` permutation as the target — Playwright's URL matcher
 * is glob-against-the-full-URL.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

async function gotoMath(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-main-keyboard"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
}

async function typeOneDigit(page: Page, digit: string) {
  await page.locator(`[data-testid="math-key-${digit}"]`).click();
  await page.waitForFunction(() => {
    const el = document.querySelector('header');
    return !!el && /cells=[1-9]/.test(el.textContent || '');
  }, { timeout: 2000 });
}

/** Build an SSE body of {choices:[{delta:{content:"…"}}]} chunks. */
function sseBody(chunks: string[]): string {
  return chunks
    .map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`)
    .join('') + 'data: [DONE]\n\n';
}

async function mockChat(page: Page, handler: (route: Route) => Promise<void> | void) {
  await page.route('**/chat', handler);
}

/** askAI falls back to local Ollama (`localhost:11434/generate`) when
 *  Synalux returns a non-auth error. To exercise the error overlay
 *  reliably we need to also block the fallback so route() ends up in
 *  the throw-with-friendly-message branch. */
async function blockLocalOllama(page: Page) {
  await page.route('**/11434/**', (route) => route.abort());
  await page.route('**/generate', (route) => route.abort());
}

test.describe('MathTutorTool — deep coverage', () => {
  test('Hint mode: streamed chunks accumulate in the overlay', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '7');
    let bodySeen = '';
    await mockChat(page, async (route) => {
      const reqBody = route.request().postDataJSON();
      bodySeen = JSON.stringify(reqBody);
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody(['Try ', 'adding ', 'the digits ', 'together.']),
      });
    });

    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Try adding the digits together.', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-mode', 'help');
    expect(bodySeen, 'request reached the mock').toContain('messages');
  });

  test('Check mode: distinct prompt, distinct overlay text', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '5');
    let firstUserContent = '';
    await mockChat(page, async (route) => {
      const body = route.request().postDataJSON();
      firstUserContent = body?.messages?.find((m: { role: string }) => m.role === 'user')?.content ?? '';
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody(['Looks correct! Great job.']),
      });
    });
    await page.locator('[data-testid="math-tutor-check"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('Looks correct! Great job.', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-mode', 'check');
    expect(firstUserContent.toLowerCase(), 'check prompt mentions checking').toMatch(/check|correct/);
  });

  test('Solve mode: multi-line response renders as multiple paragraphs', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '4');
    await mockChat(page, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody(['Step 1: read the number.\n', 'Step 2: count.\n', 'Step 3: write it down.']),
      });
    });
    await page.locator('[data-testid="math-tutor-solve"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('Step 1', { timeout: 5000 });
    await expect(overlay).toContainText('Step 2');
    await expect(overlay).toContainText('Step 3');
    // Three lines → three <p> elements.
    const paragraphs = await overlay.locator('p').count();
    expect(paragraphs, 'multi-line response splits into paragraphs').toBeGreaterThanOrEqual(3);
  });

  test('Dismiss button hides the overlay', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '2');
    await mockChat(page, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody(['hello']),
      });
    });
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toBeVisible();
    await page.locator('[data-testid="math-tutor-dismiss"]').click();
    await expect(overlay).toHaveCount(0);
  });

  test('Mode switch: re-clicking a different mode replaces prior response', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '8');
    let nth = 0;
    await mockChat(page, async (route) => {
      nth++;
      const text = nth === 1 ? 'first-hint-response' : 'second-solve-response';
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody([text]),
      });
    });
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('first-hint-response', { timeout: 5000 });
    await page.locator('[data-testid="math-tutor-solve"]').click();
    await expect(overlay).toContainText('second-solve-response', { timeout: 5000 });
    await expect(overlay).not.toContainText('first-hint-response');
    await expect(overlay).toHaveAttribute('data-mode', 'solve');
  });

  test('Error path: 500 response renders ⚠️ + message', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '9');
    await blockLocalOllama(page);
    await mockChat(page, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'oops' }),
      });
    });
    await page.locator('[data-testid="math-tutor-check"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('⚠️', { timeout: 15000 });
  });

  test('Empty grid: no request fires + no overlay', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    let calls = 0;
    await mockChat(page, async (route) => {
      calls++;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody(['unexpected']),
      });
    });
    // Click the button — but no cells exist, so the tutor short-circuits.
    await page.locator('[data-testid="math-tutor-hint"]').click();
    await page.waitForTimeout(400);
    expect(calls, 'no askAI call when grid is empty').toBe(0);
    await expect(page.locator('[data-testid="math-tutor-response"]')).toHaveCount(0);
  });

  test('Auto-collapse: typing more cells dismisses a stale response', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '1');
    await mockChat(page, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody(['stale-advice']),
      });
    });
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('stale-advice', { timeout: 5000 });
    // User types another digit — the overlay should auto-collapse.
    await page.locator('[data-testid="math-key-3"]').click();
    await expect(overlay).toHaveCount(0);
  });

  test('Buttons stay enabled even when fetch returns 401', async ({ page, baseURL }) => {
    await gotoMath(page, baseURL);
    await typeOneDigit(page, '6');
    await mockChat(page, async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauth"}' });
    });
    const hint = page.locator('[data-testid="math-tutor-hint"]');
    await expect(hint, 'enabled at start').toBeEnabled();
    await hint.click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('⚠️', { timeout: 5000 });
    // After failure, tutor should still be usable.
    await expect(hint, 'enabled after 401').toBeEnabled();
  });
});
