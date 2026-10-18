import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import CameraInputOverlay from '@/components/CameraInputOverlay';
import HeadTrackingOverlay from '@/components/HeadTrackingOverlay';
import HeadTrackingSettings from '@/components/HeadTrackingSettings';
import { useSettingsStore } from '@/store/settingsStore';
import { CAMERA_TRACKING_TARGETS, isCameraCursorTarget } from '@/services/cameraTrackingTargets';

const tracking = vi.hoisted(() => ({ pose: vi.fn(), head: vi.fn(), cameras: vi.fn() }));
vi.mock('@/services/bodyPoseService', () => ({
  isPoseTrackingSupported: () => true,
  startPoseTracker: tracking.pose,
}));
vi.mock('@/services/headTracker', () => ({
  isHeadTrackingSupported: () => true,
  startHeadTracker: tracking.head,
  listCameras: tracking.cameras,
}));
const initial = useSettingsStore.getState();
afterEach(() => { cleanup(); useSettingsStore.setState(initial); localStorage.clear(); vi.clearAllMocks(); });

it('saved head, gaze and gesture settings cannot start a head tracker or camera enumeration', async () => {
  useSettingsStore.setState({ headTrackingEnabled: true, headTrackingEyeGaze: true,
    gestureConfig: { ...initial.gestureConfig, enabled: true } });
  const view = render(<><HeadTrackingOverlay /><HeadTrackingSettings /></>);
  await act(async () => {});
  expect(tracking.head).not.toHaveBeenCalled();
  expect(tracking.cameras).not.toHaveBeenCalled();
  expect(view.queryByTestId('head-tracking-overlay')).toBeNull();
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(true); // Preferences retained, not activated.
});

it.each(CAMERA_TRACKING_TARGETS.filter(target => !isCameraCursorTarget(target.id)))('legacy $id cannot restart a cursor from saved enabled state', async ({ id }) => {
  useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: id });
  const view = render(<CameraInputOverlay />);
  await act(async () => {});
  expect(tracking.pose).not.toHaveBeenCalled();
  expect(view.queryByTestId('camera-input-overlay')).toBeNull();
});

it.each(['left_wrist', 'right_wrist'])('the %s overlay requests strict target ownership and head presence', async target => {
  const stop = vi.fn();
  tracking.pose.mockReturnValue({ stop, setCalibration: vi.fn(), videoElement: null });
  useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: target });
  const view = render(<CameraInputOverlay />);
  await act(async () => {});
  expect(tracking.pose).toHaveBeenCalledWith(expect.objectContaining({
    trackingTarget: target, selectedTargetOnly: true, requireHeadPresence: true,
  }));
  view.unmount();
  expect(stop).toHaveBeenCalled();
});
