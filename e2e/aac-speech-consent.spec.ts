/**
 * The user's controls over their own voice must actually work.
 *
 * An AAC device speaks FOR its user. Every path that can produce sound has to
 * honour the two controls the user has — the master mute (soundEnabled) and
 * the Auto toggle (autoSpeak) — or those controls are decoration.
 *
 * Measured on merged main before this fix, with BOTH set to false: tapping a
 * prediction tile still sent "I." to TTS, while the typing path in the same
 * run correctly stayed silent. PredictionBar.handleTap never read autoSpeak
 * (grep count: 0), and neither aacSpeak nor speakWord enforces the mute
 * internally — every other caller checks it, and this one did not. A caregiver
 * who mutes the device in a classroom was still broadcast on every tap.
 */
import { test, expect, type Page, type Request } from '@playwright/test';

function ttsSpy(page: Page): string[] {
  const tts: string[] = [];
  page.on('request', (req: Request) => {
    if (!req.url().includes('/tts')) return;
    try {
      const b = JSON.parse(req.postData() || '{}');
      const t = b?.text ?? b?.ssml ?? b?.input;
      if (t) tts.push(String(t).slice(0, 80));
    } catch { /* non-JSON */ }
  });
  return tts;
}

/** Seeds the persisted message store. NOTE the key is `prism-aac-message`. */
async function bootMuted(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { autoSpeak: false, soundEnabled: false, text: '' }, version: 2,
    }));
  });
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="prediction-bar"]', { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // Prove the app really is muted before judging anything it does.
  const autoBtn = page.locator('[data-scan-group="message-bar"] button').first();
  await expect(autoBtn).toHaveAttribute('aria-pressed', 'false');
}

test.describe('a muted device stays silent', () => {
  test('tapping a prediction tile does not speak when muted and auto-speak is off', async ({ page }) => {
    const tts = ttsSpy(page);
    await bootMuted(page);

    await page.locator('[data-testid="prediction-bar"] button').first().click();
    await page.waitForTimeout(3000);

    expect(tts, `muted device spoke: ${JSON.stringify(tts)}`).toEqual([]);
  });

  test('typing and space do not speak when muted', async ({ page }) => {
    const tts = ttsSpy(page);
    await bootMuted(page);

    for (const ch of 'hi') {
      await page.getByRole('button', { name: new RegExp(`^${ch}$`, 'i') }).first().click();
      await page.waitForTimeout(300);
    }
    await page.getByRole('button', { name: /^space$/i }).click();
    await page.waitForTimeout(3000);

    expect(tts, `muted device spoke: ${JSON.stringify(tts)}`).toEqual([]);
  });
});
