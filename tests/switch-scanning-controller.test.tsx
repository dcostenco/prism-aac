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
});
