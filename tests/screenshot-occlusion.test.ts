import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import { checkCriticalOcclusion } from '../e2e/helpers/screenshot-validation';

const RECT = { left: 100, top: 100, right: 180, bottom: 140, width: 80, height: 40, x: 100, y: 100, toJSON() {} };
const originalHitTest = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
let target: HTMLButtonElement;
const page = { evaluate: async (fn: (value: unknown) => unknown, value: unknown) => fn(value) } as unknown as Page;
beforeEach(() => {
  target = document.createElement('button'); target.id = 'critical';
  document.body.append(target);
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(RECT);
});
afterEach(() => {
  target.remove(); vi.restoreAllMocks();
  if (originalHitTest) Object.defineProperty(document, 'elementFromPoint', originalHitTest);
  else Reflect.deleteProperty(document, 'elementFromPoint');
});
describe('critical-control screenshot gate', () => {
  it('accepts an unobstructed rounded key while its clipped corner pixels hit the background', async () => {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: (x: number, y: number) => {
      const corner = (x < RECT.left + 4 || x > RECT.right - 4) && (y < RECT.top + 4 || y > RECT.bottom - 4);
      return corner ? document.body : target;
    } });
    expect(await checkCriticalOcclusion(page, { expectedPath: '/', criticalSelectors: ['#critical'] })).toEqual([]);
  });
  it('still rejects an overlay covering the readable interior of the key', async () => {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: (x: number) => x < 140 ? document.body : target });
    expect(await checkCriticalOcclusion(page, { expectedPath: '/', criticalSelectors: ['#critical'] }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'hit_test_blocked' })]));
  });
  it('detects an overlay covering the end of a wide Space key', async () => {
    vi.mocked(target.getBoundingClientRect).mockReturnValue({ ...RECT, right: 500, width: 400 });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: (x: number) => x < 140 ? document.body : target });
    expect(await checkCriticalOcclusion(page, { expectedPath: '/', criticalSelectors: ['#critical'] }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'hit_test_blocked' })]));
  });
  it('still rejects a control clipped by the viewport', async () => {
    vi.mocked(target.getBoundingClientRect).mockReturnValue({ ...RECT, left: -1 });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target });
    expect(await checkCriticalOcclusion(page, { expectedPath: '/', criticalSelectors: ['#critical'] }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'clipped_by_viewport' })]));
  });
});
