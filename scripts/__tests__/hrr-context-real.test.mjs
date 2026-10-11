import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as realHrr from '../../vendor/synalux-hrr/synalux_hrr.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCOPES = { previous: 'user:previous@example.test', next: 'user:next@example.test' };
const PHRASES = { previous: 'I want water', next: 'I want food' };

test('real WASM learns scoped next words after shared initialization and rejects stale auth initialization', async () => {
  const wasm = readFileSync(path.join(ROOT, 'vendor/synalux-hrr/synalux_hrr_bg.wasm'));
  const storage = new Map();
  let initializeCount = 0, complete;
  const waiting = new Promise(resolve => { complete = resolve; });
  const module = { __esModule: true, ...realHrr, default: async () => {
    initializeCount++;
    await waiting;
    // Supply actual packaged bytes; Node has no browser file-URL fetch loader.
    return realHrr.default({ module_or_path: wasm });
  } };
  const loaded = new Map();
  function loadProductionFile(filename) {
    assert.ok(filename.startsWith(ROOT + path.sep));
    if (filename.endsWith('.json')) return JSON.parse(readFileSync(filename, 'utf8'));
    if (loaded.has(filename)) return loaded.get(filename);
    const source = readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const exports = {};
    loaded.set(filename, exports);
    runInNewContext(compiled, {
      exports, require: name => {
        if (name === 'synalux-hrr') return module;
        const target = name.startsWith('@/') ? path.join(ROOT, name.slice(2)) : path.resolve(path.dirname(filename), name);
        return loadProductionFile(target.endsWith('.json') ? target : target + '.ts');
      },
      console, setTimeout, clearTimeout,
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      window: { addEventListener() {} }, document: { addEventListener() {}, visibilityState: 'visible' },
    });
    return exports;
  }
  const exports = loadProductionFile(path.join(ROOT, 'services/hrrContext.ts'));
  try {
    const stale = exports.initAacHrr(SCOPES.previous);
    const next = exports.initAacHrr(SCOPES.next);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(initializeCount, 1, 'Concurrent scopes must not instantiate separate WASM memories.');
    assert.equal(exports.isAacHrrReady(SCOPES.next), false, 'Do not construct the hologram before initialization completes.');
    exports.destroyAacHrr(SCOPES.previous);
    complete();
    assert.equal(await stale, false, 'Auth changes invalidate an initialization still in flight.');
    assert.equal(await next, true);
    assert.equal(await exports.initAacHrr(SCOPES.previous), true);
    exports.recordPhrase(PHRASES.previous, { language: 'en', scope: SCOPES.previous });
    exports.recordPhrase(PHRASES.next, { language: 'en', scope: SCOPES.next });
    const previousWords = exports.getNextWordSuggestions('I want', 5, 'en', SCOPES.previous).map(value => value.word);
    const nextWords = exports.getNextWordSuggestions('I want', 5, 'en', SCOPES.next).map(value => value.word);
    assert.ok(previousWords.includes('water'), JSON.stringify(previousWords));
    assert.ok(nextWords.includes('food'), JSON.stringify(nextWords));
    assert.equal(nextWords.includes('water'), false, 'A later user must never inherit the previous user\'s phrases.');
    assert.ok(nextWords.every(word => !/\s/.test(word)), 'Word predictions must never substitute a whole learned phrase.');
    exports.recordPhrase('IŞIK geliyor', { language: 'tr', scope: SCOPES.next });
    assert.equal(exports.getNextWordSuggestions('ışık', 5, 'tr', SCOPES.next)[0]?.word, 'geliyor');
    exports.recordPhrase('я идет домой', { language: 'ru', scope: SCOPES.next });
    assert.equal(exports.getNextWordSuggestions('я идёт', 5, 'ru', SCOPES.next)[0]?.word, 'домой');
    exports.recordPhrase('все хотят', { language: 'ru', scope: SCOPES.next });
    exports.recordPhrase('всё нужно', { language: 'ru', scope: SCOPES.next });
    assert.equal(exports.getNextWordSuggestions('все', 5, 'ru', SCOPES.next)[0]?.word, 'хотят');
    assert.equal(exports.getNextWordSuggestions('всё', 5, 'ru', SCOPES.next)[0]?.word, 'нужно');
    exports.recordPhrase('"je veux cafe\u0301', { language: 'fr', scope: SCOPES.next });
    assert.equal(exports.getNextWordSuggestions('"je veux', 5, 'fr', SCOPES.next)[0]?.word, 'café');
    exports.recordPhrase('मुझे पानी चाहिए', { language: 'hi', scope: SCOPES.next });
    assert.equal(exports.getNextWordSuggestions('मुझे पानी', 5, 'hi', SCOPES.next)[0]?.word, 'चाहिए');
    assert.equal(initializeCount, 1);
  } finally {
    complete();
    exports.destroyAacHrr();
  }
});
