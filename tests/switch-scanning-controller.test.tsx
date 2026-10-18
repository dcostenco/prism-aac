import React, { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SwitchScanningController from '@/components/SwitchScanningController';
import InputModesSettings from '@/components/InputModesSettings';
import { getState, saveConfig, getDefaultConfig, stopScan } from '@/services/switchScanService';
import { readCameraSelectionState } from '@/services/cameraSelection';
import { useSettingsStore } from '@/store/settingsStore';
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/engine/useT', () => ({ useT: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/TrackingSetupWizard', () => ({ default: () => null }));
const RESTART_KEYS = [' ', 'Enter'] as const;
const AUTO_SCAN_TEST_INTERVAL_MS = 1000;
const AUTO_SCAN_TEST_TICK_LIMIT = 10;

function Scene() {
  const [settings, setSettings] = useState(true);
  const [message, setMessage] = useState('');
  return <><SwitchScanningController /><button onClick={() => setMessage(value => value + 'I')}>Board I</button>
    <output data-testid="test-message">{message}</output>
    {settings && <div role="dialog" aria-modal="true"><button onClick={() => setSettings(false)}>Close Settings</button><InputModesSettings /></div>}
  </>;
}
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); stopScan();
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
  Element.prototype.scrollIntoView = vi.fn();
  useSettingsStore.setState({ cameraInputEnabled: false, headTrackingEnabled: false });
});
afterEach(() => { cleanup(); stopScan(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });

describe.each([false, true])('app-owned switch scanning, StrictMode=%s', strict => {
  it('survives Settings closure, selects once per press and stops/relinquishes camera activation', async () => {
    useSettingsStore.setState({ cameraInputEnabled: true });
    saveConfig({ ...getDefaultConfig(), mode: 'manual', groupScan: false, loops: 0 });
    render(strict ? <StrictMode><Scene /></StrictMode> : <Scene />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch scanning', exact: true }));
    expect(getState().phase).toBe('items');
    expect(readCameraSelectionState().blocked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close Settings', exact: true }));
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(200); });
    expect(getState().phase).toBe('items');
    expect(document.querySelector('.switch-scan-active')).not.toBeNull();
    // Controller Stop is first in DOM order; advance to the real board item.
    fireEvent.keyDown(document.body, { key: 'Tab' }); fireEvent.keyUp(document.body, { key: 'Tab' });
    expect(document.querySelector('.switch-scan-active')).toBe(screen.getByRole('button', { name: 'Board I' }));
    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyDown(document.body, { key: 'Enter', repeat: true });
    fireEvent.keyUp(document.body, { key: 'Enter' });
    expect(screen.getByTestId('test-message')).toHaveTextContent(/^I$/);
    fireEvent.click(screen.getByRole('button', { name: 'scan_stop', exact: true }));
    expect(getState().phase).toBe('idle'); expect(readCameraSelectionState().blocked).toBe(false);
    expect(useSettingsStore.getState().cameraInputEnabled).toBe(true);
    expect(document.querySelector('.switch-scan-active')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Board I' }));
    expect(screen.getByTestId('test-message')).toHaveTextContent(/^II$/);
  });
  it('restores enabled configuration on app mount and releases ownership on unmount', () => {
    saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'manual', groupScan: false });
    const view = render(strict ? <StrictMode><Scene /></StrictMode> : <Scene />);
    expect(getState().phase).toBe('items'); expect(readCameraSelectionState().blocked).toBe(true);
    view.unmount();
    expect(getState().phase).toBe('idle'); expect(readCameraSelectionState().blocked).toBe(false);
  });
  it('provides a visible restart after a finite scan stops without losing configured input', () => {
    saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'manual', groupScan: false });
    render(strict ? <StrictMode><Scene /></StrictMode> : <Scene />);
    act(() => stopScan());
    expect(screen.getByTestId('switch-scan-controller')).toHaveAttribute('data-phase', 'idle');
    expect(readCameraSelectionState().blocked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'scan_start', exact: true }));
    expect(getState().phase).toBe('items');
  });
  it.each(RESTART_KEYS)('restarts an exhausted auto scanner with fresh %s, without focusing Start or activating another control', key => {
    saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'auto', groupScan: false, loops: 1, scanSpeedMs: AUTO_SCAN_TEST_INTERVAL_MS });
    const clicked = vi.fn();
    const scene = <><SwitchScanningController /><button onClick={clicked}>Other control</button></>;
    render(strict ? <StrictMode>{scene}</StrictMode> : scene);
    expect(getState().phase).toBe('items');
    for (let tick = 0; tick < AUTO_SCAN_TEST_TICK_LIMIT && getState().phase !== 'idle'; tick++) {
      act(() => vi.advanceTimersByTime(AUTO_SCAN_TEST_INTERVAL_MS));
    }
    expect(getState().phase).toBe('idle');
    const other = screen.getByRole('button', { name: 'Other control' }); other.focus();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    act(() => document.body.dispatchEvent(event));
    expect(getState().phase).toBe('items');
    expect(event.defaultPrevented).toBe(true);
    expect(readCameraSelectionState().blocked).toBe(true);
    fireEvent.keyDown(document.body, { key });
    fireEvent.keyDown(document.body, { key, repeat: true });
    expect(clicked).not.toHaveBeenCalled();
    fireEvent.keyUp(document.body, { key });
  });
  it.each(RESTART_KEYS)('requires release of the %s press that stopped the scanner before restarting', key => {
    saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'manual', groupScan: false, loops: 0 });
    const selected = vi.fn(() => stopScan());
    const scene = <><SwitchScanningController /><button onClick={selected}>Finish selection</button></>;
    render(strict ? <StrictMode>{scene}</StrictMode> : scene);
    fireEvent.keyDown(document.body, { key: 'Tab' }); fireEvent.keyUp(document.body, { key: 'Tab' });
    fireEvent.keyDown(document.body, { key });
    expect(selected).toHaveBeenCalledTimes(1); expect(getState().phase).toBe('idle');
    fireEvent.keyDown(document.body, { key }); fireEvent.keyDown(document.body, { key, repeat: true });
    expect(getState().phase).toBe('idle'); expect(selected).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(document.body, { key }); fireEvent.keyDown(document.body, { key });
    expect(getState().phase).toBe('items'); expect(selected).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(document.body, { key });
  });
  it.each(RESTART_KEYS)('does not consume %s or restart after configured disable or unmount', key => {
    saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'manual', groupScan: false });
    const view = render(strict ? <StrictMode><SwitchScanningController /></StrictMode> : <SwitchScanningController />);
    act(() => saveConfig({ ...getDefaultConfig(), enabled: false }));
    const disabled = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    act(() => document.body.dispatchEvent(disabled));
    expect(disabled.defaultPrevented).toBe(false); expect(getState().phase).toBe('idle');
    fireEvent.keyUp(document.body, { key }); view.unmount();
    const retired = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.body.dispatchEvent(retired);
    expect(retired.defaultPrevented).toBe(false); expect(readCameraSelectionState().blocked).toBe(false);
    fireEvent.keyUp(document.body, { key });
  });
  it('observes same-batch disable before an idle physical press, without waiting for effect cleanup', () => {
    saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'manual', groupScan: false });
    render(strict ? <StrictMode><SwitchScanningController /></StrictMode> : <SwitchScanningController />);
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => { stopScan(); saveConfig({ ...getDefaultConfig(), enabled: false }); document.body.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false); expect(getState().phase).toBe('idle');
    expect(readCameraSelectionState().blocked).toBe(false);
    fireEvent.keyUp(document.body, { key: 'Enter' });
  });
  it('uses live configuration to restart when storage writes are unavailable', () => {
    render(strict ? <StrictMode><SwitchScanningController /></StrictMode> : <SwitchScanningController />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage unavailable', 'QuotaExceededError'); });
    act(() => saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'manual', groupScan: false }));
    expect(getState().phase).toBe('items'); act(() => stopScan());
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(getState().phase).toBe('items'); expect(readCameraSelectionState().blocked).toBe(true);
    fireEvent.keyUp(document.body, { key: 'Enter' });
  });
});
