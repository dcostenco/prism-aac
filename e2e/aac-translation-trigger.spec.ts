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

  // BOTH Speak controls, separately. They carry the SAME aria-label="Speak" —
  // MessageBar's ▶ and the keyboard's green key — so a `.first()` selector
  // silently tested only the former. That hid a real regression: the keyboard
  // key, which is the one users actually press, requested no translation at
  // all and spoke the offline dictionary's output.
  const SPEAK_CONTROLS = [
    { name: 'MessageBar Play', selector: 'button.aac-speak' },
    { name: 'keyboard Speak key', selector: '[data-testid="keyboard-shell"] button:has-text("Speak")' },
  ];

  for (const control of SPEAK_CONTROLS) {
    test(`${control.name} translates an unpunctuated phrase on demand`, async ({ page }) => {
      const sent = trackTranslateRequests(page);
      await openBoard(page);

      await typeSlowly(page, 'I want water');
      expect(sent, 'no translation should fire while composing').toEqual([]);

      await page.locator(control.selector).first().click();
      await page.waitForTimeout(4000);

      expect(sent.length, `${control.name} did not request a translation`).toBeGreaterThanOrEqual(1);
      expect(sent[0]).toBe(await composedText(page));
    });
  }

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

test.describe('what is SPOKEN matches what is SHOWN', () => {
  // The displayed translation and the spoken one come from different code
  // paths, and only the displayed one was ever asserted. Measured en->ro on
  // "I want water.": the bar showed "eu vreau apă." while the TTS payload was
  // "Vreau water." — the offline dictionary's half-translated mix, which
  // looksLikeTargetLang cannot reject because Romanian and English share the
  // Latin script. For an AAC user the spoken string IS the product.
  // KNOWN DEFECT, not yet fixed — kept as an executable reproduction.
  //
  // At a sentence end the DISPLAY gets the refined translation but the VOICE
  // does not. Measured en->ro on "I want water.": the bar showed
  // "eu vreau apă." while the TTS payload was "Vreau water." — the offline
  // dictionary's half-translated mix, which looksLikeTargetLang cannot reject
  // because Romanian and English share the Latin script.
  //
  // Root cause traced but NOT resolved: the keyboard's sentence-end handler
  // runs synchronously on the keypress and schedules a forced refine, then
  // MessageBar's translation effect schedules its own and clearTimeout()s the
  // first, so the speaker's refine never runs; a second refine then completed
  // and settled null. Two speakers (keyboard sentence-end and MessageBar's
  // composition timer) both race the same refine. Fixing it needs the refine
  // to be owned in one place rather than scheduled from three, which is a
  // larger change than this PR should carry into life-critical speech code.
  //
  // For an AAC user the spoken string IS the product, so this is worth fixing.
  test.fixme('sentence-end auto-speak sends the translated phrase to TTS, not a partial mix', async ({ page }) => {
    const ttsTexts: string[] = [];
    page.on('request', (req) => {
      if (!req.url().includes('/tts')) return;
      try {
        const b = JSON.parse(req.postData() || '{}');
        const t = b?.text ?? b?.ssml ?? b?.input;
        if (t) ttsTexts.push(String(t));
      } catch { /* non-JSON */ }
    });

    await page.addInitScript(() => {
      localStorage.setItem('prism-aac-settings', JSON.stringify({
        state: { language: 'en', outputLanguage: 'ro', speechVolume: 1, speechRate: 1 },
        version: 0,
      }));
    });
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30_000 });

    await typeSlowly(page, 'I want water');
    ttsTexts.length = 0;                       // ignore composition feedback
    await page.getByRole('button', { name: /^\.$/ }).first().click();
    await page.waitForTimeout(6000);

    const spoken = ttsTexts.join(' | ');
    expect(spoken, 'nothing was sent to TTS').not.toBe('');
    // The English source word must not survive into Romanian speech.
    expect(spoken.toLowerCase(), `spoken payload was: ${spoken}`).not.toMatch(/\bwater\b/);
    expect(spoken.toLowerCase(), `spoken payload was: ${spoken}`).toMatch(/ap[ăa]/);
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
