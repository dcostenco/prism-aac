import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA256 = /^[a-f0-9]{64}$/;
const PACK_MAGIC = Buffer.from('PAACPK01', 'ascii');
const MAX_GIT_OUTPUT = 256 * 1024 * 1024;
const REGULAR_MODES = new Set(['100644', '100755']);

export function scanPublicPictureBytes(repositoryRoot, files, pack) {
  if (!files?.files || typeof files.files !== 'object' || Array.isArray(files.files)
    || !Object.keys(files.files).length || !Array.isArray(pack?.chunks) || !pack.chunks.length) {
    throw new Error('Protected picture manifests are missing or invalid.');
  }
  const hashes = [...Object.values(files.files).map(file => file.sha256), pack?.version,
    ...(pack?.chunks ?? []).map(chunk => chunk.sha256)];
  if (hashes.length < 3 || hashes.some(hash => typeof hash !== 'string' || !SHA256.test(hash))) {
    throw new Error('Protected picture manifests are missing or invalid.');
  }
  const protectedHashes = new Set(hashes);
  const entries = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: repositoryRoot, maxBuffer: MAX_GIT_OUTPUT })
    .toString('utf8').split('\0').filter(Boolean).map(value => {
      const match = value.match(/^(\d{6}) ([a-f0-9]{40,64}) (\d)\t([\s\S]*)$/);
      if (!match || match[3] !== '0') throw new Error('The indexed tree must have no unresolved entries.');
      return { mode: match[1], object: match[2], filename: match[4] };
    }).filter(entry => REGULAR_MODES.has(entry.mode));
  const blobs = execFileSync('git', ['cat-file', '--batch'], {
    cwd: repositoryRoot, input: entries.map(entry => entry.object + '\n').join(''), maxBuffer: MAX_GIT_OUTPUT,
  });
  const blocked = [];
  let offset = 0;
  for (const entry of entries) {
    const end = blobs.indexOf(10, offset);
    const header = blobs.subarray(offset, end).toString('ascii').match(/^([a-f0-9]{40,64}) blob (\d+)$/);
    if (end < 0 || !header || header[1] !== entry.object) throw new Error('Cannot read the indexed file bytes.');
    const size = Number(header[2]);
    const bytes = blobs.subarray(end + 1, end + 1 + size);
    if (!Number.isSafeInteger(size) || bytes.length !== size || blobs[end + 1 + size] !== 10) throw new Error('Truncated indexed file bytes.');
    offset = end + 2 + size;
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (/\.aacpack$/i.test(entry.filename) || bytes.subarray(0, PACK_MAGIC.length).equals(PACK_MAGIC) || protectedHashes.has(hash)) {
      blocked.push(entry.filename);
    }
  }
  return { scanned: entries.length, blocked };
}

function invokedDirectly() {
  try {
    return !!process.argv[1]
      && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

if (invokedDirectly()) {
  try {
    const files = JSON.parse(readFileSync(path.join(ROOT, 'constants/generated/phraseSymbolFiles.json'), 'utf8'));
    const pack = JSON.parse(readFileSync(path.join(ROOT, 'constants/generated/picturePack.json'), 'utf8'));
    const result = scanPublicPictureBytes(ROOT, files, pack);
    for (const filename of result.blocked) console.error(`Protected picture bytes cannot be published: ${JSON.stringify(filename)}`);
    console.log(`picture-byte guard: ${result.blocked.length ? 'blocked' : 'clean'} (${result.scanned} indexed regular files scanned)`);
    if (result.blocked.length) process.exitCode = 1;
  } catch (error) {
    console.error(`picture-byte guard failed: ${error.message}`);
    process.exitCode = 1;
  }
}
