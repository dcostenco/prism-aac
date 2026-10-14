#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_ASSET = /\.(?:js|css|woff2?|ttf|otf|wasm)$/i;
const STATIC_DIRECTORY = '.next/static';

/** A successful worker build must retain the app's compiled static graph. */
export function missingStaticPrecache(root) {
  const worker = readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  const urls = [...worker.matchAll(/(?:["']url["']|\burl)\s*:\s*(["'])([^"'\n\\]+)\1/g)]
    .map(match => new URL(match[2], 'https://offline-check.invalid').pathname);
  if (!urls.length) throw new Error('Generated worker has no precache manifest');
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (entry.isFile() && REQUIRED_ASSET.test(entry.name)) files.push(filename);
    }
  };
  walk(path.join(root, STATIC_DIRECTORY));
  if (!files.length) throw new Error('Build has no compiled static assets');
  return files.map(filename => '/_next/' + path.relative(path.join(root, '.next'), filename).split(path.sep).join('/'))
    .filter(filename => !urls.some(url => url.endsWith(filename))).sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const missing = missingStaticPrecache(process.cwd());
    if (missing.length) throw new Error(`Required offline assets omitted from precache:\n${missing.join('\n')}`);
    console.log('Offline static precache: complete');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
