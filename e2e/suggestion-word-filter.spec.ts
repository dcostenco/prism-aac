import { expect, test, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

// Hermetic local-model responses exercise the real MessageBar and prediction
// engine. They are not a provider safety or audible-device acceptance test.
const CASES = [
  { language: 'en', input: 'kil', completion: 'kill', blocked: true },
  { language: 'en', input: 'di', completion: 'died', blocked: true },
  { language: 'en', input: 'dy', completion: 'dying', blocked: true },
  { language: 'en', input: 'die', completion: 'diet', blocked: false },
  { language: 'en', input: 'kil', completion: 'kilometers', blocked: false },
  { language: 'en', input: 'kill', completion: 'kill', blocked: true },
  { language: 'de', input: 'die Banan', completion: 'die Banane', blocked: false },
  { language: 'en', input: 'бля', completion: 'блядь', blocked: true },
  { language: 'uk', input: 'Я хочу поме', completion: 'Я хочу померти', blocked: true },
  { language: 'bg', input: 'Искам да ум', completion: 'Искам да умра', blocked: true },
  { language: 'fr', input: 'Je suis en reta', completion: 'Je suis en retard', blocked: false },
  { language: 'de', input: 'Die Jacke ist zu dic', completion: 'Die Jacke ist zu dick', blocked: false },
  { language: 'en', input: "He'll be hom", completion: "He'll be home", blocked: false },
  { language: 'en', input: 'He’ll be hom', completion: 'He’ll be home', blocked: false },
  { language: 'zh-Hans', input: '我们去操', completion: '我们去操场', blocked: false },
  { language: 'zh-Hant', input: '你在幹', completion: '你在幹嘛', blocked: false },
  { language: 'zh-Hans', input: '妈妈', completion: '妈妈的', blocked: false },
  { language: 'ja', input: 'たべたば', completion: 'たべたばかり', blocked: false },
  { language: 'ja', input: '考え', completion: '考えろ', blocked: false },
  { language: 'zh-Hans', input: '他想自', completion: '他想自杀', blocked: true },
  { language: 'uk', input: 'Я тебе вб', completion: "Я тебе вб'ю", blocked: true },
  { language: 'ja', input: '死にた', completion: '死にたい', blocked: true },
] as const;
const BLOCKED_TILE = /^(?:kill(?:s|ed|ing|ings|er|ers)?|die[sd]?|dying)$/i;

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } finally { await context.close(); }
});

async function typeOnKeyboard(page: Page, text: string) {
  const key = (letter: string) => page.locator(
    `[data-scan-group="keyboard"] button[data-key="${letter.toUpperCase()}"]`,
  ).first();
  if (!await key(text[0]).isVisible()) await page.getByTestId('kb-cycle-btn').click();
  for (const letter of text) await key(letter).click();
  await expect(page.getByTestId('message-text')).toHaveText(new RegExp(`^${text}$`, 'i'));
}

for (const scenario of CASES) {
  test(`${scenario.input} -> ${scenario.completion}: ${scenario.blocked ? 'withheld' : 'offered'}`, async ({ page, baseURL }, testInfo) => {
    if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) {
      throw new Error('This provider-fixture test requires a loopback BASE_URL');
    }
    const errors: string[] = [];
    const completed: string[] = [];
    const requestedSpeech: string[] = [];
    await page.addInitScript((language) => {
      localStorage.setItem('prism-aac-settings', JSON.stringify({
        state: { language, outputLanguage: language, aiAutocorrectEnabled: true }, version: 22,
      }));
      const observed = window as Window & { __wordFilterSpeech?: string[] };
      observed.__wordFilterSpeech = [];
      const original = window.speechSynthesis?.speak?.bind(window.speechSynthesis);
      if (original) window.speechSynthesis.speak = (utterance) => {
        observed.__wordFilterSpeech!.push(utterance.text);
        original(utterance);
      };
    }, scenario.language);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: {} }));
    await page.route('**/api/v1/**', async (route) => {
      if (route.request().url().includes('/tts') && route.request().method() === 'POST') {
        const text = route.request().postDataJSON()?.text;
        if (typeof text === 'string') requestedSpeech.push(text);
      }
      await route.fulfill({ status: 503, json: {} });
    });
    await page.route('http://localhost:11434/**', async (route) => {
      if (new URL(route.request().url()).pathname === '/api/tags') {
        await route.fulfill({ json: { models: [{ name: 'prism-coder:14b' }] } });
        return;
      }
      const prompt = route.request().postDataJSON()?.prompt ?? '';
      const encoded = /Input: (".*")$/.exec(prompt)?.[1];
      const input = encoded ? JSON.parse(encoded) as string : '';
      await route.fulfill({ json: { response: input.toLowerCase() === scenario.input.toLowerCase() ? scenario.completion : input } });
      completed.push(input.toLowerCase());
    });
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('prediction-bar')).toBeVisible();
    if (/^[a-z]+$/.test(scenario.input)) await typeOnKeyboard(page, scenario.input);
    else if (/^[\x00-\x7F]+$/.test(scenario.input)) await page.keyboard.type(scenario.input);
    else {
      // Playwright type() inserts non-US characters without keydown. Exercise
      // the app's OS-layout keydown handler explicitly, without mutating a store.
      for (const key of scenario.input) await page.dispatchEvent('body', 'keydown', { key, bubbles: true });
    }
    await expect.poll(() => completed.includes(scenario.input.toLowerCase())).toBe(true);
    // Let the fulfilled local-model response reach the debounced React effect.
    await page.waitForTimeout(250);

    const suggestion = page.getByTestId('autocorrect-suggestion');
    if (scenario.blocked) {
      await expect(suggestion).toHaveCount(0);
    } else {
      await expect(suggestion).toHaveText(new RegExp(scenario.completion, 'i'));
    }
    const tiles = await page.getByTestId('prediction-bar').getByRole('button').allTextContents();
    if (scenario.blocked) {
      const withheldWord = scenario.completion.split(/\s+/).at(-1)!.toLowerCase();
      expect(tiles.map((word) => word.trim().toLowerCase())).not.toContain(withheldWord);
    }
    if (scenario.language === 'en') {
      expect(tiles.map((word) => word.trim()).filter((word) => BLOCKED_TILE.test(word))).toEqual([]);
    }
    await expect(page.getByTestId('message-text')).toHaveText(new RegExp(`^${scenario.input}$`, 'i'));

    if ((scenario.input === 'kil' && scenario.completion === 'kill') || scenario.completion === 'diet') {
      await safeScreenshot(page, testInfo.outputPath(`${scenario.input}-${scenario.completion}.png`), {
        expectedPath: '/prism-aac',
        requiredSelectors: ['[data-testid="message-text"]', '[data-testid="prediction-bar"]'],
        criticalSelectors: ['[data-testid="message-text"]', '[data-scan-group="message-bar"] button.aac-speak'],
      });
    }
    if (!scenario.blocked) {
      await suggestion.click();
      await expect(page.getByTestId('message-text')).toHaveText(new RegExp(`^${scenario.completion}$`, 'i'));
    }
    await page.locator('[data-scan-group="message-bar"] button.aac-speak').click();
    const authored = scenario.blocked ? scenario.input : scenario.completion;
    await expect.poll(async () => {
      const local = await page.evaluate(() => (window as Window & { __wordFilterSpeech?: string[] }).__wordFilterSpeech ?? []);
      return [...requestedSpeech, ...local].some((text) => text.trim().replace(/[.!?]+$/, '').toLowerCase() === authored.toLowerCase());
    }, { timeout: 10_000 }).toBe(true);
    // This proves speech dispatch, not audible provider/device delivery.
    expect(errors).toEqual([]);
  });
}
