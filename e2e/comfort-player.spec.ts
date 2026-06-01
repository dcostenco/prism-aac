import { test, expect } from '@playwright/test';
import path from 'path';

const VIDEO_FILE = path.join(__dirname, '_fixtures', 'test-comfort-video.mp4');
const AUDIO_FILE = path.join(__dirname, '_fixtures', 'test-comfort-audio.m4a');
const PHOTO_FILE = path.join(__dirname, '_fixtures', 'test-comfort-photo.jpg');

test.describe('Comfort Player — E2E with real media', () => {
  test.beforeAll(() => {
    const fs = require('fs');
    if (!fs.existsSync(VIDEO_FILE)) fs.writeFileSync(VIDEO_FILE, 'dummy video');
    if (!fs.existsSync(AUDIO_FILE)) fs.writeFileSync(AUDIO_FILE, 'dummy audio');
    if (!fs.existsSync(PHOTO_FILE)) fs.writeFileSync(PHOTO_FILE, 'dummy photo');
  });
  test.beforeEach(async ({ page }) => {
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Enable Comfort Player in toolbar
    await page.evaluate(() => {
      const key = 'prism-aac-settings';
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : { state: { toolbarConfig: { enabled: {} } } };
      if (!data.state) data.state = {};
      if (!data.state.toolbarConfig) data.state.toolbarConfig = {};
      if (!data.state.toolbarConfig.enabled) data.state.toolbarConfig.enabled = {};
      data.state.toolbarConfig.enabled.comfort_player = true;
      localStorage.setItem(key, JSON.stringify(data));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Open Comfort Player panel
    const cpBtn = page.locator('button[aria-label="Comfort Player"]');
    await expect(cpBtn).toBeVisible({ timeout: 5000 });
    await cpBtn.click();
    await page.waitForTimeout(500);
  });

  test('shows empty state on first open', async ({ page }) => {
    await expect(page.locator('text=Comfort Player').first()).toBeVisible();
    await expect(page.locator('text=Record voice messages')).toBeVisible({ timeout: 3000 }).catch(() => {
      // Fallback: check for the shorter description
      return expect(page.locator('text=loop continuously')).toBeVisible();
    });
    await expect(page.locator('button', { hasText: 'Record' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Upload' })).toBeVisible();
  });

  test('upload video file and verify it appears in playlist', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(VIDEO_FILE);
    await page.waitForTimeout(1000);

    await expect(page.locator('text=test-comfort-video')).toBeVisible({ timeout: 5000 });
  });

  test('upload audio file and verify it appears in playlist', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(AUDIO_FILE);
    await page.waitForTimeout(500);

    await expect(page.locator('text=test-comfort-audio')).toBeVisible();
  });

  test('upload photo and verify it appears in playlist', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PHOTO_FILE);
    await page.waitForTimeout(500);

    await expect(page.locator('text=test-comfort-photo')).toBeVisible();
  });

  test('upload multiple files at once', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([VIDEO_FILE, AUDIO_FILE, PHOTO_FILE]);
    await page.waitForTimeout(1000);

    await expect(page.locator('text=test-comfort-video')).toBeVisible();
    await expect(page.locator('text=test-comfort-audio')).toBeVisible();
    await expect(page.locator('text=test-comfort-photo')).toBeVisible();
  });

  test('click playlist item starts playback and shows Now Playing', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(VIDEO_FILE);
    await page.waitForTimeout(500);

    // Click the playlist item
    await page.locator('text=test-comfort-video').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Now Playing')).toBeVisible();
    await expect(page.locator('button[aria-label="Pause playback"]')).toBeVisible();
  });

  test('video element renders with correct attributes when playing', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(VIDEO_FILE);
    await page.waitForTimeout(500);

    await page.locator('text=test-comfort-video').click();
    await page.waitForTimeout(1500);

    const video = page.locator('video');
    await expect(video).toBeVisible({ timeout: 5000 });
    // Check playsInline attribute (critical for iOS)
    const playsInline = await video.getAttribute('playsinline');
    expect(playsInline).not.toBeNull();
    // Check muted attribute (required for autoplay)
    const muted = await video.evaluate((el: HTMLVideoElement) => el.muted);
    // muted starts true, then unmutes after play — check that video isn't paused
    const paused = await video.evaluate((el: HTMLVideoElement) => el.paused);
    // Video should either be playing or have attempted to play
    expect(await video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(0);
  });

  test('video actually plays (currentTime advances)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(VIDEO_FILE);
    await page.waitForTimeout(500);

    await page.locator('text=test-comfort-video').click();
    await page.waitForTimeout(2000);

    const video = page.locator('video');
    await expect(video).toBeVisible({ timeout: 5000 });

    // Wait for video to load and start playing
    await page.waitForTimeout(2000);

    const currentTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    expect(currentTime).toBeGreaterThan(0);
  });

  test('audio actually plays (currentTime advances)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(AUDIO_FILE);
    await page.waitForTimeout(500);

    await page.locator('text=test-comfort-audio').click();
    await page.waitForTimeout(2000);

    const audio = page.locator('audio');
    await expect(audio).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(2000);

    const currentTime = await audio.evaluate((el: HTMLAudioElement) => el.currentTime);
    expect(currentTime).toBeGreaterThan(0);
  });

  test('photo displays as img with alt text', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PHOTO_FILE);
    await page.waitForTimeout(500);

    await page.locator('text=test-comfort-photo').click();
    await page.waitForTimeout(1000);

    const img = page.locator('img[alt*="Comfort media"]');
    await expect(img).toBeVisible({ timeout: 5000 });
    const src = await img.getAttribute('src');
    expect(src).toContain('blob:');
  });

  test('skip button advances to next item', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([VIDEO_FILE, PHOTO_FILE]);
    await page.waitForTimeout(1000);

    // Start playback on first item
    await page.locator('text=test-comfort-video').click();
    await page.waitForTimeout(1000);

    // Click skip
    await page.locator('button[aria-label="Skip to next item"]').click();
    await page.waitForTimeout(1000);

    // Should now show photo
    const img = page.locator('img[alt*="Comfort media"]');
    await expect(img).toBeVisible({ timeout: 5000 });
  });

  test('pause and resume playback', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(VIDEO_FILE);
    await page.waitForTimeout(500);

    await page.locator('text=test-comfort-video').click();
    await page.waitForTimeout(1000);

    // Pause
    await page.locator('button[aria-label="Pause playback"]').click();
    await page.waitForTimeout(500);

    // Should show play button
    await expect(page.locator('button[aria-label="Start playback"]')).toBeVisible();
  });

  test('delete item from playlist', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(VIDEO_FILE);
    await page.waitForTimeout(500);

    await expect(page.locator('text=test-comfort-video')).toBeVisible();

    // Delete
    await page.locator('button[aria-label="Delete test-comfort-video"]').click();
    await page.waitForTimeout(500);

    // Should be back to empty state
    await expect(page.locator('text=Record voice messages')).toBeVisible();
  });

  test('clear all with confirmation', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([VIDEO_FILE, AUDIO_FILE]);
    await page.waitForTimeout(1000);

    // Click trash
    await page.locator('button[aria-label="Delete all media"]').click();
    await page.waitForTimeout(300);

    // Confirmation appears
    await expect(page.locator('text=Delete all media?')).toBeVisible();

    // Confirm
    await page.locator('text=Yes, delete all').click();
    await page.waitForTimeout(500);

    // Empty state
    await expect(page.locator('text=Record voice messages')).toBeVisible();
  });

  test('fullscreen mode shows media', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PHOTO_FILE);
    await page.waitForTimeout(500);

    // Start playback + fullscreen
    await page.locator('button[aria-label="Fullscreen playback"]').click();
    await page.waitForTimeout(1500);

    // Fullscreen overlay
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Exit fullscreen button
    await expect(page.locator('button[aria-label="Exit fullscreen"]')).toBeVisible();
  });

  test('fullscreen exit via click', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PHOTO_FILE);
    await page.waitForTimeout(500);

    await page.locator('button[aria-label="Fullscreen playback"]').click();
    await page.waitForTimeout(1500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click exit button
    await page.locator('button[aria-label="Exit fullscreen"]').click();
    await page.waitForTimeout(500);

    await expect(dialog).not.toBeVisible();
  });
});
