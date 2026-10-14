import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:57770/prism-aac');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error('Use a loopback fixture-backed app build.');
}
const artifacts = process.env.PICTURE_TEST_ARTIFACTS || mkdtempSync(path.join(tmpdir(), 'aac-picture-startup-'));
const viewports = ['1140x1180', '390x844', '820x1180'];
const pictureBoard = '[data-testid=picture-board]';
const keyboard = '[data-testid=keyboard-shell]';
const modeButton = '[data-testid=kb-cycle-btn]';
const returnButton = '[data-testid=kb-minimize]';
const picturesReady = 'assert-eval new Promise(resolve=>{const end=Date.now()+30000;const check=()=>{const cards=[...document.querySelectorAll("[data-testid=picture-board] [data-testid=phrase-tile-card]")];if(cards.length>0&&cards.every(card=>{const img=card.querySelector("img");return img?.complete&&img.naturalWidth>0;}))return resolve(true);if(Date.now()>end)return resolve(false);setTimeout(check,100);};check();})';
const open = [`open ${base.href}`, 'wait-for [data-testid=message-text]'];
const boardChecks = [`assert-visible ${pictureBoard}`, `assert-hidden ${keyboard}`, picturesReady];
const typingChecks = [`assert-visible ${keyboard}`, `assert-hidden ${pictureBoard}`];

async function run(dir, viewport, commands, profile) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'commands.pipe'), commands.join('\n') + '\n');
  const args = ['browser', '--headless', '--fast', '--fail-fast', ...(profile ? ['--profile', profile] : ['--ephemeral-profile']),
    '--stealth', 'light', '--skip-fv-check', '--touch', '--viewport', viewport, '--har', path.join(dir, 'network.har'), 'pipe'];
  const child = spawn('prism', args, { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  const timer = setTimeout(stop, 120000);
  const collect = bytes => { output += bytes; if (output.length > 8 * 1024 * 1024) stop(); };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  child.stdin.end(commands.join('\n') + '\n');
  const code = await new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject); })
    .finally(() => clearTimeout(timer));
  writeFileSync(path.join(dir, 'browser.log'), output);
  if (code !== 0) throw new Error(`Picture startup flow failed: ${dir}`);
}

for (const viewport of viewports) {
  const dir = path.join(artifacts, viewport);
  const first = path.join(dir, 'first-visit');
  await run(first, viewport, [...open,
    'assert-eval localStorage.getItem("prism-cat-kb-open")===null&&localStorage.getItem("prism-kb-max")===null',
    ...boardChecks, `screenshot ${first}/picture-board.png`,
    `click ${modeButton}`, ...typingChecks,
    `click ${keyboard} button:text-is("q")`, 'assert-text [data-testid=message-text] q',
    `screenshot ${first}/typing.png`, `click ${returnButton}`, ...boardChecks,
    'assert-text [data-testid=message-text] q', `screenshot ${first}/returned-picture-board.png`, 'assert-no-page-errors']);

  const profile = 'aac-picture-startup-' + randomUUID().slice(0, 16);
  await run(path.join(dir, 'save-typing'), viewport, [...open, ...boardChecks,
    `click ${modeButton}`, ...typingChecks,
    'assert-eval localStorage.getItem("prism-cat-kb-open")==="true"&&localStorage.getItem("prism-kb-max")==="true"',
    'assert-no-page-errors'], profile);
  const saved = path.join(dir, 'saved-typing');
  await run(saved, viewport, [...open, ...typingChecks, `screenshot ${saved}/typing.png`,
    `click ${returnButton}`, ...boardChecks, `screenshot ${saved}/picture-board.png`, 'assert-no-page-errors'], profile);
  const restored = path.join(dir, 'saved-picture');
  await run(restored, viewport, [...open, ...boardChecks, `screenshot ${restored}/picture-board.png`, 'assert-no-page-errors'], profile);
  writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ viewport, baseUrl: base.href,
    firstVisitModePreferencesUnseeded: true, generatedHomeCardsLoaded: true,
    keyboardEntryAndReturnPreserveMessage: true, savedTypingAndPictureChoicesPreserved: true,
    separateBrowserProcesses: true }, null, 2) + '\n');
  console.log('PICTURE_BOARD_STARTUP_OK ' + viewport);
}
