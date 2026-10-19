import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import { checkCriticalOcclusion } from '../e2e/helpers/screenshot-validation';

const BOUNDS = { x: 100, y: 100, left: 100, top: 100, right: 200, bottom: 200,
  width: 100, height: 100, toJSON: () => ({}) };
const OPTIONS = { expectedPath: '/prism-aac', criticalSelectors: ['#target'] };
type ProbeArgs = [string[], string[]];
const page = { evaluate: async (fn: (args: ProbeArgs) => unknown, args: ProbeArgs) => fn(args) } as unknown as Page;

beforeEach(() => {
  document.body.innerHTML = '<button id="target" style="border-radius:50%">Continue</button><div id="overlay"></div>';
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(BOUNDS);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn((x: number, y: number) =>
    Math.hypot(x - 150, y - 150) <= 50 ? document.getElementById('target') : document.body) });
});
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(document, 'elementFromPoint'); document.body.innerHTML = ''; });

describe('critical target occlusion', () => {
  it('samples inside a rounded control instead of calling its transparent corners an overlay', async () => {
    expect(await checkCriticalOcclusion(page, OPTIONS)).toEqual([]);
    expect(document.elementFromPoint).toHaveBeenCalledTimes(5);
  });

  it('still rejects an unrelated surface covering an interior quarter-point', async () => {
    vi.mocked(document.elementFromPoint).mockImplementation((x, y) =>
      x < 150 && y < 150 ? document.getElementById('overlay') : document.getElementById('target'));
    expect(await checkCriticalOcclusion(page, OPTIONS)).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'hit_test_blocked' }),
    ]));
  });

  it('still rejects any declared rectangle overlap, not just overlap at sampled points', async () => {
    expect(await checkCriticalOcclusion(page, { ...OPTIONS, occluderSelectors: ['#overlay'] }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'occluded_by' })]));
  });

  it('still rejects a target extending outside the viewport', async () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ ...BOUNDS, left: -1 });
    expect(await checkCriticalOcclusion(page, OPTIONS)).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'clipped_by_viewport' }),
    ]));
  });
});
