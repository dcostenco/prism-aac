import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getState, startScan, stopScan, observeKeyboardPresses } from '@/services/switchScanService';

const KEYS = [' ', 'Enter', 'Tab'] as const;
const GROUP_PAINT_COLOR = '#00ff00';
const NAVIGATION_CASES = [
  { mutation: 'insert-before', previous: false, expected: 'C' },
  { mutation: 'insert-before', previous: true, expected: 'A' },
  { mutation: 'remove-before', previous: false, expected: 'C' },
  { mutation: 'remove-before', previous: true, expected: 'C' },
] as const;
const press = (key: string, repeat = false, shiftKey = false) => document.body.dispatchEvent(
  new KeyboardEvent('keydown', { key, repeat, shiftKey, bubbles: true, cancelable: true }));
const release = (key: string) => document.body.dispatchEvent(
  new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
const button = () => {
  const el = document.createElement('button'); el.textContent = 'Native item';
  el.style.position = 'fixed'; document.body.append(el); return el;
};
const group = (name: string) => {
  const root = document.createElement('div'); root.dataset.scanGroup = name;
  const item = button(); root.append(item); document.body.append(root);
  return { root, item };
};
const step = (previous = false) => { press('Tab', false, previous); release('Tab'); };
beforeEach(() => { stopScan(); localStorage.clear(); Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { for (const key of KEYS) release(key); stopScan(); document.body.innerHTML = ''; vi.useRealTimers(); });

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

  describe.each([true, false])('live navigation identity, groupScan=%s', groupScan => {
    it.each(NAVIGATION_CASES)('$mutation, previous=$previous advances from the highlighted identity', async ({ mutation, previous, expected }) => {
      vi.useFakeTimers();
      const a = group('A'), b = group('B'), c = group('C');
      if (mutation === 'insert-before') a.root.remove();
      startScan({ enabled: true, mode: 'manual', groupScan, loops: 0 });
      if (mutation === 'remove-before') step();
      expect(document.querySelector('.switch-scan-active')).toBe(groupScan ? b.root : b.item);
      if (mutation === 'insert-before') document.body.prepend(a.root); else a.root.remove();
      // Exercise both the observer refresh and a fresh key navigation refresh.
      await Promise.resolve(); vi.advanceTimersByTime(200);
      step(previous);
      const target = expected === 'A' ? a : c;
      expect(document.querySelector('.switch-scan-active')).toBe(groupScan ? target.root : target.item);
    });
  });

  it('grouped item navigation stays in the highlighted control owner after an earlier group appears', async () => {
    vi.useFakeTimers();
    const b = group('B'), second = button(); b.root.append(second);
    group('C');
    startScan({ enabled: true, mode: 'manual', groupScan: true, loops: 0 });
    press('Enter'); release('Enter');
    expect(document.querySelector('.switch-scan-active')).toBe(b.item);
    const a = group('A'); document.body.prepend(a.root);
    await Promise.resolve(); vi.advanceTimersByTime(200);
    step();
    expect(getState().phase).toBe('items');
    expect(document.querySelector('.switch-scan-active')).toBe(second);
  });

  it('group-back Escape preserves propagation to the global camera emergency stop', () => {
    const b = group('B'), emergencyStop = vi.fn();
    document.addEventListener('keydown', emergencyStop);
    try {
      startScan({ enabled: true, mode: 'manual', groupScan: true, loops: 0 });
      press('Enter'); release('Enter'); emergencyStop.mockClear();
      expect(press('Escape')).toBe(false);
      expect(getState().phase).toBe('groups');
      expect(document.querySelector('.switch-scan-active')).toBe(b.root);
      expect(emergencyStop).toHaveBeenCalledTimes(1);
    } finally { document.removeEventListener('keydown', emergencyStop); }
  });

  it('keeps keyboard-group highlight inside its clipped shell using the configured color', () => {
    const keyboard = group('keyboard');
    startScan({ enabled: true, mode: 'manual', groupScan: true, loops: 0, highlightColor: GROUP_PAINT_COLOR });
    expect(document.querySelector('.switch-scan-active')).toBe(keyboard.root);
    expect(getComputedStyle(keyboard.root).outlineOffset).toBe('-4px');
    expect(getComputedStyle(keyboard.root).boxShadow).toContain('inset');
    expect(document.getElementById('prism-switch-scan-style')!.textContent).toContain(GROUP_PAINT_COLOR);
    // JSDOM does not reliably model competing !important selector specificity.
    // Pin the specific declaration here; the real browser compares the actual
    // computed color to the persisted configuration after the CSS transition.
    const sheet = (document.getElementById('prism-switch-scan-style') as HTMLStyleElement).sheet!;
    const rule = Array.from(sheet.cssRules).find(rule => rule instanceof CSSStyleRule
      && rule.selectorText.includes('[data-scan-group="keyboard"]')) as CSSStyleRule;
    const colorProbe = document.createElement('span'); colorProbe.style.color = GROUP_PAINT_COLOR;
    expect(rule.style.getPropertyValue('outline-color')).toBe(colorProbe.style.color);
    expect(rule.style.getPropertyPriority('outline-color')).toBe('important');
  });
});
