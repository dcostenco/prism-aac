#!/usr/bin/env node

/**
 * Generate complete Traditional Chinese script variants from the canonical
 * Simplified `zh` entries. OpenCC converts characters and regional orthography;
 * it does NOT translate Standard Written Chinese into colloquial Cantonese.
 * Runtime code imports only the generated JSON, so iPad startup does not pay
 * for the converter bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenCC from 'opencc-js/cn2t';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sourcePath = path.join(root, 'constants', 'phraseTranslations.ts');
const outputPath = path.join(root, 'constants', 'generated', 'chinesePhraseVariants.json');
const source = fs.readFileSync(sourcePath, 'utf8');

// Every phrase translation is authored on one line. The zh value contains
// Chinese text and punctuation but no unescaped single quote; keep the parser
// deliberately narrow and fail if the source shape changes.
const entryPattern = /^\s*'([^']+)':\s*\{[^\n]*\bzh:\s*'((?:\\'|[^'])*)'/gm;
const simplifiedById = new Map();
for (const match of source.matchAll(entryPattern)) {
  simplifiedById.set(match[1], match[2].replaceAll("\\'", "'"));
}

const declaredChineseEntries = (source.match(/\bzh:\s*'/g) ?? []).length;
if (simplifiedById.size === 0 || simplifiedById.size !== declaredChineseEntries) {
  throw new Error(
    `Chinese phrase parse mismatch: parsed=${simplifiedById.size} declared=${declaredChineseEntries}`,
  );
}

const toTaiwan = OpenCC.Converter({ from: 'cn', to: 'tw' });
const toHongKong = OpenCC.Converter({ from: 'cn', to: 'hk' });
const translations = Object.fromEntries(
  [...simplifiedById.entries()].map(([id, simplified]) => [
    id,
    {
      'zh-Hant': toTaiwan(simplified),
      'zh-HK': toHongKong(simplified),
    },
  ]),
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({
  generatedFrom: 'constants/phraseTranslations.ts#zh',
  generator: 'opencc-js@1.4.1',
  coverage: {
    'zh-Hant': 'orthographic-variant-of-standard-written-chinese',
    'zh-HK': 'orthographic-variant-of-standard-written-chinese',
  },
  translations,
}, null, 2)}\n`);

console.log(`Generated ${simplifiedById.size} Chinese phrase variants at ${outputPath}`);
