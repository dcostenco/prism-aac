import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { missingStaticPrecache } from '../check-offline-static-precache.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'aac-static-precache-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, '.next/static/chunks'), { recursive: true });
  mkdirSync(path.join(root, 'public/models'), { recursive: true });
  writeFileSync(path.join(root, '.next/static/chunks/app.js'), 'app');
  return root;
}

test('rejects a required chunk excluded from an otherwise populated manifest', t => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'public/sw.js'), 'const manifest=[{"url":"/prism-aac/manifest.json"}]');
  assert.deepEqual(missingStaticPrecache(root), ['/_next/static/chunks/app.js']);
});

test('accepts the compiled graph across base paths while leaving optional models outside the graph', t => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'public/models/optional.bin'), 'optional');
  writeFileSync(path.join(root, '.next/static/chunks/app.js.LICENSE.txt'), 'license');
  writeFileSync(path.join(root, 'public/sw.js'), 'const manifest=[{url:"/prism-aac/_next/static/chunks/app.js"}]');
  assert.deepEqual(missingStaticPrecache(root), []);
});

test('fails closed for a worker without its generated manifest', t => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'public/sw.js'), 'self.addEventListener("fetch",()=>{})');
  assert.throws(() => missingStaticPrecache(root), /no precache manifest/);
});

test('reads the single-quoted manifest emitted by the worker compiler', t => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'public/sw.js'), "const manifest=[{'url':'/prism-aac/_next/static/chunks/app.js'}]");
  assert.deepEqual(missingStaticPrecache(root), []);
});
