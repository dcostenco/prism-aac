import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:57815/prism-aac');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Use a fixture-backed loopback build.');
const out = process.env.PICTURE_TEST_ARTIFACTS || mkdtempSync(path.join(tmpdir(), 'aac-compact-pictures-'));
const VIEWPORTS = [{ width: 1280, height: 480, touch: false, dpr: 1 },
  { width: 844, height: 390, touch: true, dpr: 1 }, { width: 686, height: 473, touch: false, dpr: 2.5 }];
const CORE_WORDS = ['I', 'You', 'More', 'Want', 'Help'];
const MIN_PICTURE_SIZE = 24;
const visiblePictures = `new Promise(resolve=>{const end=Date.now()+30000;const check=()=>{const words=${JSON.stringify(CORE_WORDS)};if(words.every(word=>{const tile=document.querySelector('[data-testid="prediction-tile"][title="'+word+'"]');const img=tile?.querySelector('img');if(!img?.complete||!img.naturalWidth)return false;const r=img.getBoundingClientRect(),s=getComputedStyle(img);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>=${MIN_PICTURE_SIZE}&&r.height>=${MIN_PICTURE_SIZE}&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}))return resolve(true);if(Date.now()>end)return resolve(false);setTimeout(check,100);};check();})`;
const reachableControls = `(()=>{const nodes=[...document.querySelectorAll('[data-testid="prediction-tile"]'),...document.querySelectorAll('[data-testid="keyboard-shell"] button'),document.querySelector('button.aac-delete')];return nodes.length>30&&nodes.every(node=>{if(!node)return false;const r=node.getBoundingClientRect();if(r.width<=0||r.height<=0||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return false;return[[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]].every(([x,y])=>node.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)));});})()`;

for (const viewport of VIEWPORTS) {
  const dir = path.join(out, `${viewport.width}x${viewport.height}`); mkdirSync(dir, { recursive: true });
  const commands = [`open ${base.href}`, 'wait-for [data-testid=kb-cycle-btn]', 'click [data-testid=kb-cycle-btn]',
    'assert-visible [data-testid=keyboard-shell]', `assert-eval ${visiblePictures}`, `assert-eval ${reachableControls}`,
    `screenshot ${dir}/visible-pictures.png`, 'click [data-testid="prediction-tile"][title="More"]',
    'assert-text [data-testid=message-text] More', 'assert-eval document.querySelector("[data-testid=keyboard-shell]")!==null',
    `screenshot ${dir}/selected-picture.png`, 'assert-no-page-errors'];
  writeFileSync(path.join(dir, 'commands.pipe'), commands.join('\n') + '\n');
  const args = ['browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile', '--stealth', 'light', '--skip-fv-check',
    ...(viewport.touch ? ['--touch'] : []), '--viewport', `${viewport.width}x${viewport.height}`,
    '--device-scale-factor', String(viewport.dpr), '--har', path.join(dir, 'network.har'), 'pipe'];
  const child = spawn('prism', args, { detached: true, stdio: ['pipe', 'pipe', 'pipe'] }); let output = '';
  const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  const timer = setTimeout(stop, 120000); const collect = bytes => { output += bytes; if (output.length > 8 * 1024 * 1024) stop(); };
  child.stdout.on('data', collect); child.stderr.on('data', collect); child.stdin.end(commands.join('\n') + '\n');
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }).finally(() => clearTimeout(timer));
  writeFileSync(path.join(dir, 'browser.log'), output); if (code !== 0) throw new Error(`Compact visible-picture flow failed: ${dir}`);
  // Chromium rounds fractional device pixels up when rasterising the viewport.
  for (const name of ['visible-pictures.png', 'selected-picture.png']) {
    const bytes = readFileSync(path.join(dir, name));
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (bytes.length < 10_000 || width !== Math.ceil(viewport.width * viewport.dpr)
      || height !== Math.ceil(viewport.height * viewport.dpr)) throw new Error(`Wrong capture geometry: ${dir}/${name}`);
    console.log(`CAPTURE_OK ${name} ${width}x${height} viewport=${viewport.width}x${viewport.height} dpr=${viewport.dpr}`);
  }
  writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ viewport, baseUrl: base.href, imagesVisiblySized: true,
    pictureAndKeyboardTargetsReachable: true, pictureSelectionInsertsWord: true }, null, 2) + '\n');
  console.log(`COMPACT_PICTURES_VISIBLE ${viewport.width}x${viewport.height}`);
}
