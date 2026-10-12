#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const FILES = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url), 'utf8')).files;
const BASIC_LANGUAGE_CASES = {
  en: [
    { text: 'bot', word: 'bottles', file: 'w-bottle.png' },
    { text: 'bot', word: 'bother', file: 'w-bother.png' },
    { text: 'gi', word: 'girl', file: 'pp-girl.png' },
    { text: 'gi', word: 'girls', file: 'pp-girl.png' },
    { text: 'boy', word: 'boys', file: 'pp-boy.png' },
    { text: 'came', word: 'cameras', file: 'w-camera.png' },
    { text: 'pill', word: 'pillows', file: 'w-pillow.png' },
    { text: 'pill', word: 'pills', file: 'hb-pill.png' },
    { text: 'there wa', word: 'was', file: 'w-past-being.png' },
    { text: 'q', word: 'quarter', file: 'w-quarter.png' },
    { text: 'q', word: 'quality', file: 'w-quality.png' },
  ],
  ru: [
    { text: 'дев', word: 'девочка', file: 'pp-girl.png' },
    { text: 'де', word: 'день', file: 'w-day.png' },
    { text: 'де', word: 'делать', file: 'cw-do.png' },
    { text: 'бы', word: 'был', file: 'w-past-being.png' },
  ],
  de: [{ text: 'flasch', word: 'flaschen', file: 'w-bottle.png' }],
  es: [{ text: 'botell', word: 'botellas', file: 'w-bottle.png' }],
  fr: [{ text: 'fill', word: 'filles', file: 'pp-girl.png' }],
  ar: [{ text: 'زجاج', word: 'زجاجة', file: 'w-bottle.png' }],
};
const FORM_FIXTURES = JSON.parse(readFileSync(new URL('../tests/fixtures/event-status-word-forms.json', import.meta.url), 'utf8'));
const BLOCKER_FIXTURES = JSON.parse(readFileSync(new URL('../tests/fixtures/basic-language-blocker-browser-cases.json', import.meta.url), 'utf8'));
const FORM_LANGUAGE_CASES = {};
for (const { lang, ...fixture } of FORM_FIXTURES.predictionCases) {
  (FORM_LANGUAGE_CASES[lang] ??= []).push(fixture);
}
const BLOCKER_LANGUAGE_CASES = {};
for (const { lang, ...fixture } of BLOCKER_FIXTURES.cases) {
  (BLOCKER_LANGUAGE_CASES[lang] ??= []).push(fixture);
}
const LANGUAGE_CASES = process.env.PICTURE_TEST_SUITE === 'blocker' ? BLOCKER_LANGUAGE_CASES
  : process.env.PICTURE_TEST_SUITE === 'forms' ? FORM_LANGUAGE_CASES : BASIC_LANGUAGE_CASES;
if (process.env.PICTURE_TEST_SUITE && !['basic', 'forms', 'blocker'].includes(process.env.PICTURE_TEST_SUITE)) {
  throw new Error('The requested picture suite does not exist.');
}
const VIEWPORTS = ['1140x1180', '390x844'];
const COMPATIBILITY_JAMO = Array.from({ length: 0x318f - 0x3131 }, (_, index) => String.fromCodePoint(0x3131 + index));
const GENERATED_PICTURE_ENDPOINT = '/prism-aac/pictogram';
const SETTINGS = { state: { language: 'en', outputLanguage: 'en', theme: 'light', gridSize: 12,
  cloudPredictionEnabled: false, aiAutocorrectEnabled: false }, version: 22 };
const MESSAGE = { state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 };
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'";

if (!process.env.BASE_URL) throw new Error('Set BASE_URL to a fixture-backed loopback build.');
if (process.env.PICTURE_TEST_LANGUAGE && !Object.prototype.hasOwnProperty.call(LANGUAGE_CASES, process.env.PICTURE_TEST_LANGUAGE)) {
  throw new Error('The requested language fixture does not exist.');
}
const upstream = new URL(process.env.BASE_URL);
if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(upstream.hostname)
  || upstream.username || upstream.password) throw new Error('Use a loopback HTTP build.');
const artifacts = process.env.PICTURE_TEST_ARTIFACTS ? path.resolve(process.env.PICTURE_TEST_ARTIFACTS)
  : mkdtempSync(path.join(tmpdir(), 'aac-basic-word-pictures-'));
if (/[\s"'\\]/.test(artifacts)) throw new Error('Use an artifact path without spaces, quotes, or backslashes.');
mkdirSync(artifacts, { recursive: true });
const requests = [];
const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/__basic_word_setup') {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP })
      .end('<!doctype html><title>Vocabulary fixture setup</title><body>Local vocabulary fixture</body>');
    return;
  }
  if (!request.url?.startsWith('/') || !['GET', 'POST'].includes(request.method)) {
    response.writeHead(405).end(); return;
  }
  const forwarded = http.request({ hostname: upstream.hostname, port: upstream.port || 80,
    path: request.url, method: request.method,
    headers: { ...request.headers, host: upstream.host, 'accept-encoding': 'identity' } }, reply => {
    requests.push({ path: request.url, status: reply.statusCode });
    response.writeHead(reply.statusCode || 502, { ...reply.headers, 'content-security-policy': CSP });
    reply.pipe(response);
  });
  forwarded.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.pipe(forwarded);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const tile = word => `[data-testid="prediction-tile"][title="${word}"]`;
const picture = (word, file) => `assert-eval new Promise(resolve=>{const end=Date.now()+15000;const check=async()=>{const node=document.querySelector(${JSON.stringify(tile(word))});const img=node?.querySelector('img');if(node?.dataset.picture==='symbol'&&img?.complete&&img.naturalWidth>0){const bytes=await(await fetch(img.currentSrc)).arrayBuffer();const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(sha===${JSON.stringify(FILES[file].sha256)})return resolve(true);}if(Date.now()>end)resolve(false);else setTimeout(check,100);};check();})`;
const targetsVisible = 'assert-eval (()=>{const nodes=[...document.querySelectorAll("[data-testid=prediction-tile]"),document.querySelector("[data-action=space]"),document.querySelector("button.aac-delete")];return nodes.length===7&&nodes.every(node=>{if(!node)return false;const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&[[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]].every(([x,y])=>node.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)));});})()';

try {
  for (const [language, allFixtures] of Object.entries(LANGUAGE_CASES)) {
  if (process.env.PICTURE_TEST_LANGUAGE && language !== process.env.PICTURE_TEST_LANGUAGE) continue;
  const fixtures = process.env.PICTURE_TEST_WORD ? allFixtures.filter(fixture => fixture.word === process.env.PICTURE_TEST_WORD) : allFixtures;
  if (!fixtures.length) throw new Error('The requested language/word fixture does not exist.');
  for (const viewport of VIEWPORTS) {
    const dir = path.join(artifacts, language, viewport); mkdirSync(dir, { recursive: true });
    const settings = { ...SETTINGS, state: { ...SETTINGS.state, language, outputLanguage: language } };
    const commands = [`open ${origin}/__basic_word_setup`,
      `eval localStorage.setItem('prism-aac-settings',${JSON.stringify(JSON.stringify(settings))});localStorage.setItem('prism-aac-message',${JSON.stringify(JSON.stringify(MESSAGE))});localStorage.setItem('prism-cat-kb-open','true');localStorage.setItem('prism-kb-max','true');sessionStorage.setItem('prism-greeting-dismissed','1');`,
      `open ${origin}/prism-aac`, 'wait-for [data-key]'];
    for (const fixture of fixtures) {
      const expectedText = fixture.expectedText ??
        (fixture.text.includes(' ') ? fixture.text.slice(0, fixture.text.lastIndexOf(' ') + 1) : '') + fixture.word.toLowerCase();
      const keys = language === 'ko' ? [...fixture.text.normalize('NFKD')]
        .map(letter => COMPATIBILITY_JAMO.find(key => key.normalize('NFKD') === letter) ?? letter).join('') : fixture.text;
      const fileCheck = fixture.files
        ? `assert-eval new Promise(resolve=>{const end=Date.now()+15000;const check=async()=>{const node=document.querySelector(${JSON.stringify(tile(fixture.word))});const imgs=[...node?.querySelectorAll('img')??[]];if(imgs.length===${fixture.files.length}&&imgs.every(img=>img.complete&&img.naturalWidth>0)){const hashes=await Promise.all(imgs.map(async img=>{const bytes=await(await fetch(img.currentSrc)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}));if(hashes.join('|')===${JSON.stringify(fixture.files.map(file=>FILES[file].sha256).join('|'))})return resolve(true);}if(Date.now()>end)resolve(false);else setTimeout(check,100);};check();})`
        : picture(fixture.word, fixture.file);
      commands.push(...[...keys].map(letter => letter === ' ' ? 'click [data-action="space"]'
        : `click [data-key=${JSON.stringify(letter.toLocaleUpperCase(language))}]`),
        'eval Array.from(document.querySelectorAll("[data-testid=prediction-tile]")).map(n=>({word:n.title,picture:n.dataset.picture}))',
        'eval ({text:document.querySelector("[data-testid=message-text]")?.textContent,active:document.activeElement?.outerHTML?.slice(0,300)})',
        fileCheck, targetsVisible,
        `screenshot ${path.join(dir, fixture.word + '.png')}`, `click ${tile(fixture.word)}`,
        `assert-eval document.querySelector('[data-testid="message-text"]').textContent.trim().toLowerCase()===${JSON.stringify(expectedText)}`,
        ...Array.from({ length: expectedText.trim().split(/\s+/).length }, () => 'click button.aac-delete'),
        'assert-visible [data-testid="message-empty-prompt"]');
    }
    commands.push('assert-eval !performance.getEntriesByType("resource").some(e=>/arasaac\\.org/.test(e.name))', 'assert-no-page-errors');
    writeFileSync(path.join(dir, 'commands.pipe'), commands.join('\n') + '\n');
    const result = await new Promise((resolve, reject) => {
      const child = spawn('prism', ['browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile', '--local-only',
        '--stealth', 'light', '--skip-fv-check', '--touch', '--viewport', viewport, '--har', path.join(dir, 'network.har'), 'pipe'],
        { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
      const timer = setTimeout(stop, 180000);
      const collect = value => { output += value; if (output.length > 8 * 1024 * 1024) stop(); };
      child.stdout.on('data', collect); child.stderr.on('data', collect);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', status => { clearTimeout(timer); resolve({ status, output }); });
      child.stdin.end(commands.join('\n') + '\n');
    });
    writeFileSync(path.join(dir, 'browser.log'), result.output);
    if (result.status !== 0) throw new Error(`Basic word picture flow failed: ${dir}`);
  }
  }
  writeFileSync(path.join(artifacts, 'requests.json'), JSON.stringify(requests, null, 2) + '\n');
  writeFileSync(path.join(artifacts, 'scope.json'), JSON.stringify({ suite: process.env.PICTURE_TEST_SUITE ?? 'basic', language: process.env.PICTURE_TEST_LANGUAGE ?? 'all',
    word: process.env.PICTURE_TEST_WORD ?? 'all', viewports: VIEWPORTS }, null, 2) + '\n');
  if (requests.some(request => request.path.split('?')[0].endsWith(GENERATED_PICTURE_ENDPOINT))) throw new Error('An approved noun image triggered generation.');
  console.log(`Basic word pictures and exact word selection passed: ${artifacts}`);
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
