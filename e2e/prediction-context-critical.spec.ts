/**
 * Critical AAC prediction journey.
 *
 * A prediction is part of the user's authored voice. This real-browser path
 * verifies that contextual suggestions compose the intended message exactly
 * once, without an AI suggestion silently rewriting it.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function bootCleanEnglish(
  page: Page,
  options: { aiAssistance?: boolean; soundEnabled?: boolean } = {},
): Promise<void> {
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await page.evaluate((bootOptions) => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: {
        language: 'en',
        outputLanguage: 'en',
        aiAutocorrectEnabled: bootOptions.aiAssistance ?? false,
        // Cloud phrase sharing is a separate signed-in consent. Tests that
        // need it must enable it through Settings after auth has loaded.
        cloudPredictionEnabled: false,
        speechRate: 0.5,
        speechVolume: 1,
      },
      version: 19,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: {
        autoSpeak: false,
        soundEnabled: bootOptions.soundEnabled ?? false,
        activeTone: 'friendly',
        toneMode: 'auto',
      },
      version: 3,
    }));
  }, options);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });
  await expect(page.getByTestId('prediction-bar')).toBeVisible();
}

function silentWav(durationMs = 250): Buffer {
  const sampleRate = 8_000;
  const samples = Math.ceil(sampleRate * durationMs / 1_000);
  const dataBytes = samples * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  return wav;
}

async function enableCloudMemoryPredictions(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Settings$/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /accessibility/i }).click();

  const cloudToggle = dialog.getByRole('button', {
    name: /^Cloud Memory Predictions$/i,
  });
  await expect(cloudToggle).toBeEnabled({ timeout: 10_000 });
  await expect(cloudToggle).toHaveAttribute('aria-pressed', 'false');
  await cloudToggle.click();
  await expect(cloudToggle).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: /close settings/i }).click();
  await expect(dialog).toHaveCount(0);
}

async function selectPrediction(page: Page, word: string): Promise<void> {
  const prediction = page
    .getByTestId('prediction-bar')
    .getByRole('button', { name: new RegExp(`^Predict: ${word}$`, 'i') });
  await expect(prediction).toBeVisible({ timeout: 10_000 });
  await prediction.click();
}

async function safeScreenshot(page: Page, filePath: string): Promise<void> {
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception')).toHaveCount(0);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath, fullPage: false });
}

test('WebKit composes I need my mom once from contextual predictions', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('iphone'), 'iPhone WebKit regression');

  await bootCleanEnglish(page);
  const message = page.getByRole('status', { name: 'Message text' });

  await page.locator('button[data-key="I"]').click();
  await expect(message).toHaveText('I');

  await selectPrediction(page, 'need');
  await expect(message).toHaveText('I need');

  await selectPrediction(page, 'my');
  await expect(message).toHaveText('I need my');

  await selectPrediction(page, 'mom');
  await expect(message).toHaveText('I need my mom');
  await expect(message).not.toContainText('mom need');
  await expect(page.getByTestId('autocorrect-suggestion')).toHaveCount(0);

  await safeScreenshot(
    page,
    testInfo.outputPath('prediction-context-i-need-my-mom.png'),
  );
});

test('WebKit Play preserves an authored trailing one-character word', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('iphone'), 'iPhone WebKit regression');

  const ttsBodies: Array<{ text?: string; lang?: string }> = [];
  await page.route('**/api/v1/tts/public', async (route) => {
    ttsBodies.push(route.request().postDataJSON() as { text?: string; lang?: string });
    await route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: silentWav(),
    });
  });

  await bootCleanEnglish(page);
  const message = page.getByRole('status', { name: 'Message text' });
  for (const key of ['I', 'SPACE', 'N', 'E', 'E', 'D', 'SPACE', 'I']) {
    if (key === 'SPACE') {
      await page.locator('button[data-action="space"]').click();
    } else {
      await page.locator(`button[data-key="${key}"]`).click();
    }
  }
  await expect(message).toHaveText('I need I');
  expect(ttsBodies).toHaveLength(0);

  const soundToggle = page.getByRole('button', { name: /sound off/i });
  await soundToggle.click();
  await expect(page.getByRole('button', { name: /sound on/i })).toBeVisible();
  await page.locator('button.aac-speak').first().click();

  await expect.poll(() => ttsBodies.length, { timeout: 10_000 }).toBe(1);
  expect(ttsBodies[0]?.text?.replace(/[.!?]+$/u, '')).toBe('I need I');
  expect(ttsBodies[0]?.lang).toBe('en-US');
  await expect(message).toHaveText('I need I');

  await safeScreenshot(
    page,
    testInfo.outputPath('prediction-play-preserves-trailing-i.png'),
  );
});

test('WebKit keeps intercepted Prism memory advisory until its card is tapped', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('iphone'), 'iPhone WebKit regression');

  const predictionBodies: Array<{ text?: string; lang?: string }> = [];
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { email: 'aac-e2e@example.com', name: 'AAC E2E' },
      }),
    });
  });
  await page.route('**/api/v1/roles/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ aac_plan: 'free', is_platform_admin: false }),
    });
  });
  await page.route('**/api/v1/text/correct', async (route) => {
    const body = route.request().postDataJSON() as { text?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ corrected: body.text ?? '' }),
    });
  });
  await page.route('**/api/v1/prism-aac/predict', async (route) => {
    const body = route.request().postDataJSON() as { text?: string; lang?: string };
    predictionBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        words: body.text === 'I need my'
          ? ['grandma', 'help', 'water', 'home', 'please']
          : [],
      }),
    });
  });

  await bootCleanEnglish(page, { aiAssistance: true });
  await enableCloudMemoryPredictions(page);
  const message = page.getByRole('status', { name: 'Message text' });

  await page.locator('button[data-key="I"]').click();
  await selectPrediction(page, 'need');
  await selectPrediction(page, 'my');
  await expect(message).toHaveText('I need my');

  await expect.poll(
    () => predictionBodies.some((body) => body.text === 'I need my' && body.lang === 'en'),
    { timeout: 10_000 },
  ).toBe(true);
  const memoryCard = page
    .getByTestId('prediction-bar')
    .getByRole('button', { name: 'Predict: grandma' });
  await expect(memoryCard).toBeVisible();

  // A model response may change the cards, but never the authored message.
  await expect(message).toHaveText('I need my');
  await memoryCard.click();
  await expect(message).toHaveText('I need my grandma');
  await expect(message).not.toContainText('grandma grandma');

  await safeScreenshot(
    page,
    testInfo.outputPath('prediction-memory-explicit-card-accept.png'),
  );
});

test('WebKit shows correction text separately and applies it only on explicit tap', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('iphone'), 'iPhone WebKit regression');

  const correctionBodies: Array<{ text?: string; lang?: string; mode?: string }> = [];
  await page.route('**/api/v1/prism-aac/predict', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ words: [] }),
    });
  });
  await page.route('**/api/v1/text/correct', async (route) => {
    const body = route.request().postDataJSON() as {
      text?: string;
      lang?: string;
      mode?: string;
    };
    correctionBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        corrected: body.text === 'I ned my mom' ? 'I need my mom' : body.text ?? '',
      }),
    });
  });

  await bootCleanEnglish(page, { aiAssistance: true });
  const message = page.getByRole('status', { name: 'Message text' });
  for (const key of ['I', 'N', 'E', 'D']) {
    await page.locator(`button[data-key="${key}"]`).click();
    if (key === 'I') await page.locator('button[data-action="space"]').click();
  }
  await page.locator('button[data-action="space"]').click();
  for (const key of ['M', 'Y']) {
    await page.locator(`button[data-key="${key}"]`).click();
  }
  await page.locator('button[data-action="space"]').click();
  for (const key of ['M', 'O', 'M']) {
    await page.locator(`button[data-key="${key}"]`).click();
  }

  await expect(message).toHaveText('I ned my mom');
  const correction = page.getByTestId('autocorrect-suggestion');
  await expect(correction).toHaveText(/I need my mom/, { timeout: 10_000 });
  await expect.poll(
    () => correctionBodies.some((body) => (
      body.text === 'I ned my mom'
      && body.lang === 'en'
      && body.mode === 'complete'
    )),
  ).toBe(true);

  await expect(message).toHaveText('I ned my mom');
  await safeScreenshot(
    page,
    testInfo.outputPath('prediction-correction-before-explicit-accept.png'),
  );

  await correction.click();
  await expect(message).toHaveText('I need my mom');
});
