/**
 * E2E for the 2026-08-15 "translation and prediction are bad" report (IMG_2433).
 *
 * These assert BEHAVIOUR the unit tests cannot reach: the real MessageBar effect
 * chain, the real debounce, and the real network. Each test performs a user
 * action and asserts the observable outcome.
 *
 * Run against a build that contains the fix:
 *   BASE_URL=http://localhost:3000/prism-aac npx playwright test e2e/aac-translation-trigger.spec.ts
 * The default BASE_URL is the live deploy, which will fail until this ships.
 */
import { test, expect, type Page, type Request } from '@playwright/test';

const EN_RO = {
  state: { language: 'en', outputLanguage: 'ro', aiAutocorrectEnabled: true, speechRate: 1, speechVolume: 0 },
  version: 0,
};

/** Records every cloud translate request the page issues. */
function trackTranslateRequests(page: Page): string[] {
  const sent: string[] = [];
  page.on('request', (req: Request) => {
    if (!req.url().includes('/prism-aac/chat')) return;
    try {
      const body = JSON.parse(req.postData() || '{}');
      if (body?.intent !== 'translate') return;
      const user = (body.messages || []).filter((m: { role: string }) => m.role === 'user').at(-1);
      if (user?.content) sent.push(String(user.content));
    } catch { /* not our payload */ }
  });
  return sent;
}

async function openBoard(page: Page) {
  await page.addInitScript((settings) => {
    localStorage.setItem('prism-aac-settings', JSON.stringify(settings));
  }, EN_RO);
  // baseURL already carries the /prism-aac basePath; goto('/') would strip it.
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="prediction-bar"]', { timeout: 30_000 });
}

/** Types on the in-app keyboard at a rate slower than the 200 ms debounce. */
async function typeSlowly(page: Page, text: string) {
  for (const ch of text) {
    if (ch === ' ') {
      await page.getByRole('button', { name: /^space$/i }).click();
    } else {
      const esc = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await page.getByRole('button', { name: new RegExp(`^${esc}$`, 'i') }).first().click();
    }
    await page.waitForTimeout(450);
  }
}

/** The phrase currently shown in the message bar, as the user sees it. */
async function composedText(page: Page): Promise<string> {
  return page.locator('[data-scan-group="message-bar"] [role="status"]').innerText()
    .then((t) => t.trim());
}

function tiles(page: Page): Promise<string[]> {
  return page.locator('[data-testid="prediction-bar"] button').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label')?.replace('Predict: ', '') ?? ''),
  );
}

test.describe('translation fires at a phrase boundary or on Play — not per keystroke', () => {
  test('typing an unfinished phrase sends no cloud translation', async ({ page }) => {
    const sent = trackTranslateRequests(page);
    await openBoard(page);

    await typeSlowly(page, 'I want water');
    await page.waitForTimeout(2000);

    // Before the fix this produced one request per keystroke, most of them
    // ending mid-word ("I wa", "I wat", ...).
    expect(sent, `unexpected mid-composition translations: ${JSON.stringify(sent)}`).toEqual([]);
  });

  test('closing the sentence sends exactly one translation of the whole phrase', async ({ page }) => {
    const sent = trackTranslateRequests(page);
    await openBoard(page);

    await typeSlowly(page, 'I want water');
    expect(sent).toEqual([]);

    await page.getByRole('button', { name: /^\.$/ }).first().click();
    await page.waitForTimeout(4000);

    expect(sent.length).toBe(1);
    // Compare against what is actually in the bar rather than a hard-coded
    // string: the invariant is "we translate the composed phrase", and pinning
    // exact keystroke fidelity would make this test about the keyboard.
    expect(sent[0]).toBe(await composedText(page));
  });

  test('Play translates an unpunctuated phrase on demand', async ({ page }) => {
    const sent = trackTranslateRequests(page);
    await openBoard(page);

    await typeSlowly(page, 'I want water');
    expect(sent).toEqual([]);

    await page.getByRole('button', { name: /^speak$/i }).first().click();
    await page.waitForTimeout(4000);

    expect(sent.length).toBeGreaterThanOrEqual(1);
    expect(sent[0]).toBe(await composedText(page));
  });

  test('the translation line never shows a forced Romanian pronoun for a typed "I"', async ({ page }) => {
    await openBoard(page);

    await typeSlowly(page, 'Now I can walk.');
    await page.waitForTimeout(5000);

    const bar = await page.locator('[data-scan-group="message-bar"]').innerText();
    // "Acum eu pot" was the shipped output; "Acum pot" is what both the model
    // and the offline dictionary actually produce.
    expect(bar).not.toMatch(/\beu pot\b/);
  });
});

test.describe('prediction context survives punctuation in the real app', () => {
  test('after "How are you? " the bar is contextual, not corpus filler', async ({ page }) => {
    await openBoard(page);

    await typeSlowly(page, 'How are you? ');
    await page.waitForTimeout(1500);

    const shown = (await tiles(page)).map((w) => w.toLowerCase());
    expect(shown.length).toBe(5);
    // Shipped behaviour was ["I","To","A","You","The"] — the top of the raw
    // frequency table, i.e. the n-gram context had been zeroed by the "?".
    const filler = ['i', 'to', 'a', 'the', 'you', 'and', 'of', 'it', 'is', 'in'];
    const fillerCount = shown.filter((w) => filler.includes(w)).length;
    expect(fillerCount, `bar was corpus filler: ${JSON.stringify(shown)}`).toBeLessThanOrEqual(2);
  });

  test('a finished word is not drowned by its own prefix look-alikes', async ({ page }) => {
    await openBoard(page);

    await typeSlowly(page, 'Now I can');
    await page.waitForTimeout(1500);

    const shown = (await tiles(page)).map((w) => w.toLowerCase());
    const lookAlikes = shown.filter((w) => w.startsWith('can') && w !== 'can');
    expect(lookAlikes.length, `bar: ${JSON.stringify(shown)}`).toBeLessThanOrEqual(1);
  });
});
