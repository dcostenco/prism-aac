import { afterEach, expect, it } from 'vitest';
import { getDefaultConfig, saveConfig, stopScan, SWITCH_SCAN_CONFIG_EVENT } from '@/services/switchScanService';
import { canActivateCameraSelection, readCameraSelectionState, subscribeCameraSelection,
  finishSwitchScanOwnershipStaging } from '@/services/cameraSelection';

afterEach(() => { stopScan(); localStorage.clear(); });

it('blocks camera selection before configuration observers or a deferred controller can run', () => {
  const states: boolean[] = [];
  const listener = () => states.push(readCameraSelectionState().blocked);
  window.addEventListener(SWITCH_SCAN_CONFIG_EVENT, listener);
  try {
    saveConfig({ ...getDefaultConfig(), enabled: true });
    expect(states).toEqual([true]);
    expect(readCameraSelectionState().blocked).toBe(true);
  } finally { window.removeEventListener(SWITCH_SCAN_CONFIG_EVENT, listener); }
});

it('invalidates prior camera credit across enable then disable before controller mounting', () => {
  const before = readCameraSelectionState().epoch;
  saveConfig({ ...getDefaultConfig(), enabled: true });
  saveConfig({ ...getDefaultConfig(), enabled: false });
  expect(readCameraSelectionState().blocked).toBe(false);
  expect(canActivateCameraSelection(before)).toBe(false);
});

it('does not leak a staging lease when a subscriber retires it during acquisition notification', () => {
  const unsubscribe = subscribeCameraSelection(() => {
    if (readCameraSelectionState().blocked) finishSwitchScanOwnershipStaging();
  });
  try {
    saveConfig({ ...getDefaultConfig(), enabled: true });
    expect(readCameraSelectionState().blocked).toBe(false);
  } finally { unsubscribe(); }
});
