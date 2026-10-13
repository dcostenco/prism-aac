#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const origin = process.env.BASE_URL;
if (!origin || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('Use an owned loopback build');
const artifacts = path.resolve(process.env.PICTURE_TEST_ARTIFACTS || 'retired-picture-cache-evidence');
mkdirSync(artifacts, { recursive: true });
const cacheName = 'aac-source-retirement-fixture';
const oldUrl = 'https://static.arasaac.org/pictograms/1/1_500.png';
const preservedUrl = `${origin}/prism-aac/__current-picture-preservation-fixture`;
const sentinel = 'current generated picture preservation fixture';
const moreHash = JSON.parse(readFileSync(new URL('../constants/generated/phraseSymbolFiles.json', import.meta.url))).files['cw-more.png'].sha256;
const settings = { state: { language: 'en', outputLanguage: 'en', cloudPredictionEnabled: false, aiAutocorrectEnabled: false }, version: 22 };
const commands = [
  `open ${origin}/prism-aac/docs`,
  `assert-eval (async()=>{const seed=(name,value)=>new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('blobs');request.onsuccess=()=>{const db=request.result,tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').put(new Blob([value]),'retirement-test-fixture');tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});await seed('prism-aac-pictograms','retired picture fixture');await seed('prism-aac-generated-pictures',${JSON.stringify(sentinel)});const cache=await caches.open(${JSON.stringify(cacheName)});await cache.put(${JSON.stringify(oldUrl)},new Response('retired fixture'));await cache.put(${JSON.stringify(preservedUrl)},new Response('preserved current fixture'));localStorage.setItem('prism-arasaac-misses','["en:fixture"]');localStorage.setItem('prism-legacy-pictograms-cleared','1');localStorage.setItem('prism-aac-settings',${JSON.stringify(JSON.stringify(settings))});localStorage.setItem('prism-cat-kb-open','true');localStorage.setItem('prism-kb-max','true');sessionStorage.setItem('prism-greeting-dismissed','1');return(await indexedDB.databases()).some(d=>d.name==='prism-aac-pictograms')&&!!await cache.match(${JSON.stringify(oldUrl)});})()`,
  `open ${origin}/prism-aac`,
  'assert-eval new Promise(resolve=>{const end=Date.now()+20000;const check=()=>{if(localStorage.getItem("prism-legacy-pictograms-cleared")==="2")return resolve(true);if(Date.now()>end)return resolve(false);setTimeout(check,100);};check();})',
  `assert-eval (async()=>{const names=(await indexedDB.databases()).map(d=>d.name);if(names.includes('prism-aac-pictograms')||!names.includes('prism-aac-generated-pictures')||localStorage.getItem('prism-arasaac-misses')!==null)return false;const cache=await caches.open(${JSON.stringify(cacheName)});if(await cache.match(${JSON.stringify(oldUrl)})||!await cache.match(${JSON.stringify(preservedUrl)}))return false;const blob=await new Promise((resolve,reject)=>{const request=indexedDB.open('prism-aac-generated-pictures',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('blobs','readonly'),read=tx.objectStore('blobs').get('retirement-test-fixture');read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);tx.oncomplete=()=>db.close();};request.onerror=()=>reject(request.error);});return await blob.text()===${JSON.stringify(sentinel)};})()`,
  `assert-eval new Promise(resolve=>{const end=Date.now()+30000;const check=async()=>{const img=document.querySelector('[data-testid="prediction-tile"][title="More"] img');if(img?.complete&&img.naturalWidth>0){const bytes=await(await fetch(img.currentSrc)).arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash===${JSON.stringify(moreHash)})return resolve(true);}if(Date.now()>end)return resolve(false);setTimeout(check,100);};check();})`,
  'assert-eval !performance.getEntriesByType("resource").some(entry=>/arasaac\.org/.test(entry.name))',
  `screenshot ${path.join(artifacts, 'after-cleanup.png')}`,
  'assert-no-page-errors',
];
writeFileSync(path.join(artifacts, 'commands.pipe'), commands.join('\n') + '\n');
const output = [];
const child = spawn('prism', ['browser', '--headless', '--fast', '--fail-fast', '--ephemeral-profile', '--stealth', 'light',
  '--skip-fv-check', '--device', 'iphone-17', '--device-scale-factor', '1', '--viewport', '390x844',
  '--har', path.join(artifacts, 'network.har'), 'pipe'], { stdio: ['pipe', 'pipe', 'pipe'] });
child.stdout.on('data', data => output.push(data)); child.stderr.on('data', data => output.push(data));
child.stdin.end(commands.join('\n') + '\n');
const timer = setTimeout(() => child.kill('SIGTERM'), 90000);
const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }).finally(() => clearTimeout(timer));
writeFileSync(path.join(artifacts, 'browser.log'), Buffer.concat(output));
writeFileSync(path.join(artifacts, 'status.json'), JSON.stringify({ exit_code: code }));
if (code !== 0) throw new Error('Retired picture-cache migration failed');
const har = JSON.parse(readFileSync(path.join(artifacts, 'network.har')));
if (har.log.entries.some(entry => /arasaac\.org/.test(entry.request.url))) throw new Error('An ARASAAC request reached the network');
console.log('Retired caches removed, current generated/private pictures preserved, no ARASAAC network calls');
