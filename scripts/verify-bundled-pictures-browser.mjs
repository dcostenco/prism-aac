#!/usr/bin/env node
// Local UI regression check using the packaged Prism Browser CLI.
// Usage: BASE_URL=http://localhost:3210 node scripts/verify-bundled-pictures-browser.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const APPROVED_FILES = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url), 'utf8')).files;

// The browser's preload guard requires an IPv4 or localhost URL.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);
const PICTURE_CASES = [
  { prefix: 'CHAMAD', word: 'chamada', file: 'w-call.png' },
  { prefix: 'CUID', word: 'cuidado', file: 'w-danger.png' },
];
const TRADITIONAL_LOCALES = ['zh-Hant', 'zh-HK'];
const SETTINGS_FIXTURE = {
  state: { language: 'en', outputLanguage: 'en', theme: 'light', gridSize: 12,
    cloudPredictionEnabled: false, aiAutocorrectEnabled: false },
  version: 22,
};
const MESSAGE_FIXTURE = { state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 };

if (!process.env.BASE_URL) throw new Error('Set BASE_URL to the local Prism AAC server origin.');
const origin = new URL(process.env.BASE_URL);
if (origin.protocol !== 'http:' || !LOOPBACK_HOSTS.has(origin.hostname) || origin.username || origin.password) {
  throw new Error('Use a loopback HTTP server at localhost or 127.0.0.1.');
}
const artifacts = process.env.PICTURE_TEST_ARTIFACTS
  ? path.resolve(process.env.PICTURE_TEST_ARTIFACTS)
  : mkdtempSync(path.join(tmpdir(), 'aac-picture-browser-'));
if (/[\s"'\\]/.test(artifacts)) throw new Error('Use an artifact path without spaces, quotes, or backslashes.');
mkdirSync(artifacts, { recursive: true });
const preload = path.join(artifacts, 'browser-init.js');
writeFileSync(preload, `
if (location.pathname.startsWith('/prism-aac')) {
  localStorage.setItem('prism-aac-settings', JSON.stringify(${JSON.stringify(SETTINGS_FIXTURE)}));
  localStorage.setItem('prism-aac-message', JSON.stringify(${JSON.stringify(MESSAGE_FIXTURE)}));
  localStorage.setItem('prism-cat-kb-open', 'false');
  localStorage.setItem('prism-kb-max', 'false');
  sessionStorage.setItem('prism-greeting-dismissed', '1');
  window.__pictureRequests = [];
  window.__blobHashes = {};
  const createObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob) {
    const url = createObjectURL(blob);
    if (blob.type === 'image/png') blob.arrayBuffer().then(bytes => crypto.subtle.digest('SHA-256', bytes))
      .then(hash => { window.__blobHashes[url] = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''); });
    return url;
  };
  const fetch = window.fetch;
  window.fetch = function(resource, options) {
    window.__pictureRequests.push(typeof resource === 'string' ? resource : resource.url ?? resource.href);
    return fetch.call(this, resource, options);
  };
}
`);
const commands = [
  `open ${new URL('/prism-aac', origin).href}`,
  'wait-for [data-testid="language-button-input"]',
  'assert-eval Array.isArray(window.__pictureRequests)',
  'assert-eval JSON.parse(localStorage.getItem("prism-aac-settings")).state.cloudPredictionEnabled === false',
  'assert-eval JSON.parse(localStorage.getItem("prism-aac-settings")).state.aiAutocorrectEnabled === false',
  'click button[data-toolbar-button-id="categories"]:visible',
  'wait-for [data-testid="picture-board"]',
  'click [data-testid="language-button-input"]',
  'click [data-testid="language-option-pt"]',
  'click [data-testid="language-button-output"]',
  'click [data-testid="language-option-pt"]',
  'click [data-testid="kb-cycle-btn"]',
  'wait-for [data-key="C"]',
];
for (const { prefix, word, file } of PICTURE_CASES) {
  for (const key of prefix) commands.push(`click [data-key="${key}"]`);
  const tile = `[data-testid="prediction-tile"][title="${word}"]`;
  commands.push(
    `wait-for ${tile}`,
    `assert-eval new Promise(resolve => { const limit=Date.now()+10000; const check=()=>{ const tile=document.querySelector(${JSON.stringify(tile)}); const img=tile?.querySelector('img'); if(tile?.dataset.picture==='symbol' && img?.currentSrc.startsWith('blob:') && img.complete && img.naturalWidth>0) resolve(true); else if(Date.now()>limit) resolve(false); else setTimeout(check,100); }; check(); })`,
    `assert-eval window.__blobHashes[document.querySelector(${JSON.stringify(tile)}).querySelector('img').currentSrc]===${JSON.stringify(APPROVED_FILES[file].sha256)}`,
    `screenshot ${path.join(artifacts, `${word}.png`)}`,
    `click ${tile}`,
    `assert-text [data-testid="message-text"] ${word}`,
    'click button.aac-delete',
    'assert-visible [data-testid="message-empty-prompt"]',
  );
}
commands.push('click [data-testid="kb-cycle-btn"]');
for (const locale of TRADITIONAL_LOCALES) {
  commands.push(
    'click [data-testid="language-button-input"]',
    `click [data-testid="language-option-${locale}"]`,
    'assert-text [data-testid="kb-cycle-btn"] 鍵盤',
    'click [data-testid="kb-cycle-btn"]',
    'assert-text [data-testid="kb-cycle-btn"] 隱藏',
    `screenshot ${path.join(artifacts, `${locale}.png`)}`,
    'click [data-testid="kb-cycle-btn"]',
  );
}
commands.push(
  'assert-eval !Array.from(document.images).some(i => /arasaac\.org/.test(i.src))',
  'assert-eval !performance.getEntriesByType("resource").some(e => /arasaac\.org/.test(e.name))',
  'assert-eval !window.__pictureRequests.some(url => /arasaac\.org|symbols-ai/.test(url))',
  'assert-no-page-errors',
);
writeFileSync(path.join(artifacts, 'commands.pipe'), commands.join('\n') + '\n');
const result = spawnSync('prism', [
  'browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile', '--local-only',
  '--stealth', 'light', '--skip-fv-check', '--viewport', '402x874', '--inject', preload,
  '--har', path.join(artifacts, 'network.har'), 'pipe',
], { input: commands.join('\n') + '\n', encoding: 'utf8', timeout: 150_000, maxBuffer: 8 * 1024 * 1024 });
writeFileSync(path.join(artifacts, 'browser.log'), (result.stdout ?? '') + (result.stderr ?? ''));
if (result.error) throw result.error;
if (result.status !== 0) {
  console.error(`Picture check failed. Inspect ${path.join(artifacts, 'browser.log')}`);
  process.exit(result.status ?? 1);
}
console.log(`Picture and Traditional Chinese UI checks passed. Artifacts: ${artifacts}`);
