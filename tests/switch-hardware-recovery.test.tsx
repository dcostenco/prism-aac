import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SwitchScanningController from '@/components/SwitchScanningController';
import { getDefaultConfig, getState, saveConfig, stopScan } from '@/services/switchScanService';
import { readCameraSelectionState } from '@/services/cameraSelection';

vi.mock('@/engine/useT', () => ({ useT: () => ({ t: (key: string) => key }) }));
const INPUT_KINDS = ['gamepad', 'hid'] as const;
const SCAN_INTERVAL_MS = 1000;
const HID_RELEASE_INTERVAL_MS = 250;
const SCAN_TICK_LIMIT = 10;
const SETUP_MICROTASKS = 6;
type InputKind = typeof INPUT_KINDS[number];
type ReportListener = (event: { data: DataView }) => void;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function hardwareFixture() {
  let pressed = false, frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const reports = new Set<ReportListener>();
  const connections = new Map<string, Set<(event: { device: typeof device }) => void>>();
  const device = {
    opened: false,
    open: vi.fn(async () => { device.opened = true; }),
    close: vi.fn(async () => { device.opened = false; }),
    addEventListener: vi.fn((type: string, listener: ReportListener) => { if (type === 'inputreport') reports.add(listener); }),
    removeEventListener: vi.fn((_type: string, listener: ReportListener) => { reports.delete(listener); }),
  };
  const hid = {
    getDevices: vi.fn(async () => [device]), requestDevice: vi.fn(async () => [device]),
    addEventListener: vi.fn((type: string, listener: (event: { device: typeof device }) => void) => {
      if (!connections.has(type)) connections.set(type, new Set());
      connections.get(type)!.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: (event: { device: typeof device }) => void) => { connections.get(type)?.delete(listener); }),
  };
  const savedGamepads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
  const savedHid = Object.getOwnPropertyDescriptor(navigator, 'hid');
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [{ buttons: [{ pressed }] }] });
  Object.defineProperty(navigator, 'hid', { configurable: true, value: hid });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  const frame = () => {
    const queued = [...frames]; frames.clear();
    for (const [, callback] of queued) callback(performance.now());
  };
  const emit = (kind: InputKind, down: boolean) => {
    if (kind === 'gamepad') { pressed = down; frame(); }
    else for (const listener of [...reports]) listener({ data: new DataView(Uint8Array.of(down ? 1 : 0).buffer) });
  };
  return { device, hid, frames, reports, connections, frame, emit,
    restore() {
      if (savedGamepads) Object.defineProperty(navigator, 'getGamepads', savedGamepads); else Reflect.deleteProperty(navigator, 'getGamepads');
      if (savedHid) Object.defineProperty(navigator, 'hid', savedHid); else Reflect.deleteProperty(navigator, 'hid');
    },
  };
}

let hardware: ReturnType<typeof hardwareFixture>;
async function flushSetup() {
  await act(async () => { for (let step = 0; step < SETUP_MICROTASKS; step++) await Promise.resolve(); });
}
function mount(strict: boolean, onSelect = vi.fn()) {
  saveConfig({ ...getDefaultConfig(), enabled: true, mode: 'auto', groupScan: false, loops: 1, scanSpeedMs: SCAN_INTERVAL_MS });
  const scene = <><SwitchScanningController /><button onClick={onSelect}>Board word</button></>;
  return render(strict ? <StrictMode>{scene}</StrictMode> : scene);
}
function exhaustScan() {
  for (let tick = 0; tick < SCAN_TICK_LIMIT && getState().phase !== 'idle'; tick++) act(() => vi.advanceTimersByTime(SCAN_INTERVAL_MS));
  expect(getState().phase).toBe('idle');
}
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); stopScan();
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
  Element.prototype.scrollIntoView = vi.fn(); hardware = hardwareFixture();
});
afterEach(() => { cleanup(); stopScan(); hardware.restore(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });

describe.each([false, true])('hardware switch recovery, StrictMode=%s', strict => {
  it.each(INPUT_KINDS)('fresh %s restarts finite idle without selecting; a held restart is not a second action', async kind => {
    const selected = vi.fn(); mount(strict, selected); await flushSetup();
    act(() => hardware.frame()); exhaustScan();
    expect(readCameraSelectionState().blocked).toBe(true);
    act(() => hardware.emit(kind, true));
    expect(getState().phase).toBe('items'); expect(selected).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit(kind, true); });
    expect(getState().phase).toBe('items'); expect(screen.getByRole('button', { name: 'scan_stop' })).toBeVisible();
    act(() => hardware.emit(kind, false));
    fireEvent.keyDown(document.body, { key: 'Tab' }); fireEvent.keyUp(document.body, { key: 'Tab' });
    expect(document.querySelector('.switch-scan-active')).toBe(screen.getByRole('button', { name: 'Board word' }));
    act(() => { vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit(kind, true); });
    expect(selected).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit(kind, true); });
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it.each(INPUT_KINDS)('held %s cannot restart a scanner stopped by its selection until release', async kind => {
    const selected = vi.fn(() => stopScan()); mount(strict, selected); await flushSetup();
    act(() => hardware.frame());
    fireEvent.keyDown(document.body, { key: 'Tab' }); fireEvent.keyUp(document.body, { key: 'Tab' });
    act(() => { vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit(kind, true); });
    expect(selected).toHaveBeenCalledTimes(1); expect(getState().phase).toBe('idle');
    act(() => { vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit(kind, true); });
    expect(getState().phase).toBe('idle');
    act(() => { hardware.emit(kind, false); vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit(kind, true); });
    expect(getState().phase).toBe('items'); expect(selected).toHaveBeenCalledTimes(1);
  });

  it('disabled and unmounted controllers retire hardware polling, listeners and camera ownership', async () => {
    const view = mount(strict); await flushSetup(); act(() => hardware.frame());
    fireEvent.click(screen.getByRole('button', { name: 'scan_stop' }));
    expect(getState().phase).toBe('idle'); expect(readCameraSelectionState().blocked).toBe(false);
    expect(hardware.frames.size).toBe(0); expect(hardware.reports.size).toBe(0);
    expect([...hardware.connections.values()].every(listeners => listeners.size === 0)).toBe(true);
    act(() => hardware.emit('gamepad', true)); expect(getState().phase).toBe('idle');
    act(() => saveConfig({ ...getDefaultConfig(), enabled: true })); await flushSetup();
    view.unmount();
    expect(hardware.frames.size).toBe(0); expect(hardware.reports.size).toBe(0);
    expect([...hardware.connections.values()].every(listeners => listeners.size === 0)).toBe(true);
    expect(readCameraSelectionState().blocked).toBe(false);
  });
});

it('does not attach a HID device whose enumeration finishes after disable', async () => {
  const wait = deferred(); hardware.hid.getDevices.mockImplementation(async () => { await wait.promise; return [hardware.device]; });
  mount(false); fireEvent.click(screen.getByRole('button', { name: 'scan_stop' }));
  wait.resolve(); await flushSetup();
  expect(hardware.device.open).not.toHaveBeenCalled(); expect(hardware.reports.size).toBe(0);
  expect([...hardware.connections.values()].every(listeners => listeners.size === 0)).toBe(true);
});

it('closes a HID open finishing after unmount without installing an orphan input listener', async () => {
  const wait = deferred(); hardware.device.open.mockImplementation(async () => { await wait.promise; hardware.device.opened = true; });
  const view = mount(false); await flushSetup(); expect(hardware.device.open).toHaveBeenCalledTimes(1);
  view.unmount(); wait.resolve(); await flushSetup();
  expect(hardware.reports.size).toBe(0); expect(hardware.device.opened).toBe(false);
  expect(readCameraSelectionState().blocked).toBe(false);
});

it('keeps one HID connection across finite restart without reopening or duplicating connection listeners', async () => {
  mount(false); await flushSetup(); act(() => hardware.frame()); exhaustScan();
  act(() => { vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit('hid', true); }); await flushSetup();
  expect(getState().phase).toBe('items'); expect(hardware.device.open).toHaveBeenCalledTimes(1);
  expect(hardware.device.close).not.toHaveBeenCalled(); expect(hardware.reports.size).toBe(1);
  expect([...hardware.connections.values()].map(listeners => listeners.size)).toEqual([1, 1]);
});

it.each(INPUT_KINDS)('same-batch disable prevents an active %s report selecting before React cleanup', async kind => {
  const selected = vi.fn(); mount(false, selected); await flushSetup(); act(() => hardware.frame());
  fireEvent.keyDown(document.body, { key: 'Tab' }); fireEvent.keyUp(document.body, { key: 'Tab' });
  act(() => {
    saveConfig({ ...getDefaultConfig(), enabled: false });
    vi.advanceTimersByTime(HID_RELEASE_INTERVAL_MS); hardware.emit(kind, true);
  });
  expect(selected).not.toHaveBeenCalled(); expect(getState().phase).toBe('idle');
});

it('waits for a retired HID close before re-enabling the same device', async () => {
  const wait = deferred();
  hardware.device.close.mockImplementation(async () => { await wait.promise; hardware.device.opened = false; });
  mount(false); await flushSetup();
  fireEvent.click(screen.getByRole('button', { name: 'scan_stop' }));
  act(() => saveConfig({ ...getDefaultConfig(), enabled: true })); await flushSetup();
  wait.resolve(); await flushSetup();
  expect(hardware.device.opened).toBe(true); expect(hardware.reports.size).toBe(1);
  expect(hardware.device.open).toHaveBeenCalledTimes(2);
});

it('a fresh owner can recover after a retired pending HID open completes', async () => {
  const wait = deferred();
  hardware.device.open.mockImplementationOnce(async () => { await wait.promise; hardware.device.opened = true; });
  mount(false); await flushSetup();
  fireEvent.click(screen.getByRole('button', { name: 'scan_stop' }));
  act(() => saveConfig({ ...getDefaultConfig(), enabled: true })); await flushSetup();
  wait.resolve(); await flushSetup();
  expect(hardware.device.opened).toBe(true); expect(hardware.reports.size).toBe(1);
  expect(hardware.device.open).toHaveBeenCalledTimes(2);
});
