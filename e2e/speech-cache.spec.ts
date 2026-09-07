import { expect, test, type Page } from '@playwright/test';

// An audible tone exercises the browser's actual decoder and source playback.
// Provider responses are fixtures; this does not certify a live provider voice.
function toneWav(): Buffer {
  const sampleRate = 8_000;
  const samples = 2_000;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(2000 * Math.sin(2 * Math.PI * 440 * i / sampleRate)), 44 + i * 2);
  return wav;
}

async function starts(page: Page) {
  return page.evaluate(() => (window as Window & { cacheAudioStarts: number }).cacheAudioStarts);
}
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Save speech on this device' }).scrollIntoViewIfNeeded();
}
async function capture(page: Page, file: string) {
  await expect(page.getByRole('checkbox', { name: 'Save speech on this device' })).toBeVisible();
  await expect(page.getByText('Application error: a client-side exception', { exact: false })).toHaveCount(0);
  const box = await page.getByRole('dialog').boundingBox();
  expect(box?.height).toBeGreaterThan(200);
  await page.screenshot({ path: test.info().outputPath(file), fullPage: false });
}

for (const provider of ['inworld', 'azure'] as const) {
  test(`${provider} audio survives reload and plays offline without another synthesis`, async ({ page, context }) => {
    let calls = 0;
    await page.addInitScript(() => {
      const win = window as Window & { cacheAudioStarts: number };
      win.cacheAudioStarts = 0;
      const create = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const source = create.call(this);
        const start = source.start.bind(source);
        source.start = (...args) => { win.cacheAudioStarts++; start(...args); };
        return source;
      };
      sessionStorage.setItem('prism-greeting-dismissed', '1');
      localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
        language: 'en', outputLanguage: 'en', speechRate: 0.5, speechVolume: 1,
        aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
      }, version: 19 }));
      localStorage.setItem('prism-aac-message', JSON.stringify({ state: {
        text: '', autoSpeak: false, soundEnabled: true, activeTone: 'friendly', toneMode: 'auto',
      }, version: 3 }));
    });
    await page.route('**/api/**', route => route.abort());
    await page.route('http://localhost:11434/**', route => route.abort());
    await page.route('**/api/v1/tts/public', async route => {
      calls++;
      await route.fulfill({ status: 200, contentType: 'audio/wav', body: toneWav(), headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'X-TTS-Backend, X-TTS-Voice, X-TTS-Model',
        'X-TTS-Backend': provider,
        'X-TTS-Voice': provider === 'inworld' ? 'Alex' : 'en-US-JennyNeural',
        'X-TTS-Model': provider === 'inworld' ? 'inworld-tts-2' : 'azure-speech-rest-v1',
      } });
    });
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await page.locator('button[data-key="I"]').click();
    await page.locator('button.aac-speak').first().click();
    await expect.poll(() => starts(page)).toBe(1);
    expect(calls).toBe(1);
    await openSettings(page);
    await expect(page.getByText(/1 clips for this profile/)).toBeVisible();
    await capture(page, `${provider}-saved.png`);
    await page.getByRole('button', { name: 'Close settings' }).click();

    // Reload removes all module-memory clips. Turn off networking before the
    // next Speak, so a disk miss cannot quietly obtain fresh audio.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('button[data-key="I"]').click();
    await context.setOffline(true);
    await page.locator('button.aac-speak').first().click();
    await expect.poll(() => starts(page)).toBe(1);
    expect(calls).toBe(1);
    await openSettings(page);
    // Read the actual persistent store independently of the Settings label.
    const clips = await page.evaluate(async () => new Promise<Array<{ bytes: number; backend: string }>>((resolve, reject) => {
      const request = indexedDB.open('prism-aac-speech-audio-v1');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const rows = db.transaction('clips').objectStore('clips').getAll();
        rows.onerror = () => { db.close(); reject(rows.error); };
        rows.onsuccess = () => {
          resolve(rows.result.map(row => ({ bytes: row.audio.byteLength, backend: row.identity.backend })));
          db.close();
        };
      };
    }));
    expect(clips).toEqual([{ bytes: toneWav().byteLength, backend: provider }]);
    await capture(page, `${provider}-post-reload.png`);
    await page.getByRole('button', { name: 'Clear saved speech on this device' }).click();
    await expect(page.getByText(/0 clips for this profile/)).toBeVisible();
    await capture(page, `${provider}-cleared.png`);
    await page.getByRole('checkbox', { name: 'Save speech on this device' }).uncheck();
    await expect(page.getByRole('checkbox', { name: 'Save speech on this device' })).not.toBeChecked();
    await capture(page, `${provider}-disabled.png`);
    expect(calls).toBe(1);
  });
}
