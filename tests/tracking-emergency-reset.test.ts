import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CAMERA_WRIST_SOURCE } from '@/services/cameraTrackingTargets';

const layout = readFileSync('app/layout.tsx', 'utf8');
const literal = layout.match(/const trackingResetScript = (`[\s\S]*?`);/)!;
const script = new Function('CAMERA_WRIST_SOURCE', `return ${literal[1]}`)(CAMERA_WRIST_SOURCE);
const KEYS = ['prism-pose-calibration', 'prism-pose-calibration-landscape', 'prism-head-calibration',
  `prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`, `prism-${CAMERA_WRIST_SOURCE}-calibration-portrait`];
describe.each(['', '?reset=tracking'])('explicit emergency camera reset %s', search => {
  it('resets both coordinate systems only when explicitly requested, preserving unrelated AAC data', () => {
    const data = new Map(KEYS.map(key => [key, 'saved-profile'])); data.set('unrelated-aac-data', 'keep');
    const storage = { get length() { return data.size; }, key: (i: number) => [...data.keys()][i],
      getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key) };
    const replace = vi.fn();
    new Function('window', script)({ localStorage: storage, location: { search, hash: '', pathname: '/prism-aac', replace } });
    for (const key of KEYS) expect(data.has(key)).toBe(search === '');
    expect(data.get('unrelated-aac-data')).toBe('keep');
    expect(replace).toHaveBeenCalledTimes(search ? 1 : 0);
  });
});
