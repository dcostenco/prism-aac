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
// Every corner of the rendered image must survive its rounded clipping well.
// A 32px image in a 32px well with 16px radii otherwise loses parts of the art.
const completeArtwork = `(()=>{const inside=(x,y,r,s)=>{const corners=[['borderTopLeftRadius',r.left,r.top,1,1],['borderTopRightRadius',r.right,r.top,-1,1],['borderBottomLeftRadius',r.left,r.bottom,1,-1],['borderBottomRightRadius',r.right,r.bottom,-1,-1]];return corners.every(([key,cx,cy,dx,dy])=>{const values=s[key].split(' ').map(parseFloat),rx=values[0],ry=values[1]??rx;if(!rx||!ry)return true;const nx=(x-cx)*dx,ny=(y-cy)*dy;return nx>=rx||ny>=ry||Math.pow((nx-rx)/rx,2)+Math.pow((ny-ry)/ry,2)<=1.001;});};const images=[...document.querySelectorAll('[data-testid="prediction-tile"] img')];return images.length>0&&images.every(img=>{const b=img.getBoundingClientRect();if(!img.naturalWidth||getComputedStyle(img).objectFit!=='contain')return false;const scale=Math.min(b.width/img.naturalWidth,b.height/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;const r={left:b.left+(b.width-w)/2,top:b.top+(b.height-h)/2,right:b.left+(b.width+w)/2,bottom:b.top+(b.height+h)/2};for(let p=img.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(!['hidden','clip'].includes(s.overflowX)&&!['hidden','clip'].includes(s.overflowY))continue;const b=p.getBoundingClientRect();if(![[r.left,r.top],[r.right,r.top],[r.left,r.bottom],[r.right,r.bottom]].every(([x,y])=>inside(x,y,b,s)))return false;}return true;});})()`;
const visiblePictures = `new Promise(resolve=>{const end=Date.now()+30000;const check=()=>{const words=${JSON.stringify(CORE_WORDS)};if(words.every(word=>{const tile=document.querySelector('[data-testid="prediction-tile"][title="'+word+'"]');const img=tile?.querySelector('img');if(!img?.complete||!img.naturalWidth)return false;const r=img.getBoundingClientRect(),s=getComputedStyle(img);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>=${MIN_PICTURE_SIZE}&&r.height>=${MIN_PICTURE_SIZE}&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}))return resolve(true);if(Date.now()>end)return resolve(false);setTimeout(check,100);};check();})`;
const reachableControls = `(()=>{const nodes=[...document.querySelectorAll('[data-testid="prediction-tile"]'),...document.querySelectorAll('[data-testid="keyboard-shell"] button'),document.querySelector('button.aac-delete')];return nodes.length>30&&nodes.every(node=>{if(!node)return false;const r=node.getBoundingClientRect();if(r.width<=0||r.height<=0||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return false;return[[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]].every(([x,y])=>node.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)));});})()`;

for (const viewport of VIEWPORTS) {
  const dir = path.join(out, `${viewport.width}x${viewport.height}`); mkdirSync(dir, { recursive: true });
  const commands = [`open ${base.href}`, 'wait-for [data-testid=kb-cycle-btn]', 'click [data-testid=kb-cycle-btn]',
    'assert-visible [data-testid=keyboard-shell]', `assert-eval ${visiblePictures}`, `assert-eval ${completeArtwork}`, `assert-eval ${reachableControls}`,
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
