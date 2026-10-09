import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getState, startScan, stopScan, observeKeyboardPresses } from '@/services/switchScanService';

const KEYS = [' ', 'Enter', 'Tab'] as const;
const press = (key: string, repeat = false) => document.body.dispatchEvent(
  new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true }));
const release = (key: string) => document.body.dispatchEvent(
  new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
const button = () => {
  const el = document.createElement('button'); el.textContent = 'Native item';
  el.style.position = 'fixed'; document.body.append(el); return el;
};
beforeEach(() => { stopScan(); localStorage.clear(); Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { for (const key of KEYS) release(key); stopScan(); document.body.innerHTML = ''; });

describe('explicit keyboard selection discipline', () => {
  it.each([' ', 'Enter'])('does not reuse the %s press that enabled the scanner', key => {
    const dispose = observeKeyboardPresses(), item = button(), selected = vi.fn();
    item.addEventListener('click', selected);
    try {
      expect(press(key)).toBe(true); // Inactive observation does not trap manual input.
      startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
      press(key); expect(selected).not.toHaveBeenCalled();
      release(key); press(key); expect(selected).toHaveBeenCalledTimes(1);
    } finally { dispose(); }
  });
  it.each([' ', 'Enter'])('does not retain a ghost %s press when startup has no eligible targets', key => {
    const dispose = observeKeyboardPresses();
    try {
      press(key);
      startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
      expect(getState().phase).toBe('idle'); release(key);
      const item = button(), selected = vi.fn(); item.addEventListener('click', selected);
      startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
      press(key); expect(selected).toHaveBeenCalledTimes(1);
    } finally { dispose(); }
  });
  it.each([' ', 'Enter'])('selects only once while %s is held, including repeat-less duplicate events', key => {
    const item = button(), selected = vi.fn(); item.addEventListener('click', selected);
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
    press(key); press(key, true); press(key);
    expect(selected).toHaveBeenCalledTimes(1);
    release(key); press(key);
    expect(selected).toHaveBeenCalledTimes(2);
  });
  it.each(['detached', 'aria-disabled', 'inert', 'hidden', 'fieldset-disabled'] as const)
    ('does not select a cached %s target or report false selection feedback', defect => {
      const item = button(), selected = vi.fn(), feedback = vi.fn(); item.addEventListener('click', selected);
      startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 }, { onSelect: feedback });
      if (defect === 'detached') item.remove();
      if (defect === 'aria-disabled') item.setAttribute('aria-disabled', 'true');
      if (defect === 'inert') item.setAttribute('inert', '');
      if (defect === 'hidden') item.hidden = true;
      if (defect === 'fieldset-disabled') {
        const fieldset = document.createElement('fieldset'); fieldset.disabled = true;
        document.body.append(fieldset); fieldset.append(item);
      }
      press('Enter'); expect(selected).not.toHaveBeenCalled(); expect(feedback).not.toHaveBeenCalled();
    });
  it('does not click background content after a modal opens before the observer refresh', () => {
    const item = button(), selected = vi.fn(); item.addEventListener('click', selected);
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
    const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    const modalItem = document.createElement('button'); modalItem.textContent = 'Modal item'; modalItem.style.position = 'fixed';
    dialog.append(modalItem); document.body.append(dialog);
    press('Enter'); expect(selected).not.toHaveBeenCalled();
    expect(document.querySelector('.switch-scan-active')).toBe(modalItem);
  });
  it('does not forward old selection feedback into a synchronously restarted scanner', () => {
    const item = button(), replacementFeedback = vi.fn();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
    item.addEventListener('click', () => { stopScan(); startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 }, { onSelect: replacementFeedback }); });
    press('Enter'); expect(getState().phase).toBe('items');
    expect(replacementFeedback).not.toHaveBeenCalled();
  });
  it('preserves the physical press latch across synchronous scanner restart until keyup', () => {
    const one = button(), two = button(), first = vi.fn(), second = vi.fn();
    one.addEventListener('click', () => {
      first(); one.hidden = true; stopScan();
      startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
    });
    two.addEventListener('click', second);
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 0 });
    press('Enter'); press('Enter');
    expect(first).toHaveBeenCalledTimes(1); expect(second).not.toHaveBeenCalled();
    release('Enter'); press('Enter'); expect(second).toHaveBeenCalledTimes(1);
  });
  it('enters the highlighted group identity after earlier groups are inserted', async () => {
    vi.useFakeTimers();
    const b = document.createElement('div'); b.setAttribute('data-scan-group', 'B');
    const itemB = button(); b.append(itemB); document.body.append(b);
    startScan({ enabled: true, mode: 'manual', groupScan: true, loops: 0 });
    const a = document.createElement('div'); a.setAttribute('data-scan-group', 'A');
    a.append(button()); document.body.prepend(a);
    await Promise.resolve(); vi.advanceTimersByTime(200);
    expect(document.querySelector('.switch-scan-active')).toBe(b);
    press('Enter'); expect(document.querySelector('.switch-scan-active')).toBe(itemB);
    vi.useRealTimers();
  });
});
