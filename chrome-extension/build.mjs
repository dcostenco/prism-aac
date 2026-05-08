// Bundles the extension into ./dist with esbuild.
//   • content.js + background.js + options.js as IIFEs
//   • copies manifest.json, options.html, icons/* into dist
//   • --watch enables incremental rebuilds for local dev
import { build, context } from 'esbuild';
import { copyFile, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');

const ENTRY_POINTS = ['content', 'background', 'options'];

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ENTRY_POINTS.map((n) => path.join(SRC, n + '.ts')),
  outdir: OUT,
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  sourcemap: true,
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
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
