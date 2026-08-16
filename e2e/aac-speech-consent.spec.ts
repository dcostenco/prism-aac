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

/**
 * Captures EVERY channel the app can speak through, not just the cloud one.
 *
 * The first version of this helper watched `/tts` network requests only. That
 * is a false-negative hole in the guard that protects the whole rule: speech
 * can also go through the browser's local Web Speech API, which makes no
 * network request at all. Verified while reviewing — with selection feedback
 * enabled, a tile tap produced ZERO `/tts` requests and a local utterance of
 * "I.". A future change that routed composition speech locally would sail past
 * a network-only assertion.
 *
 * Returns a live array of everything spoken, from either channel. Call
 * `collect()` to fold in what the page has spoken locally so far.
 */
function speechSpy(page: Page) {
  const spoken: string[] = [];
  page.on('request', (req: Request) => {
    if (!req.url().includes('/tts')) return;
    try {
      const b = JSON.parse(req.postData() || '{}');
      const t = b?.text ?? b?.ssml ?? b?.input;
      if (t) spoken.push(`cloud:${String(t).slice(0, 80)}`);
    } catch { /* non-JSON */ }
  });
  const install = page.addInitScript(() => {
    (window as unknown as { __spokenLocally: string[] }).__spokenLocally = [];
    const synth = window.speechSynthesis;
    const orig = synth?.speak?.bind(synth);
    if (orig) {
      synth.speak = (u: SpeechSynthesisUtterance) => {
        (window as unknown as { __spokenLocally: string[] }).__spokenLocally.push(u.text);
        return orig(u);
      };
    }
  });
  const collect = async (): Promise<string[]> => {
    const local = await page.evaluate(
      () => (window as unknown as { __spokenLocally?: string[] }).__spokenLocally ?? [],
    );
    return [...spoken, ...local.map((t) => `local:${t}`)];
  };
  return { install, collect };
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
    const spy = speechSpy(page);
    await spy.install;
    await bootMuted(page);

    await page.locator('[data-testid="prediction-bar"] button').first().click();
    await page.waitForTimeout(3000);

    const spoken = await spy.collect();
    expect(spoken, `muted device spoke: ${JSON.stringify(spoken)}`).toEqual([]);
  });

  test('typing and space do not speak when muted', async ({ page }) => {
    const spy = speechSpy(page);
    await spy.install;
    await bootMuted(page);

    for (const ch of 'hi') {
      await page.getByRole('button', { name: new RegExp(`^${ch}$`, 'i') }).first().click();
      await page.waitForTimeout(300);
    }
    await page.getByRole('button', { name: /^space$/i }).click();
    await page.waitForTimeout(3000);

    const spoken = await spy.collect();
    expect(spoken, `muted device spoke: ${JSON.stringify(spoken)}`).toEqual([]);
  });
});

test.describe('the message is spoken only when the user presses Speak', () => {
  // Measured on merged main before this change, fresh install, English only:
  // composing "I do help." produced FOUR full-volume utterances of the
  // accumulated message before Speak was ever pressed — one per tile tap, one
  // on space, one on the sentence terminator. That is message speech, the
  // public utterance to a communication partner, produced without the user
  // choosing to produce it.
  test('composing an entire sentence voices nothing until Speak', async ({ page }) => {
    const spy = speechSpy(page);
    await spy.install;

    // Fresh install: no settings written, so every default applies.
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="prediction-bar"]', { timeout: 30_000 });
    await page.waitForTimeout(1200);

    await page.locator('[data-testid="prediction-bar"] button').first().click();
    await page.waitForTimeout(1200);
    await page.locator('[data-testid="prediction-bar"] button').nth(1).click();
    await page.waitForTimeout(1200);
    for (const ch of 'help') {
      await page.getByRole('button', { name: new RegExp(`^${ch}$`, 'i') }).first().click();
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: /^space$/i }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^\.$/ }).first().click();
    await page.waitForTimeout(3000);

    const beforeSpeak = await spy.collect();
    expect(beforeSpeak, `spoke before Speak was pressed: ${JSON.stringify(beforeSpeak)}`).toEqual([]);

    // ...and pressing Speak does speak it.
    await page.locator('button.aac-speak').first().click();
    await page.waitForTimeout(4000);
    const afterSpeak = await spy.collect();
    expect(afterSpeak.length, 'Speak produced no audio on either channel').toBeGreaterThan(0);
  });
});

test.describe('selection feedback, when the user enables it', () => {
  // Also proves the spy above is not vacuous. Feedback speaks through the
  // browser's local Web Speech API and issues NO network request, so a
  // network-only assertion would report silence here — which is exactly the
  // false negative the two-channel spy exists to prevent.
  test('speaks the ITEM selected, not the accumulated message', async ({ page }) => {
    const spy = speechSpy(page);
    await spy.install;

    await page.addInitScript(() => {
      localStorage.setItem('prism-aac-settings', JSON.stringify({
        state: {
          language: 'en', outputLanguage: 'en',
          speechRate: 1, speechVolume: 1,
          speakSelectionFeedback: true,
        },
        version: 21,
      }));
    });
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="prediction-bar"]', { timeout: 30_000 });
    await page.waitForTimeout(1200);

    const tile = page.locator('[data-testid="prediction-bar"] button').first();
    const word = (await tile.getAttribute('aria-label'))?.replace('Predict: ', '') ?? '';
    expect(word).toBeTruthy();
    await tile.click();
    await page.waitForTimeout(2500);

    const spoken = await spy.collect();
    expect(spoken.length, 'feedback was enabled but nothing was spoken').toBeGreaterThan(0);
    // Every utterance is the item, never the running message.
    for (const utterance of spoken) {
      const said = utterance.replace(/^(cloud|local):/, '').replace(/[.\s]+$/, '');
      expect(said.toLowerCase()).toBe(word.toLowerCase());
    }
  });
});

test.describe('only the Speak control may voice the message', () => {
  // Two paths were found voicing the composed message on actions that are not
  // "speak": the global Enter key handler, and accepting an autocorrect
  // suggestion. Enter also bypassed translateForSpeech entirely — measured
  // en->ro on "I want water" it voiced the offline dictionary's "Vreau Apă."
  // with no translation request, while Speak produced the model's "Vreau apă.".
  test('the physical Enter key does not speak', async ({ page }) => {
    const spy = speechSpy(page);
    await spy.install;

    await page.addInitScript(() => {
      localStorage.setItem('prism-aac-settings', JSON.stringify({
        state: { language: 'en', outputLanguage: 'ro', speechRate: 1, speechVolume: 1 },
        version: 21,
      }));
    });
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30_000 });
    await page.waitForTimeout(1200);

    for (const ch of 'I want water') {
      if (ch === ' ') await page.getByRole('button', { name: /^space$/i }).click();
      else await page.getByRole('button', { name: new RegExp(`^${ch}$`, 'i') }).first().click();
      await page.waitForTimeout(260);
    }
    await page.locator('body').press('Enter');
    await page.waitForTimeout(5000);

    const spoken = await spy.collect();
    expect(spoken, `Enter spoke: ${JSON.stringify(spoken)}`).toEqual([]);

    // ...and keyboard users are not stranded: FOCUS the Speak control and
    // press Enter. An earlier fix called e.preventDefault() on Enter in the
    // global handler, which would have blocked exactly this.
    await page.locator('button.aac-speak').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
    const after = await spy.collect();
    expect(after.length, 'Tab-to-Speak then Enter produced no audio').toBeGreaterThan(0);
  });
});
