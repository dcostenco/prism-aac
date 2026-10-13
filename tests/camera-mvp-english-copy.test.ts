import { expect, it } from 'vitest';
import english from '@/i18n/en.json';
import canonical from '@/i18n/translations.json';
import { trackingLossKey } from '@/services/trackingFeedback';
import type { TrackingLossReason } from '@/services/trackingDiagnostics';

const LOSS_REASONS: TrackingLossReason[] = ['head-missing', 'head-unverified', 'head-association',
  'wrist-missing', 'pose-missing', 'wrist-unstable', 'camera-frame-stale', 'camera-unavailable',
  'orientation-mismatch', 'head-detector-error', 'detector-error'];

it.each(LOSS_REASONS)('the %s recovery cause resolves to canonical English, not a raw translation key', reason => {
  const key = trackingLossKey(reason) as keyof typeof english;
  expect(english[key]).toBeTruthy();
  expect(english[key]).toBe(canonical[key].en);
  expect(english[key]).not.toBe(key);
});

it('wrist setup asks for comfortable movement and a pause, not head pointing or absolute stillness', () => {
  for (const key of ['tracking_setup_center_guide', 'tracking_setup_corner_guide', 'tracking_setup_manual_capture', 'tracking_setup_corner_pause'] as const) {
    expect(english[key]).toBe(canonical[key].en);
    expect(english[key]).toMatch(/wrist/);
    expect(english[key]).not.toMatch(/look toward|turn your head|exaggerate/);
  }
  expect(english.camera_pause_help).toContain('does not require complete stillness');
});
