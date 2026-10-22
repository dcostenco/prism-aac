import { expect, test, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';
import { openPreviewKeyboard } from './helpers/web-preview';

const CACHE_ACCOUNT = 'speech-owner@example.invalid';
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

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
// Independent browser storage checks complement the visible per-profile count.
async function recordScopeDiagnostic(page: Page, name: string) {
  const value = await page.evaluate(async account => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('prism-aac-speech-audio-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await Promise.all(['identity', 'clips'].map(store => new Promise<any[]>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })));
    db.close();
    const record = rows[0][0];
    let matchesAccount = false;
    let decryptError: string | null = null;
    if (record) {
      try {
        matchesAccount = new TextDecoder().decode(await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: record.iv }, await crypto.subtle.importKey('raw', record.secret, 'AES-GCM', false, ['decrypt']), record.payload)) === account;
      } catch (error) { decryptError = String(error); }
    }
    const scopeDigest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(account))))
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    return { identityRows: rows[0].length, clips: rows[1].length,
      tokenPresent: !!localStorage.getItem('prism-aac-speech-scope-v1'),
      tokenMatches: record?.token === localStorage.getItem('prism-aac-speech-scope-v1'),
      keyBytes: record?.secret?.byteLength,
      matchesAccount, decryptError, accountClips: rows[1].filter(row => row.scope === scopeDigest).length };
  }, CACHE_ACCOUNT);
  await test.info().attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
  expect(value).toMatchObject({ identityRows: 1, clips: 1, tokenPresent: true,
    tokenMatches: true, keyBytes: 32, matchesAccount: true, decryptError: null, accountClips: 1 });
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
  await safeScreenshot(page, test.info().outputPath(file), {
    expectedPath: '/prism-aac', requiredSelectors: ['[role=dialog]'],
    criticalSelectors: ['[data-testid=speech-cache-settings] input[type=checkbox]'],
  });
}

for (const provider of ['inworld', 'azure'] as const) {
 for (const identity of ['guest', 'signed-in'] as const) {
  test(`${identity}: ${provider} audio survives an identity outage and reload, then plays offline without synthesis`, async ({ page, context }) => {
    let calls = 0;
    let unavailable = false;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
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
    await page.route('**/api/v1/prism-aac/session', route => unavailable ? route.abort()
      : identity === 'guest' ? route.fulfill({ status: 401, json: { signed_in: false } })
      : route.fulfill({ json: { signed_in: true, email: CACHE_ACCOUNT } }));
    await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { plan: 'free', aac_plan: 'free' } }));
    await page.route(/\/api\/v1\/prism-aac\/billing(?:\?.*)?$/, route => route.fulfill({ json: {
      userId: '11111111-1111-4111-8111-111111111111', enabled: false, hasCloudAccess: false,
      betaExempt: false, channels: [], manageChannel: null, purchaseBlocked: true, transitionEndsAt: null,
      offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly', version: 'speech-cache-fixture',
        monthlySpeechCharacters: 50000, monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month' },
    } }));
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
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Synalux Account/ }).click();
    await expect(identity === 'guest' ? page.getByTestId('synalux-signin') : page.getByText(CACHE_ACCOUNT, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await openPreviewKeyboard(page);
    await page.locator('button[data-key="I"]').click();
    const message = await page.getByTestId('message-text').innerText();
    expect(message).toMatch(/^i$/i);
    await page.locator('button.aac-speak').first().click();
    await expect.poll(() => starts(page)).toBe(1);
    expect(calls).toBe(1);
    await openSettings(page);
    await expect(page.getByText(/1 clips for this profile/)).toBeVisible();
    await capture(page, `${provider}-saved.png`);
    if (identity === 'signed-in') await recordScopeDiagnostic(page, 'scope-before-reload');
    await page.getByRole('button', { name: 'Close settings' }).click();

    // Reload removes all module-memory clips. Turn off networking before the
    // next Speak, so a disk miss cannot quietly obtain fresh audio.
    unavailable = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('message-text')).toHaveText(message);
    // Service workers are blocked in this fixture. Load the speech/settings
    // bundles before disabling networking; this proves offline audio storage,
    // while app-shell availability is covered by the separate worker tests.
    await openSettings(page);
    if (identity === 'signed-in') await recordScopeDiagnostic(page, 'scope-after-reload');
    await expect(page.getByText(/1 clips for this profile/)).toBeVisible();
    await page.getByRole('button', { name: 'Close settings' }).click();
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
    expect(errors).toEqual([]);
  });
 }
}
