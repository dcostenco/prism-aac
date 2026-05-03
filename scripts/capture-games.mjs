#!/usr/bin/env node
/**
 * Capture screenshots of all 12 AAC games for README documentation.
 * Uses Playwright directly (no MCP, no browser extensions).
 *
 * Usage: node scripts/capture-games.mjs
 * Requires: dev server running at http://localhost:3099/prism-aac
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:3099/prism-aac';
const OUT = 'docs/screenshots';
const VIEWPORT = { width: 1024, height: 768 };

const GAMES = [
  { id: 'bubble-pop', file: 'games-bubble-pop.png' },
  { id: 'color-hunt', file: 'games-color-hunt.png' },
  { id: 'my-story', file: 'games-my-story.png' },
  { id: 'match-it', file: 'games-match-it.png' },
  { id: 'yes-no', file: 'games-yes-no.png' },
  { id: 'finish-it', file: 'games-finish-it.png' },
  { id: 'category-sort', file: 'games-category-sort.png' },
  { id: 'emotion-match', file: 'games-emotion-match.png' },
  { id: 'sequence', file: 'games-sequence.png' },
  { id: 'same-different', file: 'games-same-different.png' },
  { id: 'sound-match', file: 'games-sound-match.png' },
  { id: 'turn-taker', file: 'games-turn-taker.png' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // Load the app
  console.log('Loading app...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // First capture: game selector grid
  console.log('Opening games panel...');
  // Click the games button — it's in the "more" overflow menu
  const moreBtn = page.locator('button[aria-label="More"]');
  if (await moreBtn.isVisible()) {
    await moreBtn.click();
    await page.waitForTimeout(500);
  }
  const gamesBtn = page.locator('button:has-text("Games")').first();
  if (await gamesBtn.isVisible()) {
    await gamesBtn.click();
    await page.waitForTimeout(1000);
  }

  // Screenshot the game selector
  await page.screenshot({ path: `${OUT}/games-selector.png`, fullPage: false });
  console.log('Captured: games-selector.png');

  for (const game of GAMES) {
    console.log(`Capturing: ${game.id}...`);
    try {
      // Click the game card button by title text
      const titleMap = {
        'bubble-pop': 'Bubble Pop',
        'color-hunt': 'Color Hunt',
        'my-story': 'My Story',
        'match-it': 'Match It',
        'yes-no': 'Yes / No',
        'finish-it': 'Finish It',
        'category-sort': 'Category Sort',
        'emotion-match': 'Emotions',
        'sequence': 'Sequence',
        'same-different': 'Same/Different',
        'sound-match': 'I Hear It',
        'turn-taker': 'Turn Taker',
      };

      const title = titleMap[game.id];
      const cardBtn = page.locator(`button:has-text("${title}")`).first();

      if (await cardBtn.isVisible({ timeout: 2000 })) {
        // Check if it's disabled (paid game, no auth in dev)
        const isDisabled = await cardBtn.isDisabled();
        if (isDisabled) {
          // For paid games in dev mode, we need to bypass the lock
          // Take screenshot of the locked card instead, or inject auth
          console.log(`  ${game.id} is locked (paid tier) — capturing selector view`);
          // Scroll to make the card visible and screenshot just the card area
          await cardBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          const box = await cardBtn.boundingBox();
          if (box) {
            await page.screenshot({
              path: `${OUT}/${game.file}`,
              clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: box.width + 40, height: box.height + 40 },
            });
          } else {
            await page.screenshot({ path: `${OUT}/${game.file}` });
          }
          console.log(`  Captured: ${game.file} (card view)`);
          continue;
        }

        await cardBtn.click();
        await page.waitForTimeout(1500);

        // Screenshot the game screen
        await page.screenshot({ path: `${OUT}/${game.file}`, fullPage: false });
        console.log(`  Captured: ${game.file}`);

        // Go back to game selector
        const backBtn = page.locator('button:has-text("←")').first();
        if (await backBtn.isVisible({ timeout: 2000 })) {
          await backBtn.click();
          await page.waitForTimeout(800);
        }
      } else {
        console.log(`  ${game.id} card not visible — taking full page screenshot`);
        await page.screenshot({ path: `${OUT}/${game.file}`, fullPage: false });
      }
    } catch (e) {
      console.error(`  Error capturing ${game.id}:`, e.message);
      await page.screenshot({ path: `${OUT}/${game.file}`, fullPage: false });
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to docs/screenshots/');
}

main().catch(e => { console.error(e); process.exit(1); });
