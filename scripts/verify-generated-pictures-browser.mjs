#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const origin = process.env.BASE_URL;
if (!origin) throw new Error('BASE_URL is required');
const target = new URL(origin);
if (target.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw new Error('Use an owned loopback test build');
const artifacts = path.resolve(process.env.PICTURE_TEST_ARTIFACTS || 'generated-picture-evidence');
mkdirSync(artifacts, { recursive: true });
const settings = { state: { language: 'en', outputLanguage: 'en', theme: 'light', gridSize: 12,
  cloudPredictionEnabled: false, aiAutocorrectEnabled: false }, version: 22 };
const message = { state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 };
const moreHash = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url))).files['cw-more.png'].sha256;
const cupcakeHash = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url))).files['fd-cupcake.png'].sha256;
const cabinet = '[data-testid="prediction-tile"][title="cupboard"]';
const cups = '[data-testid="prediction-tile"][title="cups"]';
const cupcake = '[data-testid="prediction-tile"][title="cupcake"]';
const cupcakes = '[data-testid="prediction-tile"][title="cupcakes"]';
const waitPicture = (selector, kind) => `assert-eval new Promise(resolve=>{const end=Date.now()+90000;const check=()=>{const node=document.querySelector(${JSON.stringify(selector)});const image=node?.querySelector('img');if(node?.dataset.picture===${JSON.stringify(kind)}&&image?.complete&&image.naturalWidth>0)return resolve(true);if(Date.now()>end)return resolve(false);setTimeout(check,100);};check();})`;
const cabinetHash = `eval (async()=>{const image=document.querySelector(${JSON.stringify(cabinet)})?.querySelector('img');const bytes=await(await fetch(image.currentSrc)).arrayBuffer();return{meaning:'cupboard',width:image.naturalWidth,height:image.naturalHeight,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')};})()`;
const clickWord = `click ${cabinet}`;
const runs = [];

for (const viewport of ['390x844', '1140x1180']) {
  const dir = path.join(artifacts, viewport); mkdirSync(dir, { recursive: true });
  const commands = [
    `open ${origin}/prism-aac`,
    `eval localStorage.setItem('prism-aac-settings',${JSON.stringify(JSON.stringify(settings))});localStorage.setItem('prism-aac-message',${JSON.stringify(JSON.stringify(message))});localStorage.setItem('prism-cat-kb-open','true');localStorage.setItem('prism-kb-max','true');sessionStorage.setItem('prism-greeting-dismissed','1');`,
    `open ${origin}/prism-aac`, 'wait-for [data-key]',
    waitPicture('[data-testid="prediction-tile"][title="More"]', 'symbol'),
    `assert-eval (async()=>{const img=document.querySelector('[data-testid="prediction-tile"][title="More"] img');const bytes=await(await fetch(img.currentSrc)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')===${JSON.stringify(moreHash)};})()`,
    'click [data-key="C"]', 'click [data-key="U"]', 'click [data-key="P"]',
    `wait-for ${cabinet}`, `screenshot ${path.join(dir, 'loading.png')}`,
    waitPicture(cups, 'symbol'), waitPicture(cupcake, 'symbol'), waitPicture(cupcakes, 'symbol'), waitPicture(cabinet, 'generated'),
    `assert-eval (async()=>{const hashes=await Promise.all([${JSON.stringify(cupcake)},${JSON.stringify(cupcakes)}].map(async selector=>{const img=document.querySelector(selector)?.querySelector('img');const bytes=await(await fetch(img.currentSrc)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}));return hashes.every(hash=>hash===${JSON.stringify(cupcakeHash)});})()`,
    `assert-eval (()=>{const node=document.querySelector(${JSON.stringify(cabinet)});const r=node.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()`,
    cabinetHash, `screenshot ${path.join(dir, 'ready.png')}`, clickWord,
    'assert-text [data-testid="message-text"] cupboard', `screenshot ${path.join(dir, 'selected.png')}`,
    `open ${origin}/prism-aac`,
    'wait-for [data-testid="message-empty-prompt"]', 'wait-for [data-key]',
    'click [data-key="C"]', 'click [data-key="U"]', 'click [data-key="P"]',
    waitPicture(cabinet, 'generated'), waitPicture(cupcakes, 'symbol'), cabinetHash,
    `screenshot ${path.join(dir, 'reloaded-cache.png')}`, `click ${cupcakes}`,
    'assert-eval document.querySelector("[data-testid=message-text]")?.textContent?.trim()==="cupcakes"',
    `screenshot ${path.join(dir, 'plural-selected.png')}`, 'assert-no-page-errors',
  ];
  writeFileSync(path.join(dir, 'commands.pipe'), commands.join('\n') + '\n');
  const log = [];
  const browser = spawn('prism', ['browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile',
    '--stealth', 'light', '--skip-fv-check', '--device', viewport === '390x844' ? 'iphone-17' : 'ipad-pro-13',
    '--device-scale-factor', '1', '--viewport', viewport, '--har', path.join(dir, 'network.har'), 'pipe'],
  { stdio: ['pipe', 'pipe', 'pipe'] });
  browser.stdout.on('data', data => log.push(data)); browser.stderr.on('data', data => log.push(data));
  browser.stdin.end(commands.join('\n') + '\n');
  const deadline = setTimeout(() => { browser.kill('SIGTERM'); }, 180000);
  const code = await new Promise((resolve, reject) => { browser.once('error', reject); browser.once('close', resolve); }).finally(() => clearTimeout(deadline));
  writeFileSync(path.join(dir, 'browser.log'), Buffer.concat(log));
  if (code === 0) {
    const har = JSON.parse(readFileSync(path.join(dir, 'network.har'), 'utf8'));
    const pluralCalls = har.log.entries.filter(entry => entry.request.url.includes('/pictogram')
      && entry.request.postData?.text && JSON.parse(entry.request.postData.text).phrase === 'cupcakes');
    if (pluralCalls.length) throw new Error('The reviewed plural requested a cloud picture');
  }
  runs.push({ viewport, exit_code: code });
  writeFileSync(path.join(artifacts, 'status.json'), JSON.stringify(runs, null, 2));
  if (code !== 0) throw new Error(`Picture browser journey failed at ${viewport}`);
}
console.log('Existing pictures, generated picture, exact selection and reload cache passed at both viewports');
