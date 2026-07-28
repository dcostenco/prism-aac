import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

interface SpeechProbe {
  audioSourceStarts: number;
  localUtterances: Array<{
    text: string;
    lang: string;
    rate: number;
    voice: string | null;
  }>;
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

async function injectSpeechProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const localUtterances: SpeechProbe['localUtterances'] = [];
    let audioSourceStarts = 0;
    const win = window as Window & {
      __speechProbe?: () => SpeechProbe;
      webkitAudioContext?: typeof AudioContext;
    };

    const OriginalAudioContext = win.AudioContext || win.webkitAudioContext;
    if (OriginalAudioContext) {
      const WrappedAudioContext = function (this: AudioContext, ...args: unknown[]) {
        const context = new OriginalAudioContext(...(args as []));
        const originalCreate = context.createBufferSource.bind(context);
        context.createBufferSource = () => {
          const source = originalCreate();
          const originalStart = source.start.bind(source);
          source.start = (...startArgs: Parameters<AudioBufferSourceNode['start']>) => {
            audioSourceStarts += 1;
            return originalStart(...startArgs);
          };
          return source;
        };
        return context;
      } as unknown as typeof AudioContext;
      WrappedAudioContext.prototype = OriginalAudioContext.prototype;
      win.AudioContext = WrappedAudioContext;
      if (win.webkitAudioContext) win.webkitAudioContext = WrappedAudioContext;
    }

    const synth = window.speechSynthesis;
    if (synth) {
      Object.defineProperty(synth, 'speak', {
        configurable: true,
        value: (utterance: SpeechSynthesisUtterance) => {
          localUtterances.push({
            text: utterance.text,
            lang: utterance.lang,
            rate: utterance.rate,
            voice: utterance.voice?.name ?? null,
          });
          queueMicrotask(() => {
            utterance.onstart?.(new Event('start') as SpeechSynthesisEvent);
            utterance.onend?.(new Event('end') as SpeechSynthesisEvent);
          });
        },
      });
    }

    win.__speechProbe = () => ({
      audioSourceStarts,
      localUtterances: [...localUtterances],
    });
    sessionStorage.setItem('prism-greeting-dismissed', '1');
  });
}

async function getSpeechProbe(page: Page): Promise<SpeechProbe> {
  return page.evaluate(() => (
    window as Window & { __speechProbe?: () => SpeechProbe }
  ).__speechProbe?.() ?? { audioSourceStarts: 0, localUtterances: [] });
}

async function bootClean(page: Page): Promise<void> {
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });
}

async function persistSpeechState(
  page: Page,
  settings: { language: string; outputLanguage: string },
  soundEnabled: boolean,
): Promise<void> {
  await page.evaluate(({ nextSettings, nextSoundEnabled }) => {
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: {
        ...nextSettings,
        speechRate: 0.5,
        speechVolume: 1,
        aiAutocorrectEnabled: false,
        speakOnSentenceEnd: false,
      },
      version: 19,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: {
        autoSpeak: true,
        soundEnabled: nextSoundEnabled,
        activeTone: 'friendly',
        toneMode: 'auto',
      },
      version: 3,
    }));
    sessionStorage.setItem('prism-greeting-dismissed', '1');
  }, { nextSettings: settings, nextSoundEnabled: soundEnabled });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });
}

async function typeInitialI(page: Page): Promise<void> {
  await page.getByTestId('shift-key').click();
  await page.locator('button[data-key="I"]').click();
}

async function typeLowercase(page: Page, word: string): Promise<void> {
  for (const character of word.toUpperCase()) {
    await page.locator(`button[data-key="${character}"]`).click();
  }
}

async function safeScreenshot(page: Page, filePath: string): Promise<void> {
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception')).toHaveCount(0);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath, fullPage: false });
}

test.beforeEach(async ({ page }) => {
  await injectSpeechProbe(page);
  await page.route('http://localhost:11434/**', (route) => route.abort());
});

test('Romanian Play repairs omitted pronoun, recovers mute, and starts target speech', async ({
  page,
}) => {
  const ttsBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/prism-aac/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: 'Caut' }),
    });
  });
  await page.route('**/api/v1/tts/public', async (route) => {
    ttsBodies.push(JSON.parse(route.request().postData() || '{}') as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: silentWav(),
    });
  });

  await bootClean(page);
  await persistSpeechState(page, { language: 'en', outputLanguage: 'ro' }, false);
  await typeInitialI(page);
  await page.locator('button[data-action="space"]').click();
  await typeLowercase(page, 'looking');

  const translated = page.getByText(/^🌐 eu caut$/u);
  await expect(translated).toBeVisible({ timeout: 10_000 });
  expect(ttsBodies).toHaveLength(0);

  await page.locator('button.aac-speak').first().click();
  await expect.poll(() => ttsBodies.length).toBe(1);
  expect(ttsBodies[0]).toMatchObject({
    text: 'Eu caut.',
    lang: 'ro-RO',
    rate: 0.85,
    volume: 1,
    surface: 'aac',
  });

  const persistedSound = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('prism-aac-message') || '{}').state?.soundEnabled
  ));
  expect(persistedSound).toBe(true);
  await expect(translated).toHaveText('🌐 eu caut');
  await expect.poll(async () => (await getSpeechProbe(page)).audioSourceStarts).toBe(1);

  await safeScreenshot(
    page,
    process.env.TTS_EVIDENCE_PATH || '/private/tmp/prism-aac-evidence/current-build-ro-webkit.png',
  );
});

test('English I plus prediction tap stays local, latest-wins, and avoids cloud TTS', async ({
  page,
}) => {
  const ttsBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/tts/public', async (route) => {
    ttsBodies.push(JSON.parse(route.request().postData() || '{}') as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: silentWav(),
    });
  });

  await bootClean(page);
  await persistSpeechState(page, { language: 'en', outputLanguage: 'en' }, true);
  await typeInitialI(page);
  await expect.poll(async () => (await getSpeechProbe(page)).localUtterances.length).toBeGreaterThan(0);

  const need = page.getByTestId('prediction-bar').getByRole('button', { name: /^Predict: need$/i });
  await expect(need).toBeVisible();
  await need.click();
  await expect(page.getByRole('status')).toContainText('I need');
  await page.waitForTimeout(2_200);

  const probe = await getSpeechProbe(page);
  expect(probe.localUtterances.map((utterance) => utterance.text)).toContain('I.');
  const latest = probe.localUtterances.at(-1);
  expect(latest).toMatchObject({
    text: 'I need',
    lang: 'en-US',
  });
  expect(latest?.rate).toBeCloseTo(0.8, 5);
  expect(ttsBodies).toHaveLength(0);
  expect(probe.audioSourceStarts).toBe(0);
});
