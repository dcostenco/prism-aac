#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const origin = process.env.BASE_URL;
if (!origin || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('Use an owned loopback build');
const artifacts = path.resolve(process.env.PICTURE_TEST_ARTIFACTS || 'picture-form-reuse-evidence');
const { newAliases, browserCases } = JSON.parse(readFileSync(new URL('../tests/fixtures/picture-form-reuse.json', import.meta.url)));
const cases = browserCases.filter(row => !process.env.PICTURE_TEST_WORD || row.word === process.env.PICTURE_TEST_WORD);
if (!cases.length) throw new Error('The requested form fixture does not exist');
const { files } = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url)));
const runs = [];
mkdirSync(artifacts, { recursive: true });
for (const viewport of ['390x844', '1140x1180']) {
  const dir = path.join(artifacts, viewport); mkdirSync(dir, { recursive: true });
  const commands = [`open ${origin}/prism-aac`];
  for (const { lang, word, file } of cases) {
    const settings = { state: { language: lang, outputLanguage: lang, theme: 'light', gridSize: 12,
      cloudPredictionEnabled: false, aiAutocorrectEnabled: false }, version: 22 };
    const tile = `[data-testid="prediction-tile"][title="${word}"]`;
    commands.push(
      `eval localStorage.setItem('prism-aac-settings',${JSON.stringify(JSON.stringify(settings))});localStorage.setItem('prism-cat-kb-open','true');localStorage.setItem('prism-kb-max','true');sessionStorage.setItem('prism-greeting-dismissed','1');`,
      `open ${origin}/prism-aac`, 'wait-for [data-testid="message-empty-prompt"]', 'wait-for [data-key]',
      'click [data-testid="language-button-input"]', `click [data-testid="language-option-${lang}"]`,
      `assert-eval document.querySelector('[data-testid="language-button-input"]')?.textContent?.includes(${JSON.stringify(lang.toUpperCase())})`,
      ...[...(lang === 'fr' && word === 'oranges' ? word.slice(0, -2) : word.slice(0, -1))].map(letter => `click [data-key=${JSON.stringify(letter.toLocaleUpperCase(lang))}]`),
      'eval document.querySelector("[data-testid=message-text]")?.textContent',
      'eval Array.from(document.querySelectorAll("[data-testid=prediction-tile]")).map(node=>({word:node.title,picture:node.dataset.picture}))',
      `assert-eval new Promise(resolve=>{const end=Date.now()+20000;const check=async()=>{const node=document.querySelector(${JSON.stringify(tile)});const img=node?.querySelector('img');if(node?.dataset.picture==='symbol'&&img?.complete&&img.naturalWidth>0){const bytes=await(await fetch(img.currentSrc)).arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash===${JSON.stringify(files[file].sha256)})return resolve(true);}if(Date.now()>end)return resolve(false);setTimeout(check,100);};check();})`,
      `screenshot ${path.join(dir, `${lang}-${word}.png`)}`, `click ${tile}`,
      `assert-eval document.querySelector('[data-testid="message-text"]')?.textContent?.trim()===${JSON.stringify(word)}`,
      'assert-no-page-errors',
    );
  }
  writeFileSync(path.join(dir, 'commands.pipe'), commands.join('\n') + '\n');
  const output = [];
  const browser = spawn('prism', ['browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile',
    '--stealth', 'light', '--skip-fv-check', '--device', viewport === '390x844' ? 'iphone-17' : 'ipad-pro-13',
    '--device-scale-factor', '1', '--viewport', viewport, '--har', path.join(dir, 'network.har'), 'pipe'],
  { stdio: ['pipe', 'pipe', 'pipe'] });
  let lastProgress = 0;
  browser.stdout.on('data', data => {
    output.push(data);
    if (Date.now() - lastProgress > 10_000) {
      console.log(`Picture form journey active at ${viewport}`);
      lastProgress = Date.now();
    }
  });
  browser.stderr.on('data', data => output.push(data));
  browser.stdin.end(commands.join('\n') + '\n');
  const deadline = setTimeout(() => { browser.kill('SIGTERM'); }, 180000);
  const code = await new Promise((resolve, reject) => { browser.once('error', reject); browser.once('close', resolve); }).finally(() => clearTimeout(deadline));
  writeFileSync(path.join(dir, 'browser.log'), Buffer.concat(output));
  if (code === 0) {
    const har = JSON.parse(readFileSync(path.join(dir, 'network.har')));
    for (const entry of har.log.entries.filter(entry => entry.request.url.includes('/pictogram') && entry.request.postData?.text)) {
      const body = JSON.parse(entry.request.postData.text);
      if (newAliases.some(row => body.phrase === row.word || body.blockWord?.text === row.word)) {
        throw new Error('An approved noun form requested a cloud picture');
      }
    }
  }
  runs.push({ viewport, exit_code: code });
  writeFileSync(path.join(artifacts, 'status.json'), JSON.stringify(runs, null, 2));
  if (code !== 0) throw new Error(`Multilingual picture reuse failed at ${viewport}`);
}
console.log(`${cases.length} visible-prefix form journeys reuse approved picture bytes and insert their exact word at both viewports`);
