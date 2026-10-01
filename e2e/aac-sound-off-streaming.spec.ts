import { expect, test, type Page, type Route } from '@playwright/test';

function sseBody(text: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
}

function toneWav(durationSeconds = 4): Buffer {
  const sampleRate = 16_000;
  const sampleCount = sampleRate * durationSeconds;
  const dataBytes = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < sampleCount; i++) {
    const sample = Math.round(Math.sin(2 * Math.PI * 220 * i / sampleRate) * 1200);
    wav.writeInt16LE(sample, 44 + i * 2);
  }
  return wav;
}

async function installAudioTrace(page: Page) {
  await page.addInitScript(() => {
    const browserWindow = window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
      __muteTrace?: () => { starts: number; stops: number; active: number };
    };
    let starts = 0;
    let stops = 0;
    let active = 0;
    const Original = browserWindow.AudioContext || browserWindow.webkitAudioContext;
    if (!Original) return;
    const Wrapped = function (...args: ConstructorParameters<typeof AudioContext>) {
      const context = new Original(...args);
      const createBufferSource = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const source = createBufferSource();
        const start = source.start.bind(source);
        const stop = source.stop.bind(source);
        let countedActive = false;
        source.start = (...startArgs) => {
          starts += 1;
          active += 1;
          countedActive = true;
          return start(...startArgs);
        };
        source.stop = (...stopArgs) => {
          stops += 1;
          if (countedActive) {
            active -= 1;
            countedActive = false;
          }
          return stop(...stopArgs);
        };
        source.addEventListener('ended', () => {
          if (countedActive) {
            active -= 1;
            countedActive = false;
          }
        });
        return source;
      };
      return context;
    } as unknown as typeof AudioContext;
    Wrapped.prototype = Original.prototype;
    browserWindow.AudioContext = Wrapped;
    if (browserWindow.webkitAudioContext) browserWindow.webkitAudioContext = Wrapped;
    browserWindow.__muteTrace = () => ({ starts, stops, active });
  });
}

async function mockTts(page: Page) {
  const wav = toneWav();
  await page.route('**/api/v1/tts/public', (route: Route) => route.fulfill({
    status: 200,
    headers: { 'Content-Type': 'audio/wav' },
    body: wav,
  }));
}

async function openMath(page: Page) {
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^(Math|Matemat)/i }).first().click();
  await expect(page.getByTestId('math-panel')).toBeVisible();
  await page.getByTestId('math-key-7').click();
}

function soundButton(page: Page) {
  return page.locator('[data-toolbar-button-id="sound"]:visible').first();
}

async function trace(page: Page) {
  return page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __muteTrace?: () => { starts: number; stops: number; active: number };
    };
    return browserWindow.__muteTrace?.() ?? { starts: 0, stops: 0, active: 0 };
  });
}

test.beforeEach(async ({ page }) => {
  await installAudioTrace(page);
  await mockTts(page);
});

test('Sound Off immediately stops audio already playing for a completed hint', async ({ page }) => {
  await page.route('**/chat', (route: Route) => route.fulfill({
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    body: sseBody('Look at the first number and choose the next step.'),
  }));
  await openMath(page);

  await page.getByTestId('math-tutor-hint').click();
  await expect.poll(async () => (await trace(page)).starts).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await trace(page)).active).toBeGreaterThanOrEqual(1);

  await soundButton(page).click();
  await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await trace(page)).stops).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await trace(page)).active).toBe(0);
  const startsAfterMute = (await trace(page)).starts;
  await page.waitForTimeout(500);
  expect((await trace(page)).starts).toBe(startsAfterMute);
});

test('a hint that finishes streaming after Sound Off stays silent until sound is restored', async ({ page }) => {
  let releaseFirst!: () => void;
  const firstMayFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let firstRequested!: () => void;
  const sawFirstRequest = new Promise<void>((resolve) => { firstRequested = resolve; });
  let chatCalls = 0;
  await page.route('**/chat', async (route: Route) => {
    chatCalls += 1;
    if (chatCalls === 1) {
      firstRequested();
      await firstMayFinish;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody(chatCalls === 1 ? 'This delayed hint remains visible.' : 'Sound is restored.'),
    });
  });
  await openMath(page);

  await page.getByTestId('math-tutor-hint').click();
  await sawFirstRequest;
  await soundButton(page).click();
  await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
  releaseFirst();
  await expect(page.getByTestId('math-tutor-response')).toContainText('This delayed hint remains visible.');
  await page.waitForTimeout(500);
  expect((await trace(page)).starts).toBe(0);

  await soundButton(page).click();
  await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('math-tutor-hint').click();
  await expect(page.getByTestId('math-tutor-response')).toContainText('Sound is restored.');
  await expect.poll(async () => (await trace(page)).starts).toBeGreaterThanOrEqual(1);
  await soundButton(page).click();
});
