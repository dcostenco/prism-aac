import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installNativePicturePack, runCli, PACK_MAGIC, PNG_SIGNATURE } from '../prepare-native-picture-pack.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), 8 + data.length);
  return chunk;
}

function createPng(seed, width = 256, height = 32) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  row[0] = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 4;
    row[offset] = seed;
    row[offset + 1] = 40;
    row[offset + 2] = 90;
    row[offset + 3] = 255;
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function makeFixture(root, {
  includeChunk = true,
  filename = 'test_one.png',
  corruptChunk = false,
  imageWidth = 256,
  imageHeight = 32,
} = {}) {
  const packDir = path.join(root, 'input');
  const outputDir = path.join(root, 'output');
  await mkdir(packDir, { recursive: true });
  const images = new Map([
    [filename, createPng(50, imageWidth, imageHeight)],
    ...(filename === 'test_one.png' ? [['test-two.png', createPng(90, imageWidth, imageHeight)]] : []),
  ]);
  const files = Object.fromEntries([...images.entries()].map(([name, bytes]) => [name, { sha256: sha256(bytes) }]));
  const orderedImages = [...images.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const index = { files: {} };
  let offset = 0;
  for (const [name, bytes] of orderedImages) {
    index.files[name] = { offset, length: bytes.length, sha256: sha256(bytes) };
    offset += bytes.length;
  }
  const indexBytes = Buffer.from(JSON.stringify(index), 'utf8');
  const header = Buffer.alloc(12);
  PACK_MAGIC.copy(header);
  header.writeUInt32BE(indexBytes.length, 8);
  const pack = Buffer.concat([header, indexBytes, ...orderedImages.map(([, bytes]) => bytes)]);
  let chunk = Buffer.from(pack);
  if (corruptChunk) chunk[chunk.length - 1] ^= 0xff;
  const manifest = {
    format: 1,
    version: sha256(pack),
    byteLength: pack.length,
    fileCount: orderedImages.length,
    indexByteLength: indexBytes.length,
    chunks: [{ id: '0000', byteLength: pack.length, sha256: sha256(pack) }],
  };
  const symbols = {
    generatedFrom: 'fixture',
    note: 'fixture metadata',
    phrases: { 'test-phrase': filename },
    categories: { basics: 'test-two.png' },
    words: { sample: filename },
    wordOnly: [],
  };
  const basicVocabulary = {
    generatedFrom: 'fixture reviewed word mappings',
    languages: { en: { sample: { file: filename, means: 'Reviewed sample meaning' } } },
  };
  const bytes = {
    manifestBytes: Buffer.from(JSON.stringify(manifest)),
    symbolsBytes: Buffer.from(JSON.stringify(symbols)),
    basicVocabularyBytes: Buffer.from(JSON.stringify(basicVocabulary)),
    reviewedFilesBytes: Buffer.from(JSON.stringify({ files })),
    attributionBytes: Buffer.from('Reviewed picture attribution fixture\n', 'utf8'),
  };
  if (includeChunk) await writeFile(path.join(packDir, 'pictures-0000.aacpack'), chunk);
  return { packDir, outputDir, pack, manifest, symbols, ...bytes };
}

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(homedir(), '.native-picture-pack-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function assertOutputAbsent(outputDir) {
  await assert.rejects(lstat(outputDir), { code: 'ENOENT' });
}

test('a symlinked CLI invocation validates arguments instead of silently succeeding', async (t) => {
  const root = await temporaryRoot(t);
  const alias = path.join(root, 'install-alias.mjs');
  await symlink(fileURLToPath(new URL('../prepare-native-picture-pack.mjs', import.meta.url)), alias);
  const result = spawnSync(process.execPath, [alias], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Provide --output-dir/);
});

test('installs the unchanged verified pack and metadata without unpacked PNG files', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root);
  const result = await installNativePicturePack(fixture);

  assert.equal(result.version, fixture.manifest.version);
  assert.equal(result.fileCount, 2);
  assert.deepEqual(await readFile(path.join(fixture.outputDir, 'AACPictures.aacpack')), fixture.pack);
  assert.deepEqual(await readFile(path.join(fixture.outputDir, 'aacPictureManifest.json')), fixture.manifestBytes);
  const installedSymbols = JSON.parse(await readFile(path.join(fixture.outputDir, 'aacPictureSymbols.json'), 'utf8'));
  const { basicVocabulary: installedBasicVocabulary, ...installedPhraseSymbols } = installedSymbols;
  assert.deepEqual(installedPhraseSymbols, fixture.symbols);
  assert.deepEqual(installedBasicVocabulary, JSON.parse(fixture.basicVocabularyBytes));
  assert.deepEqual(await readFile(path.join(fixture.outputDir, 'AACPictureAttribution.txt')), fixture.attributionBytes);
  assert.deepEqual((await readdir(fixture.outputDir)).sort(), [
    'AACPictureAttribution.txt', 'AACPictures.aacpack', 'aacPictureManifest.json', 'aacPictureSymbols.json',
  ]);
});

test('rejects corrupt chunks before creating output', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root, { corruptChunk: true });
  await assert.rejects(installNativePicturePack(fixture), /length or SHA-256/);
  await assertOutputAbsent(fixture.outputDir);
});

test('preserves picture-only alias metadata when installing the native library', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root);
  const basic = JSON.parse(fixture.basicVocabularyBytes);
  basic.languages.en.sample.predictionSeed = false;
  fixture.basicVocabularyBytes = Buffer.from(JSON.stringify(basic));
  await installNativePicturePack(fixture);
  const installed = JSON.parse(await readFile(path.join(fixture.outputDir, 'aacPictureSymbols.json'), 'utf8'));
  assert.deepEqual(installed.basicVocabulary, basic);
});

test('rejects malformed prediction flags and unrelated fields before native installation', async (t) => {
  for (const extra of [{ predictionSeed: 'false' }, { predictionSeed: 0 }, { predictionSeed: null }, { unknownField: false }]) {
    const root = await temporaryRoot(t);
    const fixture = await makeFixture(root);
    const basic = JSON.parse(fixture.basicVocabularyBytes);
    Object.assign(basic.languages.en.sample, extra);
    fixture.basicVocabularyBytes = Buffer.from(JSON.stringify(basic));
    await assert.rejects(installNativePicturePack(fixture), /Basic vocabulary picture entry is invalid/);
    await assertOutputAbsent(fixture.outputDir);
  }
});

test('rejects a mismatched reviewed hash for a referenced basic vocabulary image', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root);
  const reviewed = JSON.parse(fixture.reviewedFilesBytes);
  reviewed.files['test_one.png'].sha256 = '0'.repeat(64);
  fixture.reviewedFilesBytes = Buffer.from(JSON.stringify(reviewed));
  await assert.rejects(installNativePicturePack(fixture), /index entry is invalid/);
  await assertOutputAbsent(fixture.outputDir);
});

test('rejects basic vocabulary entries whose filename is unsafe or outside the approved pack', async (t) => {
  for (const file of ['../outside.png', 'unpacked.png']) {
    const root = await temporaryRoot(t);
    const fixture = await makeFixture(root);
    const basic = JSON.parse(fixture.basicVocabularyBytes);
    basic.languages.en.sample.file = file;
    fixture.basicVocabularyBytes = Buffer.from(JSON.stringify(basic));
    await assert.rejects(installNativePicturePack(fixture), /Basic vocabulary picture entry is invalid/);
    await assertOutputAbsent(fixture.outputDir);
  }
});

test('preserves both reviewed meanings and their context in the installed native metadata', async (t) => {
  const fixture = await makeFixture(await temporaryRoot(t));
  const basic = JSON.parse(fixture.basicVocabularyBytes);
  basic.alternatives = { en: { sample: { files: ['test_one.png', 'test-two.png'],
    means: 'Two explicitly reviewed sample meanings',
    contexts: [{ before: ['known'], file: 'test_one.png' }] } } };
  fixture.basicVocabularyBytes = Buffer.from(JSON.stringify(basic));
  await installNativePicturePack(fixture);
  const installed = JSON.parse(await readFile(path.join(fixture.outputDir, 'aacPictureSymbols.json'), 'utf8'));
  assert.deepEqual(installed.basicVocabulary.alternatives, basic.alternatives);
});

test('rejects ambiguous meanings that would show an unapproved picture or duplicate a single sense', async (t) => {
  for (const files of [['test_one.png', '../outside.png'], ['test_one.png', 'unpacked.png'], ['test_one.png', 'test_one.png']]) {
    const fixture = await makeFixture(await temporaryRoot(t));
    const basic = JSON.parse(fixture.basicVocabularyBytes);
    basic.alternatives = { en: { sample: { files, means: 'Reviewed sample meanings' } } };
    fixture.basicVocabularyBytes = Buffer.from(JSON.stringify(basic));
    await assert.rejects(installNativePicturePack(fixture), /Alternative vocabulary entry is invalid/);
    await assertOutputAbsent(fixture.outputDir);
  }
});

test('rejects a context that could select a picture outside the word’s reviewed meanings', async (t) => {
  const fixture = await makeFixture(await temporaryRoot(t));
  const basic = JSON.parse(fixture.basicVocabularyBytes);
  basic.alternatives = { en: { sample: { files: ['test_one.png', 'test-two.png'],
    means: 'Reviewed sample meanings', contexts: [{ before: ['known'], file: 'unpacked.png' }] } } };
  fixture.basicVocabularyBytes = Buffer.from(JSON.stringify(basic));
  await assert.rejects(installNativePicturePack(fixture), /Alternative vocabulary context is invalid/);
  await assertOutputAbsent(fixture.outputDir);
});

test('rejects English word-map filenames outside the reviewed pack', async (t) => {
  for (const file of ['../outside.png', 'unpacked.png']) {
    const root = await temporaryRoot(t);
    const fixture = await makeFixture(root);
    const symbols = JSON.parse(fixture.symbolsBytes);
    symbols.words.sample = file;
    fixture.symbolsBytes = Buffer.from(JSON.stringify(symbols));
    await assert.rejects(installNativePicturePack(fixture), /unapproved words entry/);
    await assertOutputAbsent(fixture.outputDir);
  }
});

test('rejects missing chunks before creating output', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root, { includeChunk: false });
  await assert.rejects(installNativePicturePack(fixture), /does not match the approved chunk set/);
  await assertOutputAbsent(fixture.outputDir);
});

test('CLI requires an explicit private pack input and output before writing', async (t) => {
  const root = await temporaryRoot(t);
  const outputDir = path.join(root, 'output');
  await assert.rejects(runCli(['--output-dir', outputDir], {}), /AAC_PICTURE_PACK_DIR/);
  await assertOutputAbsent(outputDir);
});

test('rejects a pack exceeding the native runtime bound before creating output', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root);
  const manifest = { ...fixture.manifest, byteLength: 16 * 1024 * 1024 + 1 };
  fixture.manifestBytes = Buffer.from(JSON.stringify(manifest));
  await assert.rejects(installNativePicturePack(fixture), /invalid shape or bounds/);
  await assertOutputAbsent(fixture.outputDir);
});

test('rejects PNG dimensions outside the runtime-supported range before creating output', async (t) => {
  for (const [width, height] of [[256, 31], [512, 512], [31, 256]]) {
    const root = await temporaryRoot(t);
    const fixture = await makeFixture(root, { imageWidth: width, imageHeight: height });
    await assert.rejects(installNativePicturePack(fixture), /invalid dimensions/);
    await assertOutputAbsent(fixture.outputDir);
  }
});

test('rejects unsafe reviewed names before creating output', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root, { filename: '../escape.png' });
  await assert.rejects(installNativePicturePack(fixture), /Reviewed picture file entry is invalid/);
  await assertOutputAbsent(fixture.outputDir);
});

test('rejects symlink input roots and output ancestors before writing', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root);
  const linkedInput = path.join(root, 'input-link');
  await symlink(fixture.packDir, linkedInput, 'dir');
  await assert.rejects(installNativePicturePack({ ...fixture, packDir: linkedInput }), /symlinks/);
  await assertOutputAbsent(fixture.outputDir);

  const realParent = path.join(root, 'real-parent');
  const linkedParent = path.join(root, 'output-link');
  await mkdir(realParent);
  await symlink(realParent, linkedParent, 'dir');
  const linkedOutput = path.join(linkedParent, 'bundle');
  await assert.rejects(installNativePicturePack({ ...fixture, outputDir: linkedOutput }), /symlinks/);
  await assert.rejects(lstat(path.join(realParent, 'bundle')), { code: 'ENOENT' });
});

test('rejects a symlink output file before replacing it', async (t) => {
  const root = await temporaryRoot(t);
  const fixture = await makeFixture(root);
  await mkdir(fixture.outputDir);
  const sentinel = path.join(root, 'sentinel');
  await writeFile(sentinel, 'unchanged');
  await symlink(sentinel, path.join(fixture.outputDir, 'AACPictures.aacpack'));

  await assert.rejects(installNativePicturePack(fixture), /not a regular file/);
  assert.equal(await readFile(sentinel, 'utf8'), 'unchanged');
  assert.deepEqual((await readdir(fixture.outputDir)), ['AACPictures.aacpack']);
});
