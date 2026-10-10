import React, { StrictMode, useLayoutEffect } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraInputOverlay from '@/components/CameraInputOverlay';
import { useSettingsStore } from '@/store/settingsStore';
import { readCameraSelectionState, suspendCameraSelection } from '@/services/cameraSelection';
import type { PoseTrackerOptions } from '@/services/bodyPoseService';
import { DWELL_FEEDBACK_CASES, feedbackTarget, feedbackClock } from './helpers/dwell-feedback';

const tracker = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), options: [] as PoseTrackerOptions[] }));
const releases: (() => void)[] = [];
vi.mock('@/services/bodyPoseService', () => ({
  isPoseTrackingSupported: () => true,
  startPoseTracker: (options: PoseTrackerOptions) => {
    tracker.options.push(options);
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
  tracker.start.mockClear(); tracker.stop.mockClear(); tracker.options = [];
  useSettingsStore.setState({ cameraInputEnabled: true, cameraTrackingTarget: 'nose' });
});
afterEach(() => { cleanup(); releases.splice(0).forEach(release => release()); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.replaceChildren(); });

it.each(DWELL_FEEDBACK_CASES)('camera feedback agrees with service eligibility for $kind', item => {
  const advance = feedbackClock(); const target = feedbackTarget(item);
  useSettingsStore.setState({ headTrackingDwellMs: 1200 });
  const view = render(<CameraInputOverlay />);
  act(() => tracker.options.at(-1)!.onMove(32, 24));
  act(() => advance());
  expect(view.container.querySelectorAll('circle[stroke-dasharray]')).toHaveLength(item.eligible ? 1 : 0);
  expect(target.classList.contains('camera-cursor-highlight')).toBe(item.eligible && item.tag === 'button');
});

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

it('reports paused camera selection until every owner releases, then restores the warm tracker', () => {
  const view = render(<CameraInputOverlay />);
  act(() => tracker.options.at(-1)!.onStatusChange('tracking'));
  let first!: () => void, second!: () => void;
  act(() => { first = suspendCameraSelection(); second = suspendCameraSelection(); releases.push(first, second); });
  expect(view.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'paused');
  expect(view.getByTestId('camera-input-notice')).toHaveTextContent(/selection paused/i);
  expect(view.getByTestId('camera-input-overlay')).not.toBeVisible();
  expect(tracker.stop).not.toHaveBeenCalled();
  act(() => first());
  expect(view.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'paused');
  act(() => second());
  expect(view.queryByTestId('camera-input-notice')).toBeNull();
  expect(view.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'tracking');
  expect(view.getByTestId('camera-input-overlay')).toBeVisible();
  expect(tracker.start).toHaveBeenCalledTimes(1);
});

it('offers camera stopped-startup retry without permitting stale blocked or disabled retries', () => {
  const view = render(<CameraInputOverlay />);
  act(() => tracker.options.at(-1)!.onStatusChange('stopped'));
  const retry = view.getByRole('button', { name: /^Try again/ });
  let release!: () => void;
  act(() => { release = suspendCameraSelection(); releases.push(release); fireEvent.click(retry); });
  expect(tracker.start).toHaveBeenCalledTimes(1);
  act(() => release());
  fireEvent.click(view.getByRole('button', { name: /^Try again/ }));
  expect(tracker.start).toHaveBeenCalledTimes(2);
  expect(useSettingsStore.getState().cameraInputEnabled).toBe(true);
  act(() => tracker.options.at(-1)!.onStatusChange('starting'));
  expect(view.queryByTestId('camera-input-notice')).toBeNull();
  act(() => tracker.options.at(-1)!.onStatusChange('stopped'));
  const freshRetry = view.getByRole('button', { name: /^Try again/ });
  act(() => { useSettingsStore.getState().update({ cameraInputEnabled: false }); fireEvent.click(freshRetry); });
  expect(tracker.start).toHaveBeenCalledTimes(2);
  expect(useSettingsStore.getState().cameraInputEnabled).toBe(false);
});

it('preserves watchdog auto-disable and explicit re-enable after a stuck cursor', () => {
  vi.useFakeTimers();
  const view = render(<CameraInputOverlay />);
  act(() => tracker.options.at(-1)!.onStatusChange('tracking'));
  act(() => vi.advanceTimersByTime(46_000));
  expect(useSettingsStore.getState().cameraInputEnabled).toBe(false);
  expect(tracker.stop).toHaveBeenCalledTimes(1);
  const notice = view.getByTestId('camera-input-stuck-toast'); expect(notice).toHaveAttribute('role', 'alert');
  expect(notice).toHaveClass('camera-recovery-warning'); expect(notice).not.toHaveClass('fixed');
  expect(notice).toHaveTextContent(/camera tracking auto-disabled/i);
  fireEvent.click(view.getByRole('button', { name: 'Re-enable', exact: true }));
  expect(useSettingsStore.getState().cameraInputEnabled).toBe(true);
  expect(tracker.start).toHaveBeenCalledTimes(2); expect(view.queryByTestId('camera-input-stuck-toast')).toBeNull();
});

it('dismissing a stuck warning does not silently re-enable camera input', () => {
  vi.useFakeTimers(); const view = render(<CameraInputOverlay />);
  act(() => tracker.options.at(-1)!.onStatusChange('tracking'));
  act(() => vi.advanceTimersByTime(46_000));
  fireEvent.click(view.getByRole('button', { name: 'Dismiss', exact: true }));
  expect(view.queryByTestId('camera-input-stuck-toast')).toBeNull();
  expect(useSettingsStore.getState().cameraInputEnabled).toBe(false); expect(tracker.start).toHaveBeenCalledTimes(1);
});

it('drift warning dismissal preserves tracking and does not consume communication input', () => {
  const view = render(<CameraInputOverlay />);
  act(() => window.dispatchEvent(new Event('prism-recalibration-needed')));
  expect(view.getByTestId('camera-input-recal-toast')).toHaveAttribute('role', 'alert');
  expect(view.getByTestId('camera-input-recal-toast')).toHaveClass('camera-recovery-warning');
  expect(view.getByTestId('camera-input-recal-toast')).not.toHaveClass('fixed');
  fireEvent.click(view.getByRole('button', { name: 'Dismiss', exact: true }));
  expect(view.queryByTestId('camera-input-recal-toast')).toBeNull();
  expect(useSettingsStore.getState().cameraInputEnabled).toBe(true); expect(tracker.stop).not.toHaveBeenCalled();
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
