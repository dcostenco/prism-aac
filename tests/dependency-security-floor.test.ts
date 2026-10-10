/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Floors from the open dependency advisories reviewed for this release. Do
// not turn a pre-existing alert into an accepted future vulnerable resolution.
const ROOT_FLOORS = {
  next: '16.3.8', sharp: '0.35.5', handlebars: '4.7.10',
  'source-map-js': '1.2.2', 'brace-expansion': '5.0.12',
  katex: '0.18.2',
};
const EXTENSION_FLOORS = { 'source-map-js': '1.2.2' };
const TARGETS = [
  { manifest: 'package-lock.json', floors: ROOT_FLOORS },
  { manifest: 'chrome-extension/package-lock.json', floors: EXTENSION_FLOORS },
];
const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const ROOT = path.resolve(__dirname, '..');
const PIXEL_SOURCE = { width: 2, height: 2, channels: 3 as const, background: '#00ff00' };
const PIXEL_OUTPUT_SIZE = 1;

function atLeast(actual: string, minimum: string): boolean {
  const version = STABLE_VERSION.exec(actual)?.slice(1).map(Number);
  const floor = STABLE_VERSION.exec(minimum)?.slice(1).map(Number);
  if (!version || !floor) return false;
  for (let index = 0; index < floor.length; index++) {
    if (version[index] !== floor[index]) return version[index] > floor[index];
  }
  return true;
}

describe.each(TARGETS)('security floors in $manifest', ({ manifest, floors }) => {
  const lock = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', manifest), 'utf8')) as {
    packages: Record<string, { version?: string }>;
  };
  it.each(Object.entries(floors))('%s resolves only to a vetted stable floor or newer (%s)', (name, minimum) => {
    const suffix = `node_modules/${name}`;
    const versions = Object.entries(lock.packages).filter(([entry]) => entry === suffix || entry.endsWith(`/${suffix}`));
    expect(versions.length, `${name} must be present in the audited graph`).toBeGreaterThan(0);
    for (const [entry, installed] of versions) {
      expect(atLeast(installed.version ?? '', minimum), `${entry}: ${installed.version} below ${minimum}`).toBe(true);
    }
  });
});

it('the security comparison rejects older patches and unvetted prerelease tags', () => {
  expect(atLeast('16.3.3', ROOT_FLOORS.next)).toBe(false);
  expect(atLeast('16.3.8-rc.1', ROOT_FLOORS.next)).toBe(false);
  expect(atLeast('16.3.8', ROOT_FLOORS.next)).toBe(true);
  expect(atLeast('16.4.0', ROOT_FLOORS.next)).toBe(true);
});

it('retains every Sharp platform binding in the lock, not only a patched JavaScript wrapper', () => {
  const installed = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/sharp/package.json'), 'utf8')) as {
    optionalDependencies: Record<string, string>;
  };
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, { version: string; optionalDependencies?: Record<string, string> }>;
  };
  expect(lock.packages['node_modules/sharp'].optionalDependencies).toEqual(installed.optionalDependencies);
  for (const [name, version] of Object.entries(installed.optionalDependencies)) {
    expect(lock.packages[`node_modules/${name}`]?.version, `${name} must not disappear during a host-specific lock refresh`).toBe(version);
  }
});

it('the patched Sharp wrapper and native binding can produce and reopen a PNG', async () => {
  const fromSharp = createRequire(path.join(ROOT, 'node_modules/sharp/package.json'));
  const libc = process.platform === 'linux' ? (fromSharp('detect-libc') as { familySync: () => string }).familySync() : '';
  const platform = process.platform === 'linux' && libc === 'musl' ? 'linuxmusl' : process.platform;
  const binding = fs.realpathSync(fromSharp.resolve(`@img/sharp-${platform}-${process.arch}/sharp.node`));
  expect(binding.startsWith(path.join(ROOT, 'node_modules') + path.sep), `must not borrow an ancestor binding: ${binding}`).toBe(true);
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: PIXEL_SOURCE }).resize(PIXEL_OUTPUT_SIZE, PIXEL_OUTPUT_SIZE).png().toBuffer();
  const result = await sharp(png).metadata();
  expect(result.format).toBe('png'); expect(result.width).toBe(PIXEL_OUTPUT_SIZE); expect(result.height).toBe(PIXEL_OUTPUT_SIZE);
});
