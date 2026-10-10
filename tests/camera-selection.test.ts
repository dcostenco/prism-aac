import { expect, it } from 'vitest';
import { canActivateCameraSelection, readCameraSelectionState, subscribeCameraSelection, suspendCameraSelection } from '@/services/cameraSelection';

it('retains each setup owner and releases idempotently', () => {
  const before = readCameraSelectionState();
  const releaseA = suspendCameraSelection(), releaseB = suspendCameraSelection();
  try {
    expect(readCameraSelectionState().blocked).toBe(true);
    expect(canActivateCameraSelection(before.epoch)).toBe(false);
    releaseA(); releaseA();
    expect(readCameraSelectionState().blocked).toBe(true);
  } finally { releaseA(); releaseB(); }
  expect(readCameraSelectionState().blocked).toBe(false);
  expect(canActivateCameraSelection(before.epoch)).toBe(false);
  expect(canActivateCameraSelection(readCameraSelectionState().epoch)).toBe(true);
});

it('invalidates old selection credit even when setup opens and closes between frames', () => {
  const before = readCameraSelectionState().epoch;
  const release = suspendCameraSelection(); release();
  expect(readCameraSelectionState().blocked).toBe(false);
  expect(canActivateCameraSelection(before)).toBe(false);
});

it('notifies the overlay when ownership changes and stops after unsubscribe', () => {
  const snapshots: boolean[] = [];
  const unsubscribe = subscribeCameraSelection(() => snapshots.push(readCameraSelectionState().blocked));
  const release = suspendCameraSelection(); release();
  expect(snapshots).toEqual([true, false]);
  unsubscribe(); const next = suspendCameraSelection(); next();
  expect(snapshots).toEqual([true, false]);
});
