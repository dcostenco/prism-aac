#!/usr/bin/env node
// Use a fixture-backed localhost build; this check injects three pack download failures.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);
const MAX_FAULTS = 3;
const PACK = JSON.parse(readFileSync(new URL('../constants/generated/picturePack.json', import.meta.url), 'utf8'));
const FAULT_PATH = `/prism-aac/api/v1/prism-aac/pictures/chunks/${PACK.chunks[0].id}?version=${PACK.version}`;
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self'; object-src 'none'";
const SETTINGS = { state: { language: 'en', outputLanguage: 'en', theme: 'light', gridSize: 12,
  cloudPredictionEnabled: false, aiAutocorrectEnabled: false }, version: 22 };
const MESSAGE = { state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 };
if (!process.env.BASE_URL) throw new Error('Set BASE_URL to a fixture-backed local server origin.');
const upstream = new URL(process.env.BASE_URL);
if (upstream.protocol !== 'http:' || !LOOPBACK_HOSTS.has(upstream.hostname) || upstream.username || upstream.password) {
  throw new Error('Use localhost or 127.0.0.1 over HTTP.');
}
const artifacts = process.env.PICTURE_TEST_ARTIFACTS
  ? path.resolve(process.env.PICTURE_TEST_ARTIFACTS) : mkdtempSync(path.join(tmpdir(), 'aac-picture-recovery-'));
if (/[\s"'\\]/.test(artifacts)) throw new Error('Use an artifact path without spaces, quotes, or backslashes.');
mkdirSync(artifacts, { recursive: true });
const preload = path.join(artifacts, 'browser-init.js');
writeFileSync(preload, `if(location.pathname.startsWith('/prism-aac')) {
localStorage.setItem('prism-aac-settings',JSON.stringify(${JSON.stringify(SETTINGS)}));
localStorage.setItem('prism-aac-message',JSON.stringify(${JSON.stringify(MESSAGE)}));
localStorage.setItem('prism-cat-kb-open','false');localStorage.setItem('prism-kb-max','false');
sessionStorage.setItem('prism-greeting-dismissed','1');}`);
let faults = 0;
const requests = [];
const server = http.createServer((req, res) => {
  if (!req.url?.startsWith('/') || (req.method !== 'GET' && !(req.method === 'POST' && req.url.split('?')[0] === '/prism-aac/api/v1/prism-aac/pictures/access'))) { res.writeHead(405).end(); return; }
  if (req.url === FAULT_PATH && faults < MAX_FAULTS) {
    faults += 1; requests.push({ path: req.url, status: 503 });
    res.writeHead(503, { 'Cache-Control': 'no-store', 'Content-Length': '0' }).end(); return;
  }
  const forwarded = http.request({ hostname: upstream.hostname, port: upstream.port || 80,
    path: req.url, method: req.method, headers: { ...req.headers, host: upstream.host } }, reply => {
    requests.push({ path: req.url, status: reply.statusCode });
    res.writeHead(reply.statusCode ?? 502, { ...reply.headers, 'content-security-policy': CSP });
    reply.pipe(res);
  });
  forwarded.on('error', () => res.writeHead(502).end());
  req.pipe(forwarded);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const ready = word => `assert-eval new Promise(resolve=>{const end=Date.now()+8000;const check=()=>{const tile=document.querySelector('[data-testid="prediction-tile"][title="${word}"]');const img=tile?.querySelector('img');if(tile?.dataset.picture==='symbol'&&img?.complete&&img.naturalWidth>0)resolve(true);else if(Date.now()>end)resolve(false);else setTimeout(check,100);};check();})`;
const commands = [
  `open ${origin}/prism-aac`,
  'assert-eval new Promise(resolve=>setTimeout(()=>resolve(true),8000))',
  'assert-eval document.querySelector(\'[data-testid="prediction-tile"][title="More"]\').dataset.picture === "text"',
  `screenshot ${path.join(artifacts, 'exhausted.png')}`,
  'eval window.dispatchEvent(new Event("online"))',
  'click [data-testid="language-button-input"]', 'click [data-testid="language-option-pt"]',
  'click [data-testid="language-button-output"]', 'click [data-testid="language-option-pt"]', ready('Mais'),
  'click [data-testid="language-button-input"]', 'click [data-testid="language-option-en"]',
  'click [data-testid="language-button-output"]', 'click [data-testid="language-option-en"]', ready('More'),
  `screenshot ${path.join(artifacts, 'recovered.png')}`,
  'click [data-testid="prediction-tile"][title="More"]',
  'assert-eval document.querySelector(\'[data-testid="message-text"]\').textContent.trim().toLowerCase() === "more"',
  'assert-no-page-errors',
];
writeFileSync(path.join(artifacts, 'commands.pipe'), commands.join('\n') + '\n');
let output = '';
try {
  const child = spawn('prism', ['browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile',
    '--local-only', '--stealth', 'light', '--skip-fv-check', '--viewport', '402x874', '--inject', preload,
    '--har', path.join(artifacts, 'network.har'), 'pipe'], { stdio: ['pipe', 'pipe', 'pipe'], detached: true });
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  child.stdin.end(commands.join('\n') + '\n');
  const timer = setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }, 150_000);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  }).finally(() => clearTimeout(timer));
  writeFileSync(path.join(artifacts, 'browser.log'), output);
  writeFileSync(path.join(artifacts, 'requests.json'), JSON.stringify(requests, null, 2) + '\n');
  if (code !== 0 || faults !== MAX_FAULTS) throw new Error(`Recovery failed; inspect ${artifacts}`);
  if (!requests.some(r => r.path === FAULT_PATH && r.status === 200)) throw new Error('No healthy picture-pack response observed.');
  console.log(`Picture recovery and word insertion passed. Artifacts: ${artifacts}`);
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
