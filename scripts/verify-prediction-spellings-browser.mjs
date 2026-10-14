#!/usr/bin/env node
// Exercise spelling-aware completion against a local fixture-backed build.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const FILES = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url), 'utf8')).files;
const CASES = [
  { lang: 'ru', text: 'я «иде', word: 'идёт', file: 'cw-go-core.png', expected: 'я «идёт' },
  { lang: 'ro', text: 'eu şco', word: 'școală', file: 'pl-school.png' },
  { lang: 'ko', text: '아'.normalize('NFD'), word: '아파요', file: 'help-hurts.png' },
  { lang: 'fr', text: 'je cafe\u0301', word: 'cafés', file: 'fd-coffee.png' },
  { lang: 'fr', name: 'fr-learned', learnFirst: 'cafe\u0301ine', text: 'je cafe\u0301', word: 'caféine', expected: 'je caféine' },
  { lang: 'hi', text: 'मुझे कृ', word: 'कृपया', file: 'qt-please.png' },
];
const VIEWPORTS = ['1140x1180', '390x844'];
if (!process.env.BASE_URL) throw new Error('Set BASE_URL to a local fixture-backed server.');
const origin = new URL(process.env.BASE_URL);
if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname) || origin.username || origin.password) {
  throw new Error('Use a loopback HTTP origin.');
}
const artifacts = process.env.PICTURE_TEST_ARTIFACTS
  ? path.resolve(process.env.PICTURE_TEST_ARTIFACTS) : mkdtempSync(path.join(tmpdir(), 'aac-spelling-browser-'));
if (/[\s"'\\]/.test(artifacts)) throw new Error('Use an artifact path without spaces, quotes, or backslashes.');
mkdirSync(artifacts, { recursive: true });
const preload = path.join(artifacts, 'browser-init.js');
writeFileSync(preload, `if(location.pathname.startsWith('/prism-aac')) {
const fixture=${JSON.stringify(CASES)}.find(c=>c.lang===new URL(location.href).searchParams.get('spelling'));
const lang=fixture?.lang??'ru';
localStorage.setItem('prism-aac-settings',JSON.stringify({state:{language:lang,outputLanguage:lang,theme:'light',gridSize:12,cloudPredictionEnabled:false,aiAutocorrectEnabled:false},version:22}));
localStorage.setItem('prism-aac-message',JSON.stringify({state:{autoSpeak:false,soundEnabled:false},version:3}));
localStorage.setItem('prism-cat-kb-open','true');localStorage.setItem('prism-kb-max','true');
sessionStorage.setItem('prism-greeting-dismissed','1');
window.__blobHashes={};const create=URL.createObjectURL.bind(URL);
URL.createObjectURL=blob=>{const url=create(blob);if(blob.type==='image/png')blob.arrayBuffer().then(bytes=>crypto.subtle.digest('SHA-256',bytes)).then(hash=>{window.__blobHashes[url]=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');});return url;};
// A capture cannot pass when prediction labels or keyboard controls are obscured.
window.__checkTargets=()=>{
const selectors=['[data-testid="prediction-tile"]','[data-action="space"]','button.aac-delete'];
const targets=selectors.flatMap(s=>Array.from(document.querySelectorAll(s)));
if(targets.length<7)throw new Error('Critical controls not rendered');
for(const el of targets){const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)throw new Error('Critical control clipped: '+el.outerHTML.slice(0,160));const inset=Math.min(r.width,r.height)/4;for(const [x,y] of [[r.left+r.width/2,r.top+r.height/2],[r.left+inset,r.top+inset],[r.right-inset,r.top+inset],[r.left+inset,r.bottom-inset],[r.right-inset,r.bottom-inset]]){if(!el.contains(document.elementFromPoint(x,y)))throw new Error('Critical control occluded: '+el.title);}}
return true;};
}`);
const tile = word => `[data-testid="prediction-tile"][title="${word}"]`;
const picture = (word, file) => `assert-eval new Promise(resolve=>{const end=Date.now()+15000;const check=()=>{const tile=document.querySelector(${JSON.stringify(tile(word))});const img=tile?.querySelector('img');if(tile?.dataset.picture==='symbol'&&img?.complete&&img.naturalWidth>0&&window.__blobHashes[img.currentSrc]===${JSON.stringify(FILES[file].sha256)})resolve(true);else if(Date.now()>end)resolve(false);else setTimeout(check,100);};check();})`;
const exactText = text => `assert-eval document.querySelector('[data-testid="message-text"]').textContent.trim().toLocaleLowerCase()===${JSON.stringify(text.toLocaleLowerCase())}`;
const keyCommands = text => [...text].map(letter => letter === ' ' ? 'click [data-action="space"]'
  : /^[a-z]$/i.test(letter) ? `press ${letter}`
  : `eval document.body.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(letter)},bubbles:true}))`);
for (const viewport of VIEWPORTS) {
  const dir = path.join(artifacts, viewport); mkdirSync(dir, { recursive: true });
  const commands = [
    `open ${new URL('/prism-aac', origin).href}`,
    'wait-for [data-key="Я"]', 'click [data-key="Я"]', picture('в', 'cw-in.png'),
    'assert-eval window.__checkTargets()', `screenshot ${path.join(dir, 'ru-in.png')}`,
    `click ${tile('в')}`, exactText('я в'), 'click button.aac-delete', 'click button.aac-delete',
    'assert-visible [data-testid="message-empty-prompt"]',
    'click [data-key="Я"]', 'click [data-action="space"]', 'click [data-key="И"]', 'click [data-key="Д"]',
    picture('идёт', 'cw-go-core.png'), 'assert-count [data-testid="prediction-tile"][title="идёт"] 1',
    'assert-count [data-testid="prediction-tile"][title="идет"] 0',
    'assert-eval window.__checkTargets()', `screenshot ${path.join(dir, 'ru-go.png')}`,
    'click [data-key="Е"]', picture('идёт', 'cw-go-core.png'),
    `click ${tile('идёт')}`, exactText('я идёт'),
  ];
  // Key events exercise the application's input handler; the CLI needs an
  // evaluated KeyboardEvent for Unicode keys outside its named-key table.
  if (viewport === VIEWPORTS[0]) for (const c of CASES) {
    commands.push(`open ${new URL(`/prism-aac?spelling=${c.lang}`, origin).href}`,
      'wait-for [data-testid="language-button-input"]', 'assert-visible [data-testid="message-empty-prompt"]');
    if (c.learnFirst) commands.push(...keyCommands(c.learnFirst), 'click [data-action="space"]',
      'click button.aac-delete', 'assert-visible [data-testid="message-empty-prompt"]');
    commands.push(...keyCommands(c.text), exactText(c.text), `wait-for ${tile(c.word)}`);
    if (c.file) commands.push(picture(c.word, c.file));
    commands.push('assert-eval window.__checkTargets()',
      `screenshot ${path.join(dir, `${c.name??c.lang}-completion.png`)}`,
      `click ${tile(c.word)}`, exactText(c.expected??(c.text.includes(' ') ? `${c.text.slice(0,c.text.lastIndexOf(' '))} ${c.word}` : c.word)));
  }
  commands.push('assert-eval !performance.getEntriesByType("resource").some(e=>/arasaac\\.org/.test(e.name))', 'assert-no-page-errors');
  writeFileSync(path.join(dir, 'commands.pipe'), commands.join('\n')+'\n');
  const result=spawnSync('prism',['browser','--headless','--fast','--fail-fast','--ephemeral-profile','--local-only','--stealth','light','--skip-fv-check','--touch','--viewport',viewport,'--inject',preload,'--har',path.join(dir,'network.har'),'pipe'],{input:commands.join('\n')+'\n',encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
  writeFileSync(path.join(dir,'browser.log'),(result.stdout??'')+(result.stderr??''));
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Spelling flow failed; inspect ${dir}`);
}
console.log(`Spelling, generated pictures and selection checks passed: ${artifacts}`);
