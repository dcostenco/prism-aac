import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const artifacts = process.env.PICTURE_TEST_ARTIFACTS || mkdtempSync(path.join(tmpdir(), 'aac-native-offline-'));
mkdirSync(artifacts, { recursive: true });
const upstream = new URL(process.env.BASE_URL || 'http://127.0.0.1:57770');
if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(upstream.hostname)) throw new Error('Use a loopback fixture-backed build.');
const pack = JSON.parse(readFileSync(root + '/constants/generated/picturePack.json'));
const hash = JSON.parse(readFileSync(root + '/constants/generated/phraseSymbolFiles.json')).files['cw-more.png'].sha256;
const pictureFiles = JSON.parse(readFileSync(root + '/constants/generated/phraseSymbolFiles.json')).files;
const BASIC_WORD_FILES = { girl: 'pp-girl.png', girls: 'pp-girl.png', boys: 'pp-boy.png',
  bottles: 'w-bottle.png', bother: 'w-bother.png', was: 'w-past-being.png',
  quarter: 'w-quarter.png', quality: 'w-quality.png' };
const basicHashes = Object.fromEntries(Object.entries(BASIC_WORD_FILES).map(([word, file]) => [word, pictureFiles[file].sha256]));
const settings = {state:{language:'en',outputLanguage:'en',theme:'light',gridSize:12,cloudPredictionEnabled:false,aiAutocorrectEnabled:false},version:22};
const message = {state:{text:'',autoSpeak:false,soundEnabled:false},version:3};
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; media-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self'; object-src 'none'";
let offline = false;
let state = {};
let activeRun = randomUUID();
let expectedWidth = null;
const requests = [];
const observer = `<script>
const fixtureRun=__NATIVE_RUN__;
if(localStorage.getItem("prism-native-offline-run")!==fixtureRun){
localStorage.setItem('prism-native-offline-fixture','1');
localStorage.setItem('prism-aac-settings',${JSON.stringify(JSON.stringify(settings))});
localStorage.setItem('prism-aac-message',${JSON.stringify(JSON.stringify(message))});
localStorage.setItem('prism-cat-kb-open','false');localStorage.setItem('prism-kb-max','false');}
localStorage.setItem("prism-native-offline-run",fixtureRun);
function targetsVisible(){
const nodes=[document.querySelector('[data-testid="message-text"]'),...document.querySelectorAll('[data-testid="prediction-tile"]')];
return nodes.length>1&&nodes.every(node=>{if(!node)return false;const r=node.getBoundingClientRect();if(r.width<=0||r.height<=0||r.x<0||r.y<0||r.right>innerWidth||r.bottom>innerHeight)return false;return[[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]].every(([x,y])=>node.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)));});}
let sentHash=false,checking=false,clicks=[];
document.addEventListener('click',e=>{const node=e.target.closest?.('button');if(node)clicks.push({label:node.getAttribute('aria-label'),title:node.title,text:node.textContent});},true);
setInterval(async()=>{if(checking)return;checking=true;try{
const signIn=document.querySelector('[data-testid="synalux-signin"]');if(signIn)signIn.href='http://127.0.0.1:6949/external';
const img=document.querySelector('[data-testid="prediction-tile"][title="More"] img');
if(!sentHash&&img?.complete&&img.naturalWidth>0){
const bytes=await(await fetch(img.currentSrc)).arrayBuffer();
sentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')===${JSON.stringify(hash)};}
let durable=false;
await new Promise(async resolve=>{try{const name='prism-aac-bundled-pictures';if(typeof indexedDB.databases==='function'&&!(await indexedDB.databases()).some(db=>db.name===name)){resolve();return;}const req=indexedDB.open(name);req.onupgradeneeded=()=>req.transaction.abort();req.onerror=()=>resolve();req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('packs')){db.close();resolve();return;}const tx=db.transaction('packs','readonly');const get=tx.objectStore('packs').get(${JSON.stringify('version:' + pack.version)});tx.oncomplete=()=>{durable=get.result?.version===${JSON.stringify(pack.version)};db.close();resolve();};tx.onerror=()=>{db.close();resolve();};};}catch(e){resolve();}});
const wordPictures={};for(const[word,expected]of Object.entries(${JSON.stringify(basicHashes)})){const node=document.querySelector('[data-testid="prediction-tile"][title="'+word+'"] img');if(!node?.complete||!node.naturalWidth)continue;const source=node.currentSrc;const bytes=await(await fetch(source)).arrayBuffer();const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(node.isConnected&&node.currentSrc===source)wordPictures[word]=actual===expected;}
let documentSaved=false;if('serviceWorker' in navigator){try{const cache=await caches.open('prism-core-navigation-v2');documentSaved=!!(await cache.match(location.origin+'/prism-aac'));}catch(e){}}
await fetch('/__native/report',{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({runId:fixtureRun,viewportWidth:innerWidth,pictureHashMatches:sentHash,wordPictures,durablePack:durable,documentSaved,targetsVisible:targetsVisible(),serviceWorkerAvailable:'serviceWorker' in navigator,controller:!!navigator.serviceWorker?.controller,message:document.querySelector('[data-testid="message-text"]')?.textContent||'',savedMessage:localStorage.getItem('prism-aac-message'),clicks,bridge:!!window.prismNativeBridge})});
}catch(e){}finally{checking=false;}},500);
</script>`;
const server=http.createServer((req,res)=>{
  const url = new URL(req.url, 'http://localhost:6948');
  if(url.pathname==='/__native/online'&&req.method==='POST'){
    const width = Number(url.searchParams.get('viewportWidth'));
    if(!Number.isInteger(width)||width<320||width>1400){res.writeHead(400).end('A valid device viewport width is required');return;}
    // The first page already carries this fresh server's UUID. Register its
    // measured viewport without interrupting that installation. Later runs
    // receive a new UUID so earlier documents cannot satisfy their checks.
    if(expectedWidth!==null)activeRun=randomUUID();
    expectedWidth=width;offline=false;state={};requests.length=0;
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({runId:activeRun,viewportWidth:width}));return;
  }
  if(req.url==='/__native/offline'&&req.method==='POST'){offline=true;state={};res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{}');return;}
  if(req.url==='/__native/state'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({...state,phase:offline?'offline':'online'}));return;}
  if(req.url==='/__native/report'&&req.method==='POST'){
    const parts=[];req.on('data',p=>parts.push(p));req.on('end',()=>{const reported=JSON.parse(Buffer.concat(parts));if(reported.runId!==activeRun||reported.viewportWidth!==expectedWidth){writeFileSync(path.join(artifacts,'ignored-report.json'),JSON.stringify({expectedRun:activeRun,expectedWidth,reported},null,2));res.writeHead(200).end();return;}state=reported;writeFileSync(path.join(artifacts,'state.json'),JSON.stringify({...state,phase:offline?'offline':'online'},null,2));res.writeHead(200).end();});return;
  }
  if(offline){requests.push({path:req.url,outcome:'connection closed'});writeFileSync(path.join(artifacts,'requests.json'),JSON.stringify(requests,null,2));req.socket.destroy();return;}
  const forwarded=http.request({hostname:upstream.hostname,port:upstream.port,path:req.url,method:req.method,headers:{...req.headers,'accept-encoding':'identity'}},reply=>{
    requests.push({path:req.url,status:reply.statusCode});
    writeFileSync(path.join(artifacts,'requests.json'),JSON.stringify(requests,null,2));
    const parts=[];reply.on('data',p=>parts.push(p));reply.on('end',()=>{
      let data=Buffer.concat(parts);if(reply.headers['content-type']?.includes('text/html'))data=Buffer.from(data.toString().replace('<head>','<head>'+observer.replace('__NATIVE_RUN__',JSON.stringify(activeRun))));
      const headers={...reply.headers,'content-security-policy':CSP,'content-length':String(data.length)};delete headers['transfer-encoding'];
      res.writeHead(reply.statusCode||502,headers).end(data);
    });
  });forwarded.on('error',()=>{res.writeHead(502).end();});req.pipe(forwarded);
});
server.listen(6948,'::1',()=>console.log('native fixture http://localhost:6948, app-resource requests can be closed'));

http.createServer((req,res)=>res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end('<!doctype html><title>External website fixture</title><h1>External website fixture</h1>')).listen(6949,'127.0.0.1');
