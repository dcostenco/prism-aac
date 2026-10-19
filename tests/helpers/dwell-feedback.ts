import { vi } from 'vitest';

export const DWELL_FEEDBACK_CASES = [
  { kind: 'disabled', tag: 'button', attribute: 'disabled', eligible: false },
  { kind: 'aria-disabled', tag: 'button', attribute: 'aria-disabled', eligible: false },
  { kind: 'aria-hidden', tag: 'button', attribute: 'aria-hidden', eligible: false },
  { kind: 'inert', tag: 'button', attribute: 'inert', eligible: false },
  { kind: 'summary', tag: 'summary', eligible: true },
  { kind: 'select', tag: 'select', eligible: true },
  { kind: 'button', tag: 'button', eligible: true },
] as const;

/** DOM feedback tests, not camera pixels or physical gesture recognition. */
export function feedbackTarget(item: typeof DWELL_FEEDBACK_CASES[number]) {
  const target = document.createElement(item.tag);
  if ('attribute' in item) target.setAttribute(item.attribute, 'true');
  if (item.tag === 'button') { target.dataset.key = 'x'; target.dataset.display = 'X'; }
  target.getBoundingClientRect = () => new DOMRect(0, 0, 64, 48);
  document.body.append(target);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target });
  return target;
}

export function feedbackClock() {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  return () => {
    vi.advanceTimersByTime(1300);
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(performance.now()));
  };
}
