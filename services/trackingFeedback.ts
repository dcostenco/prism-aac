import type { TrackingLossReason } from './trackingDiagnostics';

const LOSS_KEYS: Record<TrackingLossReason, string> = {
  'head-missing': 'camera_loss_head',
  'head-unverified': 'camera_loss_head',
  'head-association': 'camera_loss_head',
  'wrist-missing': 'camera_loss_wrist',
  'pose-missing': 'camera_loss_wrist',
  'wrist-unstable': 'camera_loss_motion',
  'camera-frame-stale': 'camera_loss_frame',
  'camera-unavailable': 'camera_loss_unavailable',
  'orientation-mismatch': 'camera_loss_orientation',
  'head-detector-error': 'camera_loss_models',
  'detector-error': 'camera_loss_models',
};
export function trackingLossKey(reason: TrackingLossReason): string { return LOSS_KEYS[reason]; }
