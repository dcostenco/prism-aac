// Bundles the extension into ./dist with esbuild.
//   • content.js + background.js + options.js as IIFEs
//   • copies manifest.json, options.html, icons/* into dist
//   • --watch enables incremental rebuilds for local dev
//   • --package additionally writes prism-aac-ext-vX.Y.Z.zip ready for
//     the Chrome Web Store (developer dashboard → Upload package)
import { build, context } from 'esbuild';
import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { createDeflateRaw } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');

const ENTRY_POINTS = ['content', 'background', 'options'];

const watch = process.argv.includes('--watch');
const pkg = process.argv.includes('--package');

const buildOptions = {
  entryPoints: ENTRY_POINTS.map((n) => path.join(SRC, n + '.ts')),
  outdir: OUT,
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  // Sourcemaps help local debugging but bloat the Chrome Web Store
  // upload by ~3× and aren't useful in production. Drop them in
  // --package mode; keep them in dev builds.
  sourcemap: !pkg,
  minify: pkg,
  logLevel: 'info',
};

async function copyStatic() {
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, 'icons'), { recursive: true });
  await copyFile(path.join(ROOT, 'manifest.json'), path.join(OUT, 'manifest.json'));
  await copyFile(path.join(SRC, 'options.html'), path.join(OUT, 'options.html'));
  // Icons may be missing on a fresh checkout — fail soft.
  try {
    const iconFiles = await readdir(path.join(ROOT, 'icons'));
    for (const f of iconFiles) {
      if (!/\.(png|svg)$/i.test(f)) continue;
      await cp(path.join(ROOT, 'icons', f), path.join(OUT, 'icons', f));
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    console.warn('[build] icons/ missing — Chrome will use a default icon.');
  }
}

async function makeZip() {
  // Hand-rolled ZIP writer (no zip-* npm dep). The Chrome Web Store
  // accepts a ZIP with manifest.json at the root + the extension's
  // files. We deflate-compress each entry; CRC32 is computed over the
  // raw bytes per the ZIP spec.
  const manifest = JSON.parse(await readFile(path.join(OUT, 'manifest.json'), 'utf8'));
  const version = manifest.version || '0.0.0';
  const zipPath = path.join(ROOT, `prism-aac-ext-v${version}.zip`);

  // Walk OUT and collect every file path (relative).
  async function walk(dir, base = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      const p = path.join(dir, e.name);
      const rel = base ? base + '/' + e.name : e.name;
      if (e.isDirectory()) out.push(...await walk(p, rel));
      else out.push({ abs: p, rel });
    }
    return out;
  }
  const files = await walk(OUT);

  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;
  const chunks = [];

  for (const f of files) {
    const data = await readFile(f.abs);
    const compressed = await new Promise((resolve, reject) => {
      const deflater = createDeflateRaw();
      const parts = [];
      deflater.on('data', (c) => parts.push(c));
      deflater.on('end', () => resolve(Buffer.concat(parts)));
      deflater.on('error', reject);
      deflater.end(data);
    });
    const crc = crc32(data);
    const nameBuf = Buffer.from(f.rel, 'utf8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);            // version needed
    localHeader.writeUInt16LE(0, 6);             // gp flag
    localHeader.writeUInt16LE(8, 8);             // compression: deflate
    localHeader.writeUInt16LE(0, 10);            // mod time
    localHeader.writeUInt16LE(0, 12);            // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    chunks.push(localHeader, nameBuf, compressed);
    const lhSize = localHeader.length + nameBuf.length + compressed.length;

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);                // version made by
    central.writeUInt16LE(20, 6);                // version needed
    central.writeUInt16LE(0, 8);                 // gp flag
    central.writeUInt16LE(8, 10);                // compression: deflate
    central.writeUInt16LE(0, 12);                // mod time
    central.writeUInt16LE(0, 14);                // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);                // extra field length
    central.writeUInt16LE(0, 32);                // file comment length
    central.writeUInt16LE(0, 34);                // disk number
    central.writeUInt16LE(0, 36);                // internal attrs
    central.writeUInt32LE(0, 38);                // external attrs
    central.writeUInt32LE(offset, 42);
    centralHeaders.push(Buffer.concat([central, nameBuf]));
    localHeaders.push({ offset, size: lhSize });
    offset += lhSize;
  }

  const centralBuf = Buffer.concat(centralHeaders);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const finalBuf = Buffer.concat([...chunks, centralBuf, eocd]);
  await writeFile(zipPath, finalBuf);
  console.log(`[build] packaged: ${path.relative(ROOT, zipPath)} (${(finalBuf.length / 1024).toFixed(1)} KB, ${files.length} entries)`);
}

// CRC-32 / IEEE polynomial. Pure-JS so we don't pull in node:crypto's
// streaming API for one tiny call.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await copyStatic();
  if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log('[build] watching… (Ctrl-C to stop)');
  } else {
    await build(buildOptions);
    console.log('[build] dist/ ready — load it via chrome://extensions → "Load unpacked".');
    if (pkg) await makeZip();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
