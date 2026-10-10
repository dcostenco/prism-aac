import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HeadTrackingOverlay from '@/components/HeadTrackingOverlay';
import { useSettingsStore } from '@/store/settingsStore';
import { suspendCameraSelection } from '@/services/cameraSelection';
import type { HeadTrackerOptions } from '@/services/headTracker';
import type { ReliabilityProbeOpts } from '@/services/reliabilityProbe';
import type { GestureEvent } from '@/services/gestureService';
import { clearDriftHistory, recordDriftEvent } from '@/services/safeMode';
import { DWELL_FEEDBACK_CASES, feedbackTarget, feedbackClock } from './helpers/dwell-feedback';
const releases: (() => void)[] = [];
const tracker = vi.hoisted(() => ({ options: [] as HeadTrackerOptions[], stop: vi.fn(),
  gestures: [] as ((event: GestureEvent) => void)[],
  probes: [] as ReliabilityProbeOpts[], probeStop: vi.fn() }));
vi.mock('@/services/reliabilityProbe', () => ({
  startReliabilityProbe: (options: ReliabilityProbeOpts) => {
    tracker.probes.push(options); return { stop: tracker.probeStop };
  },
}));
vi.mock('@/services/headTracker', () => ({
  isHeadTrackingSupported: () => true,
  startHeadTracker: (options: HeadTrackerOptions) => { tracker.options.push(options); return { stop: tracker.stop }; },
}));
vi.mock('@/services/gestureService', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/gestureService')>();
  return { ...actual, createGestureDetector: (_config: unknown, callback: (event: GestureEvent) => void) => {
    tracker.gestures.push(callback); return { processFrame: vi.fn() };
  }, destroyGestureDetector: vi.fn() };
});
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
beforeEach(async () => {
  tracker.options = []; tracker.gestures = []; tracker.probes = [];
  tracker.stop.mockClear(); tracker.probeStop.mockClear(); localStorage.clear();
  clearDriftHistory(true);
  const { DEFAULT_GESTURE_CONFIG } = await import('@/services/gestureService');
  useSettingsStore.setState({ headTrackingEnabled: true,
    gestureConfig: { ...DEFAULT_GESTURE_CONFIG, enabled: true, mappings: [{ gesture: 'blink', action: 'speak', label: 'Speak' }] } });
});
afterEach(() => { cleanup(); releases.splice(0).forEach(release => release()); clearDriftHistory(true); document.body.replaceChildren(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each(DWELL_FEEDBACK_CASES)('head feedback agrees with service eligibility for $kind', item => {
  const advance = feedbackClock(); feedbackTarget(item);
  useSettingsStore.setState({ headTrackingDwellMs: 1200 });
  const view = render(<HeadTrackingOverlay />);
  act(() => tracker.options.at(-1)!.onMove(32, 24));
  act(() => advance());
  expect(view.container.querySelectorAll('circle[stroke-dasharray]')).toHaveLength(item.eligible ? 1 : 0);
});

it.each(['escape', 'drift'] as const)('Settings restart retires the %s notice and recovery before a later explicit off', reason => {
  useSettingsStore.setState({ headTrackingDriftAutoDisable: true });
  const view = render(<HeadTrackingOverlay />);
  const stopped = tracker.options.at(-1)!;
  act(() => { if (reason === 'escape') stopped.onEscape?.(); else stopped.onDrift?.('cursor-drift'); });
  expect(view.getByTestId('head-tracking-stop-toast')).toBeVisible();
  const oldProbe = tracker.probes.at(-1);
  act(() => useSettingsStore.getState().update({ headTrackingEnabled: true }));
  act(() => useSettingsStore.getState().update({ headTrackingEnabled: false }));
  expect(view.queryByTestId('head-tracking-stop-toast')).toBeNull();
  act(() => oldProbe?.onRecover());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  // Create new, still-live recovery evidence before the batched restart/off.
  act(() => useSettingsStore.getState().update({ headTrackingEnabled: true }));
  const restarted = tracker.options.at(-1)!;
  act(() => { if (reason === 'escape') restarted.onEscape?.(); else restarted.onDrift?.('cursor-drift'); });
  const liveProbe = tracker.probes.at(-1);
  // Even before passive cleanup, a Settings restart retires live recovery.
  act(() => {
    useSettingsStore.getState().update({ headTrackingEnabled: true });
    useSettingsStore.getState().update({ headTrackingEnabled: false });
    liveProbe?.onRecover();
  });
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  view.unmount();
});

it.each([0, 0.003, 0.015])('rejects stale mapped-gesture/drift callbacks across ownership and resumes fresh input, drift=%s', drift => {
  const button = document.createElement('button'); button.dataset.action = 'speak'; document.body.append(button);
  const clicks = vi.fn(); button.addEventListener('click', clicks);
  const view = render(<HeadTrackingOverlay />);
  const oldGesture = tracker.gestures.at(-1)!, oldOptions = tracker.options.at(-1)!;
  const event: GestureEvent = { gesture: 'blink', confidence: 1 - drift, timestamp: 1000 };
  oldGesture(event); expect(clicks).toHaveBeenCalledTimes(1); clicks.mockClear();
  let release!: () => void;
  act(() => { release = suspendCameraSelection(); releases.push(release); });
  expect(tracker.stop).not.toHaveBeenCalled();
  oldGesture(event); oldOptions.onDrift?.('cursor-drift');
  expect(clicks).not.toHaveBeenCalled(); expect(useSettingsStore.getState().headTrackingEnabled).toBe(true);
  act(() => release());
  expect(tracker.options).toHaveLength(1);
  oldGesture(event); expect(clicks).not.toHaveBeenCalled();
  tracker.gestures.at(-1)!(event); expect(clicks).toHaveBeenCalledTimes(1);
  view.unmount(); tracker.gestures.at(-1)!(event); expect(clicks).toHaveBeenCalledTimes(1);
  // No fabricated landmarks, camera pixels or physical recognition proof.
  expect(oldOptions.onLandmarks).toBeTypeOf('function');
});

it.each([0, 0.003, 0.015])('suspends recovery probes and rejects retired recovery callbacks, drift=%s', drift => {
  const view = render(<HeadTrackingOverlay />);
  act(() => tracker.options.at(-1)!.onDrift?.('cursor-drift'));
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  const oldProbe = tracker.probes.at(-1)!;
  expect(oldProbe).toBeDefined();
  let release!: () => void;
  act(() => { release = suspendCameraSelection(); releases.push(release); });
  expect(tracker.probeStop).toHaveBeenCalled();
  act(() => oldProbe.onRecover?.());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  act(() => release());
  expect(tracker.probes).toHaveLength(2);
  act(() => oldProbe.onRecover?.());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  const freshProbe = tracker.probes.at(-1)!;
  act(() => freshProbe.onTick?.({ streak: 10, confidence: 1 - drift }));
  act(() => freshProbe.onRecover?.());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(true);
  view.unmount();
  useSettingsStore.setState({ headTrackingEnabled: false });
  act(() => freshProbe.onRecover?.());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
});

it('refreshes a probe after a batched acquire/release, without accepting the old recovery evidence', () => {
  render(<HeadTrackingOverlay />);
  act(() => tracker.options.at(-1)!.onDrift?.('cursor-drift'));
  const oldProbe = tracker.probes.at(-1)!;
  act(() => { const release = suspendCameraSelection(); release(); });
  expect(tracker.probes).toHaveLength(2);
  act(() => oldProbe.onRecover());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  act(() => tracker.probes.at(-1)!.onRecover());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(true);
});

it('does not restart a safe-mode tracker when ownership rerenders the overlay', () => {
  recordDriftEvent(); recordDriftEvent();
  const view = render(<HeadTrackingOverlay />);
  expect(tracker.options).toHaveLength(1);
  expect(tracker.options[0].sensitivity).toBe(1.5);
  let release!: () => void;
  act(() => { release = suspendCameraSelection(); releases.push(release); });
  act(() => release());
  expect(tracker.options).toHaveLength(1);
  expect(tracker.stop).not.toHaveBeenCalled();
  view.unmount(); expect(tracker.stop).toHaveBeenCalledTimes(1);
});

it('explicit Escape defeats a recovery callback before passive cleanup, and rejects retired escape callbacks', () => {
  useSettingsStore.setState({ headTrackingDriftAutoDisable: true });
  const view = render(<HeadTrackingOverlay />);
  act(() => tracker.options.at(-1)!.onDrift?.('cursor-drift'));
  const oldProbe = tracker.probes.at(-1)!;
  act(() => useSettingsStore.setState({ headTrackingEnabled: true }));
  const escaped = tracker.options.at(-1)!;
  act(() => { escaped.onEscape?.(); oldProbe.onRecover(); });
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  expect(view.getByRole('button', { name: 'Enable Head Tracking' })).toBeVisible();
  act(() => { oldProbe.onRecover(); });
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  act(() => useSettingsStore.setState({ headTrackingEnabled: true }));
  act(() => escaped.onEscape?.());
  expect(useSettingsStore.getState().headTrackingEnabled).toBe(true);
  view.unmount();
});
