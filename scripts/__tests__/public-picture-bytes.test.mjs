import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { scanPublicPictureBytes } from '../check-public-picture-bytes.mjs';

const IMAGE = Buffer.from('synthetic protected image bytes');
const CHUNK = Buffer.from('synthetic protected chunk bytes');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const FILES = { files: { 'test.png': { sha256: sha256(IMAGE) } } };
const PACK = { version: sha256(Buffer.concat([IMAGE, CHUNK])), chunks: [{ sha256: sha256(CHUNK) }] };

async function fixture(callback) {
  const root = await mkdtemp(path.join(tmpdir(), 'aac-public-byte-guard-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    await writeFile(path.join(root, '.gitignore'), '*.png\n*.aacpack\n');
    await callback(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('rejects forced library images and renamed pack chunks using indexed bytes', async () => fixture(async root => {
  await writeFile(path.join(root, 'picture.png'), IMAGE);
  await writeFile(path.join(root, 'chunk.bin'), CHUNK);
  execFileSync('git', ['add', '--force', '--', 'picture.png', 'chunk.bin'], { cwd: root });
  // A changed worktree must not conceal what was actually staged for publication.
  await writeFile(path.join(root, 'picture.png'), 'harmless working copy');
  assert.deepEqual(scanPublicPictureBytes(root, FILES, PACK).blocked.sort(), ['chunk.bin', 'picture.png']);
}));

test('rejects pack formats and names independently of a pinned pack hash', async () => fixture(async root => {
  await writeFile(path.join(root, 'library.bin'), Buffer.from('PAACPK01unlisted-pack'));
  await writeFile(path.join(root, 'library.AACPACK'), 'unlisted chunk');
  execFileSync('git', ['add', '--force', '--', 'library.bin', 'library.AACPACK'], { cwd: root });
  assert.deepEqual(scanPublicPictureBytes(root, FILES, PACK).blocked.sort(), ['library.AACPACK', 'library.bin']);
}));

test('permits different screenshot bytes, attribution, and normal source assets', async () => fixture(async root => {
  await writeFile(path.join(root, 'screen.png'), 'synthetic capture bytes');
  await writeFile(path.join(root, 'ATTRIBUTION.txt'), 'Attribution');
  await writeFile(path.join(root, 'icon.svg'), '<svg/>');
  execFileSync('git', ['add', '--force', '--', 'screen.png', 'ATTRIBUTION.txt', 'icon.svg'], { cwd: root });
  assert.deepEqual(scanPublicPictureBytes(root, FILES, PACK), { scanned: 3, blocked: [] });
}));

test('rejects missing protection metadata instead of silently passing', async () => fixture(async root => {
  assert.throws(() => scanPublicPictureBytes(root, {}, {}), /missing or invalid/);
  assert.throws(() => scanPublicPictureBytes(root, { files: {} }, PACK), /missing or invalid/);
}));

test('a symlinked guard invocation still scans and blocks protected indexed bytes', async () => fixture(async root => {
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'constants/generated'), { recursive: true });
  const script = path.join(root, 'scripts/check-public-picture-bytes.mjs');
  await writeFile(script, await readFile(new URL('../check-public-picture-bytes.mjs', import.meta.url)));
  await writeFile(path.join(root, 'constants/generated/phraseSymbolFiles.json'), JSON.stringify(FILES));
  await writeFile(path.join(root, 'constants/generated/picturePack.json'), JSON.stringify(PACK));
  await writeFile(path.join(root, 'picture.bin'), IMAGE);
  execFileSync('git', ['add', '--', 'picture.bin'], { cwd: root });
  const alias = path.join(root, 'guard-alias.mjs');
  await symlink(script, alias);
  const result = spawnSync(process.execPath, [alias], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Protected picture bytes cannot be published/);
}));
