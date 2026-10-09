import React, { StrictMode, useLayoutEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraInputOverlay from '@/components/CameraInputOverlay';
import { useSettingsStore } from '@/store/settingsStore';
import { readCameraSelectionState, suspendCameraSelection } from '@/services/cameraSelection';

const tracker = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
const releases: (() => void)[] = [];
vi.mock('@/services/bodyPoseService', () => ({
  isPoseTrackingSupported: () => true,
  startPoseTracker: () => {
    tracker.start(readCameraSelectionState());
    return { stop: tracker.stop, setAllowLetterMovement: vi.fn() };
  },
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

function SetupOwner() {
  useLayoutEffect(() => suspendCameraSelection(), []);
  return <div data-testid="tracking-setup-wizard" />;
}

beforeEach(() => {
  tracker.start.mockClear(); tracker.stop.mockClear();
  useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: 'nose' });
});
afterEach(() => { cleanup(); releases.splice(0).forEach(release => release()); localStorage.clear(); });

it('does not retire a running tracker or reset its completed lock solely for scanning ownership', () => {
  const view = render(<CameraInputOverlay />);
  expect(tracker.start).toHaveBeenCalledTimes(1);
  let release!: () => void;
  act(() => { release = suspendCameraSelection(); releases.push(release); });
  expect(tracker.stop).not.toHaveBeenCalled();
  act(() => release());
  expect(tracker.start).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(tracker.stop).toHaveBeenCalledTimes(1);
});

describe.each([false, true])('same-commit setup ownership, StrictMode=%s', strict => {
  it('never starts a background tracker under the setup lease, then resumes after release', () => {
    const tree = (setup: boolean) => {
      const content = <><CameraInputOverlay />{setup && <SetupOwner />}</>;
      return strict ? <StrictMode>{content}</StrictMode> : content;
    };
    const view = render(tree(true));
    expect(readCameraSelectionState().blocked).toBe(true);
    // A late cleanup cannot undo synchronous calibration adoption or tracker takeover.
    expect(tracker.start).not.toHaveBeenCalled();
    view.rerender(tree(false));
    expect(readCameraSelectionState().blocked).toBe(false);
    expect(tracker.start).toHaveBeenCalled();
    expect(tracker.start.mock.calls.every(([state]) => !state.blocked)).toBe(true);
    view.unmount();
    expect(tracker.stop).toHaveBeenCalled();
  });
});
