import { expect, test } from '@playwright/test';
import { checkCriticalOcclusion } from './helpers/screenshot-validation';

const ROUNDED_CONTROL = '<button id="target" style="position:fixed;left:20px;top:20px;width:160px;height:100px;border-radius:24px">Speak</button>';
const OVERLAY_ID = 'overlay';

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } finally { await context.close(); }
});

test('rounded transparent corners do not reject an unobstructed clickable control', async ({ page }) => {
  await page.setContent(ROUNDED_CONTROL);
  await expect(checkCriticalOcclusion(page, { criticalSelectors: ['#target'] })).resolves.toEqual([]);
  await page.evaluate(() => {
    document.querySelector('#target')!.addEventListener('click', (event) => {
      (event.currentTarget as HTMLElement).dataset.activated = 'true';
    }, { once: true });
  });
  await page.locator('#target').click();
  await expect(page.locator('#target')).toHaveAttribute('data-activated', 'true');
});

test('an actual overlay still fails the interior hit test', async ({ page }) => {
  await page.setContent(ROUNDED_CONTROL);
  await page.evaluate((id) => {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;left:80px;top:55px;width:40px;height:30px;z-index:10';
    document.body.append(overlay);
  }, OVERLAY_ID);
  expect(await checkCriticalOcclusion(page, { criticalSelectors: ['#target'] })).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'hit_test_blocked' }),
  ]));
});

test('a declared edge occluder is rejected even outside the interior probes', async ({ page }) => {
  await page.setContent(ROUNDED_CONTROL);
  await page.evaluate((id) => {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;left:20px;top:20px;width:160px;height:8px;z-index:10';
    document.body.append(overlay);
  }, OVERLAY_ID);
  expect(await checkCriticalOcclusion(page, {
    criticalSelectors: ['#target'], occluderSelectors: ['#overlay'],
  })).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'occluded_by' })]));
});
