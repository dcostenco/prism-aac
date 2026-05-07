/**
 * Phase 8 — History + Language Arts integration.
 *
 * Final two humanities tabs that round out the high-school
 * curriculum coverage. Mirrors the Phase 6 / 7 pattern:
 *   1. Tab swap mounts the right keyboard
 *   2. Representative glyph commits to the cell grid
 *   3. AI tutor uses a domain-specific prompt (mocked askAI
 *      captures the request body)
 *   4. Overlay's data-domain attribute matches the active tab
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
  await page.waitForTimeout(120);
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
}

async function captureChatPrompt(page: Page, response: string): Promise<() => string> {
  let captured = '';
  await page.route('**/chat', async (route: Route) => {
    const body = route.request().postDataJSON() as ChatBody;
    captured = body?.messages?.find((m) => m.role === 'user')?.content ?? '';
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody([response]),
    });
  });
  return () => captured;
}

test.describe('Phase 8 — History tab', () => {
  test('chip mounts the history keyboard with eras + centuries + periods + events (en default)', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'history');
    await expect(page.locator('[data-testid="math-history-keyboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-keyboard"]')).toHaveAttribute('data-locale', 'en');
    // Universal rows.
    await expect(page.locator('[data-testid="math-history-eras-before-common-era"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-eras-common-era"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-centuries-twentieth"]')).toBeVisible();
    // World periods always visible.
    await expect(page.locator('[data-testid="math-history-periods-stone-age"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-periods-medieval"]')).toBeVisible();
    // English-locale periods + events.
    await expect(page.locator('[data-testid="math-history-periods-renaissance"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-events-wwii-end"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-events-norman-conquest"]')).toBeVisible();
  });

  test('typing a universal year + CE commits 2 cells', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'history');
    await page.locator('[data-testid="math-history-events-fall-of-rome"]').click();
    await page.locator('[data-testid="math-history-eras-common-era"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cells=2/);
  });

  test('AI tutor history prompt includes the active locale (en default)', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, 'history');
    await page.locator('[data-testid="math-history-events-norman-conquest"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(page, '1066 is in the 11th century — early medieval period.');
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('11th century', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-domain', 'history');
    const prompt = getPrompt();
    expect(prompt.toLowerCase(), 'prompt mentions history').toContain('history');
    expect(prompt, 'locale signal in prompt').toMatch(/\ben\b/);
  });

  test('switching language to ro surfaces Romanian events + periods, hides English-only ones', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stores = (window as any).__devMathStores;
      stores.useSettingsStore.getState().update({ language: 'ro' });
    });
    await page.waitForTimeout(80);
    await pickCategory(page, 'history');
    const kb = page.locator('[data-testid="math-history-keyboard"]');
    await expect(kb).toHaveAttribute('data-locale', 'ro');
    // Romanian events appear.
    await expect(page.locator('[data-testid="math-history-events-stephen-the-great"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-events-romanian-revolution"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-periods-phanariot"]')).toBeVisible();
    // English-only events disappear.
    await expect(page.locator('[data-testid="math-history-events-norman-conquest"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="math-history-periods-victorian"]')).toHaveCount(0);
    // World universals still visible.
    await expect(page.locator('[data-testid="math-history-events-wwii-end"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-periods-medieval"]')).toBeVisible();
  });

  test('AI tutor prompt carries the locale signal (ro)', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stores = (window as any).__devMathStores;
      stores.useSettingsStore.getState().update({ language: 'ro' });
    });
    await page.waitForTimeout(80);
    await pickCategory(page, 'history');
    await page.locator('[data-testid="math-history-events-stephen-the-great"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(page, '1457 is when Stephen the Great became ruler of Moldavia.');
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('Stephen the Great', { timeout: 5000 });
    const prompt = getPrompt();
    expect(prompt, 'prompt mentions ro locale').toMatch(/\bro\b/);
    expect(prompt.toLowerCase(), 'prompt mentions curriculum').toContain('curriculum');
  });

  test('zh locale exposes Chinese dynastic events + period names', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stores = (window as any).__devMathStores;
      stores.useSettingsStore.getState().update({ language: 'zh' });
    });
    await page.waitForTimeout(80);
    await pickCategory(page, 'history');
    await expect(page.locator('[data-testid="math-history-keyboard"]')).toHaveAttribute('data-locale', 'zh');
    await expect(page.locator('[data-testid="math-history-events-tang-dynasty"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-events-prc-founding"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-history-periods-ming-dynasty-period"]')).toBeVisible();
  });
});

test.describe('Phase 8 — Language Arts tab', () => {
  test('chip mounts the LA keyboard with parts-of-speech + sentence types + punctuation + citation', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'language-arts');
    await expect(page.locator('[data-testid="math-language-arts-keyboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-la-pos-noun"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-la-pos-verb"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-la-pos-adjective"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-la-sentence-interrogative"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-la-cite-mla"]')).toBeVisible();
  });

  test('typing N V ADJ commits 3 part-of-speech tags', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, 'language-arts');
    await page.locator('[data-testid="math-la-pos-noun"]').click();
    await page.locator('[data-testid="math-la-pos-verb"]').click();
    await page.locator('[data-testid="math-la-pos-adjective"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cells=3/);
  });

  test('AI tutor uses a language-arts-flavoured prompt', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, 'language-arts');
    await page.locator('[data-testid="math-la-pos-verb"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(page, 'A verb is an action word.');
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText('action word', { timeout: 5000 });
    await expect(overlay).toHaveAttribute('data-domain', 'language-arts');
    expect(getPrompt().toLowerCase(), 'prompt mentions language-arts').toMatch(/language.arts/);
  });
});

test.describe('Phase 8 — full curriculum domain switch', () => {
  test('all 9 non-math domains route distinct prompts and tag the overlay correctly', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    let n = 0;
    await page.route('**/chat', async (route: Route) => {
      n++;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody([`r-${n}`]),
      });
    });

    const cases: Array<{ tab: string; tile: string; domain: string }> = [
      { tab: 'chemistry',          tile: 'math-chemistry-elements-hydrogen',     domain: 'chemistry' },
      { tab: 'physics',            tile: 'math-physics-greek-alpha',             domain: 'physics' },
      { tab: 'programming-python', tile: 'math-python-kw-def',                   domain: 'programming-python' },
      { tab: 'programming-java',   tile: 'math-java-kw-public',                  domain: 'programming-java' },
      { tab: 'biology',            tile: 'math-biology-nucleotides-adenine',     domain: 'biology' },
      { tab: 'statistics',         tile: 'math-stats-params-population-mean',    domain: 'statistics' },
      { tab: 'music',              tile: 'math-music-notes-quarter-note',        domain: 'music' },
      { tab: 'earth-science',      tile: 'math-earth-astro-mars',                domain: 'earth-science' },
      { tab: 'history',            tile: 'math-history-eras-common-era',         domain: 'history' },
      { tab: 'language-arts',      tile: 'math-la-pos-noun',                     domain: 'language-arts' },
    ];

    const overlay = page.locator('[data-testid="math-tutor-response"]');
    for (const c of cases) {
      await pickCategory(page, c.tab);
      await page.locator(`[data-testid="${c.tile}"]`).click();
      await page.waitForTimeout(60);
      await page.locator('[data-testid="math-tutor-hint"]').click();
      await expect(overlay).toHaveAttribute('data-domain', c.domain);
      await expect(overlay).toContainText(/r-\d/, { timeout: 5000 });
      await page.locator('[data-testid="math-tutor-dismiss"]').click();
      await page.waitForTimeout(60);
    }
    expect(n, '10 distinct tutor invocations').toBe(10);
  });
});
