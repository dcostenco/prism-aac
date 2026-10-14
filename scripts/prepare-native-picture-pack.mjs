#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

export const CHUNK_LIMIT = 2_500_000;
export const MANIFEST_LIMIT = 512 * 1024;
export const PACK_LIMIT = 16 * 1024 * 1024;
export const PACK_MAGIC = Buffer.from('PAACPK01', 'ascii');
export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const PNG_NAME_RE = /^[a-z0-9][a-z0-9_-]*\.png$/;
export const CHUNK_ID_RE = /^[0-9]{4}$/;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
export const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'constants/generated/picturePack.json');
export const DEFAULT_SYMBOLS = path.join(REPO_ROOT, 'constants/generated/phraseSymbols.json');
export const DEFAULT_BASIC_VOCABULARY = path.join(REPO_ROOT, 'constants/generated/basicVocabularyPictures.json');
export const DEFAULT_REVIEWED_FILES = path.join(REPO_ROOT, 'constants/generated/phraseSymbolFiles.json');
export const DEFAULT_ATTRIBUTION = path.join(REPO_ROOT, 'public/symbols/ATTRIBUTION.txt');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireSafeAbsolutePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || !path.isAbsolute(value) || value.includes('\0')) {
    throw new Error(`${label} must be an explicit absolute path`);
  }
  if (value.split(path.sep).includes('..')) throw new Error(`${label} cannot contain parent traversal`);
  const resolved = path.resolve(value);
  if (resolved === path.parse(resolved).root) throw new Error(`${label} cannot be a filesystem root`);
  return resolved;
}

async function assertNoSymlinkPath(value, label, { allowMissing = false } = {}) {
  const resolved = requireSafeAbsolutePath(value, label);
  const root = path.parse(resolved).root;
  let current = root;
  for (const component of resolved.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') return resolved;
      throw new Error(`${label} path component is unavailable: ${current}`);
    }
    if (info.isSymbolicLink()) throw new Error(`${label} cannot traverse symlinks`);
    if (!info.isDirectory()) throw new Error(`${label} path component is not a directory`);
  }
  return resolved;
}

async function ensureSafeDirectory(value, label) {
  const resolved = requireSafeAbsolutePath(value, label);
  const root = path.parse(resolved).root;
  let current = root;
  for (const component of resolved.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`${label} cannot traverse non-directory paths`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await mkdir(current);
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`${label} directory is unsafe`);
    }
  }
  return resolved;
}

async function readBoundedRegularFile(filePath, label, limit = MANIFEST_LIMIT) {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} must be a regular file`);
  if (info.size < 1 || info.size > limit) throw new Error(`${label} exceeds its size bounds`);
  return readFile(filePath);
}

function parseJsonBytes(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MANIFEST_LIMIT) {
    throw new Error(`${label} exceeds its size bounds`);
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error(`${label} is invalid UTF-8 JSON: ${error.message}`);
  }
  return value;
}

function validateManifest(manifest, reviewedNames) {
  if (!isRecord(manifest) || Object.keys(manifest).sort().join(',') !== 'byteLength,chunks,fileCount,format,indexByteLength,version'
    || manifest.format !== 1 || !/^[a-f0-9]{64}$/.test(manifest.version || '')
    || !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength < 13 || manifest.byteLength > PACK_LIMIT
    || manifest.fileCount !== reviewedNames.length || manifest.fileCount < 1
    || !Number.isSafeInteger(manifest.indexByteLength) || manifest.indexByteLength < 1
    || manifest.indexByteLength > MANIFEST_LIMIT || !Array.isArray(manifest.chunks) || manifest.chunks.length < 1) {
    throw new Error('Picture pack manifest has an invalid shape or bounds');
  }

  const expectedChunkCount = Math.ceil(manifest.byteLength / CHUNK_LIMIT);
  if (manifest.chunks.length !== expectedChunkCount) {
    throw new Error('Picture pack manifest has an invalid chunk count');
  }
  let total = 0;
  for (let i = 0; i < manifest.chunks.length; i += 1) {
    const chunk = manifest.chunks[i];
    if (!isRecord(chunk) || Object.keys(chunk).sort().join(',') !== 'byteLength,id,sha256'
      || chunk.id !== String(i).padStart(4, '0') || !CHUNK_ID_RE.test(chunk.id)
      || !Number.isSafeInteger(chunk.byteLength) || chunk.byteLength < 1 || chunk.byteLength > CHUNK_LIMIT
      || !/^[a-f0-9]{64}$/.test(chunk.sha256 || '')) {
      throw new Error(`Picture pack manifest has invalid chunk metadata at index ${i}`);
    }
    const expectedLength = Math.min(CHUNK_LIMIT, manifest.byteLength - total);
    if (chunk.byteLength !== expectedLength) throw new Error(`Picture chunk has an invalid boundary at index ${i}`);
    total += chunk.byteLength;
    if (total > PACK_LIMIT) throw new Error('Picture pack exceeds its total size bound');
  }
  if (total !== manifest.byteLength) throw new Error('Picture pack chunk lengths do not match the manifest');
  return manifest;
}

function validateReviewedFiles(reviewed) {
  if (!isRecord(reviewed) || !isRecord(reviewed.files) || Object.keys(reviewed.files).length < 1) {
    throw new Error('Reviewed picture file map is missing or empty');
  }
  const names = Object.keys(reviewed.files).sort();
  for (const name of names) {
    const entry = reviewed.files[name];
    if (!PNG_NAME_RE.test(name) || !isRecord(entry) || Object.keys(entry).length !== 1
      || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) {
      throw new Error(`Reviewed picture file entry is invalid: ${name}`);
    }
  }
  return names;
}

function validateSymbols(symbols, approvedNames) {
  if (!isRecord(symbols) || !isRecord(symbols.phrases) || !isRecord(symbols.categories)
    || !isRecord(symbols.words) || !Array.isArray(symbols.wordOnly)) {
    throw new Error('Picture symbol metadata has an invalid shape');
  }
  const approved = new Set(approvedNames);
  for (const section of ['phrases', 'categories', 'words']) {
    for (const [key, filename] of Object.entries(symbols[section])) {
      if (typeof key !== 'string' || key.length === 0 || typeof filename !== 'string'
        || !PNG_NAME_RE.test(filename) || !approved.has(filename)) {
        throw new Error(`Picture symbol metadata contains an unapproved ${section} entry`);
      }
    }
  }
  if (symbols.wordOnly.some((word) => typeof word !== 'string' || word.length === 0)) {
    throw new Error('Picture symbol metadata contains an invalid word-only entry');
  }
}

function validateBasicVocabulary(basicVocabulary, approvedNames) {
  if (!isRecord(basicVocabulary) || typeof basicVocabulary.generatedFrom !== 'string'
    || !isRecord(basicVocabulary.languages) || Object.keys(basicVocabulary.languages).length > 64) {
    throw new Error('Basic vocabulary picture metadata has an invalid shape');
  }
  const approved = new Set(approvedNames);
  for (const [language, words] of Object.entries(basicVocabulary.languages)) {
    if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(language) || !isRecord(words)) {
      throw new Error(`Basic vocabulary language entry is invalid: ${language}`);
    }
    for (const [word, entry] of Object.entries(words)) {
      if (!word.trim() || word.length > 128 || !isRecord(entry)
        || !['file,means', 'file,means,predictionSeed'].includes(Object.keys(entry).sort().join(','))
        || (Object.hasOwn(entry, 'predictionSeed') && typeof entry.predictionSeed !== 'boolean')
        || typeof entry.file !== 'string' || !PNG_NAME_RE.test(entry.file) || !approved.has(entry.file)
        || typeof entry.means !== 'string' || !entry.means.trim() || entry.means.length > 2_048) {
        throw new Error(`Basic vocabulary picture entry is invalid: ${language}:${word}`);
      }
    }
  }
  if (basicVocabulary.alternatives !== undefined) {
    if (!isRecord(basicVocabulary.alternatives)) throw new Error('Alternative vocabulary metadata is invalid');
    for (const [language, words] of Object.entries(basicVocabulary.alternatives)) {
      if (!Object.prototype.hasOwnProperty.call(basicVocabulary.languages, language) || !isRecord(words)) {
        throw new Error('Alternative vocabulary language is invalid');
      }
      for (const [word, entry] of Object.entries(words)) {
        if (!word.trim() || word.length > 128 || !isRecord(entry) || !Array.isArray(entry.files)
          || entry.files.length < 2 || entry.files.length > 3 || new Set(entry.files).size !== entry.files.length
          || entry.files.some(file => typeof file !== 'string' || !PNG_NAME_RE.test(file) || !approved.has(file))
          || typeof entry.means !== 'string' || !entry.means.trim()) {
          throw new Error(`Alternative vocabulary entry is invalid: ${language}:${word}`);
        }
        if (entry.contexts !== undefined && (!Array.isArray(entry.contexts) || entry.contexts.length > 32
          || entry.contexts.some(context => !isRecord(context) || !entry.files.includes(context.file)
            || !Array.isArray(context.before) || context.before.length > 32
            || context.before.some(value => typeof value !== 'string' || !value.trim())))) {
          throw new Error(`Alternative vocabulary context is invalid: ${language}:${word}`);
        }
      }
    }
  }
  return basicVocabulary;
}

function validatePngHeader(filename, bytes) {
  if (!PNG_NAME_RE.test(filename) || bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`Indexed image is not a valid PNG header: ${filename}`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (Math.min(width, height) < 32 || Math.max(width, height) !== 256) {
    throw new Error(`Indexed PNG has invalid dimensions: ${filename}`);
  }
}

async function readChunks(packDir, manifest) {
  const names = await readdir(packDir);
  const expectedNames = manifest.chunks.map(({ id }) => `pictures-${id}.aacpack`).sort();
  const actualNames = names.slice().sort();
  if (actualNames.length !== expectedNames.length || actualNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error('Picture input directory does not match the approved chunk set');
  }

  const chunks = [];
  for (const chunk of manifest.chunks) {
    const filename = `pictures-${chunk.id}.aacpack`;
    const filePath = path.join(packDir, filename);
    const bytes = await readBoundedRegularFile(filePath, filename, CHUNK_LIMIT);
    if (bytes.length !== chunk.byteLength || sha256(bytes) !== chunk.sha256) {
      throw new Error(`Picture chunk failed its length or SHA-256 check: ${filename}`);
    }
    chunks.push(bytes);
  }
  return chunks;
}

function verifyPackBytes(pack, manifest, reviewedNames, reviewed, symbols) {
  if (pack.length !== manifest.byteLength || sha256(pack) !== manifest.version
    || !pack.subarray(0, PACK_MAGIC.length).equals(PACK_MAGIC)) {
    throw new Error('Reconstructed picture pack failed its version or header check');
  }
  const indexLength = pack.readUInt32BE(8);
  if (indexLength !== manifest.indexByteLength || indexLength > pack.length - 12) {
    throw new Error('Picture pack index length does not match the manifest');
  }

  let index;
  try {
    index = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(pack.subarray(12, 12 + indexLength)));
  } catch (error) {
    throw new Error(`Picture pack index is invalid UTF-8 JSON: ${error.message}`);
  }
  if (!isRecord(index) || Object.keys(index).length !== 1 || !isRecord(index.files)) {
    throw new Error('Picture pack index has an invalid shape');
  }
  if (!Buffer.from(JSON.stringify(index), 'utf8').equals(pack.subarray(12, 12 + indexLength))) {
    throw new Error('Picture pack index is not canonically encoded');
  }

  const indexedNames = Object.keys(index.files);
  if (indexedNames.length !== reviewedNames.length || indexedNames.some((name, i) => name !== reviewedNames[i])) {
    throw new Error('Picture pack index does not match the approved file set and ordering');
  }
  const dataStart = 12 + indexLength;
  let nextOffset = 0;
  for (const name of indexedNames) {
    const entry = index.files[name];
    if (!PNG_NAME_RE.test(name) || !isRecord(entry)
      || Object.keys(entry).sort().join(',') !== 'length,offset,sha256'
      || entry.offset !== nextOffset || !Number.isSafeInteger(entry.length) || entry.length < 1
      || entry.sha256 !== reviewed.files[name].sha256) {
      throw new Error(`Picture pack index entry is invalid: ${name}`);
    }
    const start = dataStart + entry.offset;
    const end = start + entry.length;
    if (end > pack.length) throw new Error(`Picture pack image range is out of bounds: ${name}`);
    const image = pack.subarray(start, end);
    if (sha256(image) !== entry.sha256) throw new Error(`Picture image SHA-256 mismatch: ${name}`);
    validatePngHeader(name, image);
    nextOffset += entry.length;
  }
  if (dataStart + nextOffset !== pack.length) throw new Error('Picture pack has trailing or missing image bytes');
  validateSymbols(symbols, reviewedNames);
}

async function validateOutputFiles(outputDir) {
  for (const filename of ['AACPictures.aacpack', 'aacPictureManifest.json', 'aacPictureSymbols.json', 'AACPictureAttribution.txt']) {
    try {
      const info = await lstat(path.join(outputDir, filename));
      if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Native picture output is not a regular file: ${filename}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function assertDisjointDirectories(inputDir, outputDir) {
  const relative = path.relative(inputDir, outputDir);
  const reverse = path.relative(outputDir, inputDir);
  const isContained = (value) => value === '' || (!value.startsWith(`..${path.sep}`) && value !== '..' && !path.isAbsolute(value));
  if (isContained(relative) || isContained(reverse)) throw new Error('Picture input and output directories must be separate');
}

export async function installNativePicturePack({
  packDir,
  outputDir,
  manifestBytes,
  symbolsBytes,
  basicVocabularyBytes,
  reviewedFilesBytes,
  attributionBytes,
}) {
  const inputPath = await assertNoSymlinkPath(packDir, 'Picture input directory');
  const inputInfo = await lstat(inputPath);
  if (!inputInfo.isDirectory()) throw new Error('Picture input path must be a directory');
  const outputPath = await assertNoSymlinkPath(outputDir, 'Native picture output directory', { allowMissing: true });
  assertDisjointDirectories(inputPath, outputPath);

  const manifest = parseJsonBytes(manifestBytes, 'Picture pack manifest');
  const symbols = parseJsonBytes(symbolsBytes, 'Picture symbol metadata');
  const reviewed = parseJsonBytes(reviewedFilesBytes, 'Reviewed picture file map');
  if (!Buffer.isBuffer(attributionBytes) || attributionBytes.length < 1 || attributionBytes.length > MANIFEST_LIMIT) {
    throw new Error('Picture attribution text exceeds its size bounds');
  }
  const reviewedNames = validateReviewedFiles(reviewed);
  const basicVocabulary = validateBasicVocabulary(
    parseJsonBytes(basicVocabularyBytes, 'Basic vocabulary picture metadata'), reviewedNames,
  );
  validateManifest(manifest, reviewedNames);
  validateSymbols(symbols, reviewedNames);

  const chunks = await readChunks(inputPath, manifest);
  const pack = Buffer.concat(chunks, manifest.byteLength);
  verifyPackBytes(pack, manifest, reviewedNames, reviewed, symbols);

  await validateOutputFiles(outputPath);
  await ensureSafeDirectory(outputPath, 'Native picture output directory');
  const outputFiles = {
    'AACPictures.aacpack': pack,
    'aacPictureManifest.json': manifestBytes,
    'aacPictureSymbols.json': Buffer.from(JSON.stringify({ ...symbols, basicVocabulary }), 'utf8'),
    'AACPictureAttribution.txt': attributionBytes,
  };
  if (outputFiles['aacPictureSymbols.json'].length > MANIFEST_LIMIT) {
    throw new Error('Combined native picture metadata exceeds its size bounds');
  }
  for (const [filename, bytes] of Object.entries(outputFiles)) {
    await writeFile(path.join(outputPath, filename), bytes);
  }
  return {
    version: manifest.version,
    fileCount: manifest.fileCount,
    byteLength: manifest.byteLength,
    outputDir: outputPath,
    outputFiles: Object.keys(outputFiles),
  };
}

async function readMetadataFile(filePath, label) {
  const parent = await assertNoSymlinkPath(path.dirname(filePath), `${label} directory`);
  const file = path.join(parent, path.basename(filePath));
  return readBoundedRegularFile(file, label);
}

export async function runCli(argv, env = process.env) {
  let outputDir;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output-dir' && argv[index + 1]) outputDir = argv[++index];
    else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  if (!outputDir) throw new Error('Provide --output-dir');
  if (!env.AAC_PICTURE_PACK_DIR) throw new Error('AAC_PICTURE_PACK_DIR must name the immutable picture input directory');

  const manifestBytes = await readMetadataFile(DEFAULT_MANIFEST, 'Picture pack manifest');
  const symbolsBytes = await readMetadataFile(DEFAULT_SYMBOLS, 'Picture symbol metadata');
  const basicVocabularyBytes = await readMetadataFile(DEFAULT_BASIC_VOCABULARY, 'Basic vocabulary picture metadata');
  const reviewedFilesBytes = await readMetadataFile(DEFAULT_REVIEWED_FILES, 'Reviewed picture file map');
  const attributionBytes = await readMetadataFile(DEFAULT_ATTRIBUTION, 'Picture attribution text');
  return installNativePicturePack({
    packDir: env.AAC_PICTURE_PACK_DIR,
    outputDir,
    manifestBytes,
    symbolsBytes,
    basicVocabularyBytes,
    reviewedFilesBytes,
    attributionBytes,
  });
}

function invokedDirectly() {
  try {
    return !!process.argv[1]
      && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

if (invokedDirectly()) {
  runCli(process.argv.slice(2))
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
