#!/usr/bin/env node
// Exercise an installed local PWA with every subsequent network connection closed.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const upstream = new URL(process.env.BASE_URL || 'http://127.0.0.1:57766');
if (upstream.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(upstream.hostname) || upstream.username || upstream.password) {
  throw new Error('Use a fixture-backed loopback HTTP build.');
}
const artifacts = process.env.PICTURE_TEST_ARTIFACTS ? path.resolve(process.env.PICTURE_TEST_ARTIFACTS)
  : mkdtempSync(path.join(tmpdir(), 'aac-offline-pack-'));
if (/[\s"'\\]/.test(artifacts)) throw new Error('Use a whitespace-free artifact path.');
mkdirSync(artifacts, { recursive: true });
const pack = JSON.parse(readFileSync(new URL('../constants/generated/picturePack.json', import.meta.url), 'utf8'));
const moreHash = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url), 'utf8')).files['cw-more.png'].sha256;
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; media-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self'; object-src 'none'";
const settings = { state: { language: 'en', outputLanguage: 'en', theme: 'light', gridSize: 12,
  cloudPredictionEnabled: false, aiAutocorrectEnabled: false }, version: 22 };
const message = { state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 };
const NAVIGATION_AGE_DAYS = Number(process.env.PICTURE_TEST_NAVIGATION_AGE_DAYS || 0);
const LEGACY_QUOTA = process.env.PICTURE_TEST_LEGACY_QUOTA === '1';
const upgrade = process.env.PICTURE_TEST_UPGRADE_URL ? new URL(process.env.PICTURE_TEST_UPGRADE_URL) : null;
if (upgrade && (upgrade.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(upgrade.hostname))) throw new Error('Use a loopback upgrade build.');
let activeUpstream = upstream;
let upgrading = false;
if (!Number.isSafeInteger(NAVIGATION_AGE_DAYS) || NAVIGATION_AGE_DAYS < 0 || NAVIGATION_AGE_DAYS > 3650) throw new Error('Invalid test navigation age.');
let offline = false;
const requests = [];
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/__picture_test_upgrade' && upgrade) {
    activeUpstream = upgrade; upgrading = true; res.writeHead(200).end(); return;
  }
  if (req.method === 'GET' && req.url === '/__picture_test_setup') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP }).end('<!doctype html><title>Picture cache fixture</title><body>Local fixture</body>'); return;
  }
  if (req.method === 'POST' && req.url === '/__picture_test_offline') {
    offline = true; res.writeHead(200).end(); return;
  }
  if (offline) { requests.push({ path: req.url, outcome: 'connection closed' }); req.socket.destroy(); return; }
  if (upgrading && req.url.split('?')[0] === '/prism-aac') {
    requests.push({ path: req.url, outcome: 'replacement document connection closed' }); req.socket.destroy(); return;
  }
  const access = '/prism-aac/api/v1/prism-aac/pictures/access';
  if (!req.url?.startsWith('/') || (req.method !== 'GET' && !(req.method === 'POST' && req.url.split('?')[0] === access))) {
    res.writeHead(405).end(); return;
  }
  const forwarded = http.request({ hostname: activeUpstream.hostname, port: activeUpstream.port || 80, method: req.method,
    path: req.url, headers: { ...req.headers, host: activeUpstream.host, 'accept-encoding': 'identity' } }, reply => {
    requests.push({ path: req.url, status: reply.statusCode });
    if (LEGACY_QUOTA && reply.headers['content-type']?.includes('text/html')) {
      const parts = []; reply.on('data', part => parts.push(part)); reply.on('end', () => {
        const guard = '<script>const originalPicturePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==="packs"&&this.transaction.db.name==="prism-aac-bundled-pictures")throw new DOMException("fixture storage full","QuotaExceededError");return originalPicturePut.call(this,value,key);};</script>';
        const body = Buffer.from(Buffer.concat(parts).toString().replace('<head>', '<head>' + guard));
        const headers = { ...reply.headers, 'content-security-policy': CSP, 'content-length': String(body.length) }; delete headers['transfer-encoding'];
        res.writeHead(reply.statusCode || 502, headers).end(body);
      }); return;
    }
    res.writeHead(reply.statusCode || 502, { ...reply.headers, 'content-security-policy': CSP }); reply.pipe(res);
  });
  forwarded.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(forwarded);
});
await new Promise(resolve => server.listen(0, '::1', resolve));
const origin = `http://[::1]:${server.address().port}`;
const storage = { cookies: [], origins: [{ origin, localStorage: [
  { name: 'prism-aac-settings', value: JSON.stringify(settings) }, { name: 'prism-aac-message', value: JSON.stringify(message) },
  { name: 'prism-cat-kb-open', value: 'false' }, { name: 'prism-kb-max', value: 'false' },
] }] };
const storagePath = path.join(artifacts, 'storage-state.json');
writeFileSync(storagePath, JSON.stringify(storage));
const ready = 'assert-eval new Promise(resolve=>{const end=Date.now()+30000;const check=()=>{const img=document.querySelector(\'[data-testid="prediction-tile"][title="More"] img\');if(img?.complete&&img.naturalWidth>0&&img.currentSrc.startsWith("blob:"))resolve(true);else if(Date.now()>end)resolve(false);else setTimeout(check,100);};check();})';
const hashCheck = `assert-eval (async()=>{const img=document.querySelector('[data-testid="prediction-tile"][title="More"] img');const bytes=await(await fetch(img.currentSrc)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')===${JSON.stringify(moreHash)};})()`;
const commands = [
  `open ${origin}/prism-aac`, ready, hashCheck,
  `assert-eval new Promise(resolve=>{const req=indexedDB.open('prism-aac-bundled-pictures',1);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('packs','readonly');const value=tx.objectStore('packs').get('active');tx.oncomplete=()=>{resolve(value.result?.version===${JSON.stringify(pack.version)}&&value.result.bytes.byteLength===${pack.byteLength});db.close();};};req.onerror=()=>resolve(false);})`,
  'assert-eval new Promise(resolve=>{const end=Date.now()+30000;const check=()=>{if(navigator.serviceWorker.controller)resolve(true);else if(Date.now()>end)resolve(false);else setTimeout(check,100);};check();})',
  'assert-eval new Promise(resolve=>{const end=Date.now()+30000;const check=async()=>{const cache=await caches.open("prism-core-navigation-v2");if(await cache.match(location.href))resolve(true);else if(Date.now()>end)resolve(false);else setTimeout(check,100);};check();})',
  'click [data-testid="prediction-tile"][title="More"]', 'assert-text [data-testid="message-text"] More',
  'click button.aac-delete', ready,
  `screenshot ${path.join(artifacts, 'online.png')}`,
  'assert-eval (async()=>{const response=await fetch("/__picture_test_offline",{method:"POST"});return response.ok;})()',
  `open ${origin}/prism-aac`, ready, hashCheck,
  'click [data-testid="prediction-tile"][title="More"]', 'assert-text [data-testid="message-text"] More',
  `screenshot ${path.join(artifacts, 'offline.png')}`, 'assert-no-page-errors',
];
if (upgrade) {
  const position = commands.findIndex(command => command.includes('/__picture_test_offline'));
  commands.splice(position, 0,
    'assert-eval (async()=>{const response=await fetch("/__picture_test_upgrade",{method:"POST"});return response.ok;})()',
    'assert-eval new Promise(async resolve=>{const registration=await navigator.serviceWorker.getRegistration();const timer=setTimeout(()=>resolve(false),30000);const changed=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener("controllerchange",changed);resolve(true);};navigator.serviceWorker.addEventListener("controllerchange",changed);await registration.update();})',
    'assert-eval (async()=>{const cache=await caches.open("prism-core-navigation-v2");return !!(await cache.match(location.href));})()');
}
if (LEGACY_QUOTA) {
  commands.unshift(`open ${origin}/__picture_test_setup`, `assert-eval (async()=>{const grant=await(await fetch('/prism-aac/api/v1/prism-aac/pictures/access?version=${pack.version}',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();const bytes=new Uint8Array(${pack.byteLength});let offset=0;for(const chunk of ${JSON.stringify(pack.chunks)}){const response=await fetch('/prism-aac/api/v1/prism-aac/pictures/chunks/'+chunk.id+'?version=${pack.version}',{headers:{Authorization:'Bearer '+grant.token}});if(!response.ok)return false;const part=new Uint8Array(await response.arrayBuffer());bytes.set(part,offset);offset+=part.length;}const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==${JSON.stringify(pack.version)})return false;const length=new DataView(bytes.buffer).getUint32(8);const index=JSON.parse(new TextDecoder().decode(bytes.slice(12,12+length)));const cache=await caches.open('serwist-precache-legacy-picture-fixture');for(const [name,item] of Object.entries(index.files)){const image=bytes.slice(12+length+item.offset,12+length+item.offset+item.length);await cache.put(location.origin+'/prism-aac/symbols/'+name+'?__WB_REVISION__=old',new Response(image,{headers:{'Content-Type':'image/png'}}));}return(await cache.keys()).length===${pack.fileCount};})()`);
  const persistedPosition = commands.findIndex(command => command.includes("indexedDB.open('prism-aac-bundled-pictures'"));
  commands[persistedPosition] = `assert-eval new Promise(resolve=>{const req=indexedDB.open('prism-aac-bundled-pictures',1);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('packs','readonly');const get=tx.objectStore('packs').get('active');tx.oncomplete=()=>{resolve(!get.result);db.close();};};req.onerror=()=>resolve(false);})`;
  commands.push(`assert-eval (async()=>{const cache=await caches.open('serwist-precache-legacy-picture-fixture');return(await cache.keys()).length===${pack.fileCount};})()`);
}
if (NAVIGATION_AGE_DAYS) {
  const position = commands.findIndex(command => command.includes('/__picture_test_offline'));
  commands.splice(position, 0, `assert-eval (async()=>{for(const name of ['prism-core-navigation-v2','prism-core-navigation','prism-navigation']){const cache=await caches.open(name);const url=location.href;const response=await cache.match(url);if(!response)continue;const headers=new Headers(response.headers);headers.set('Date',new Date(Date.now()-${NAVIGATION_AGE_DAYS}*86400000).toUTCString());await cache.put(url,new Response(await response.arrayBuffer(),{status:response.status,headers}));return true;}return false;})()`);
}
writeFileSync(path.join(artifacts, 'commands.pipe'), commands.join('\n') + '\n');
let output = '';
try {
  const child = spawn('prism', ['browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile',
    '--stealth', 'light', '--skip-fv-check', '--viewport', '402x874', '--storage-state', storagePath,
    '--har', path.join(artifacts, 'network.har'), 'pipe'], { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const collect = value => { output += value; if (output.length > 8 * 1024 * 1024) process.kill(-child.pid, 'SIGKILL'); };
  child.stdout.on('data', collect); child.stderr.on('data', collect); child.stdin.end(commands.join('\n') + '\n');
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }, 150_000);
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }).finally(() => clearTimeout(timer));
  writeFileSync(path.join(artifacts, 'browser.log'), output);
  writeFileSync(path.join(artifacts, 'requests.json'), JSON.stringify(requests, null, 2) + '\n');
  if (code !== 0 || !offline || !requests.some(value => value.outcome === 'connection closed')) throw new Error(`Offline check failed; inspect ${artifacts}`);
  console.log(`Offline reload, original picture bytes and word insertion passed. Artifacts: ${artifacts}`);
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
