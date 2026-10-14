import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXPECTED_DOMAINS = ['synalux.ai', 'www.synalux.ai', 'prism-aac.vercel.app', 'localhost'];
const BUNDLE_OUTPUTS = ['AACPictures.aacpack', 'aacPictureManifest.json', 'aacPictureSymbols.json', 'AACPictureAttribution.txt'];
const EXCLUDED_DIRS = new Set(['_llama_cpp_local', '_llama_cpp_watchos', 'build_watch', 'xcuserdata']);

function plistJson(filename) {
  const result = spawnSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', filename], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('project regeneration preserves offline picture packaging and its acceptance tests', async () => {
  assert.equal(process.platform, 'darwin', 'Run this native generation gate on macOS with XcodeGen.');
  const root = await mkdtemp(path.join(tmpdir(), 'aac-project-generation-'));
  try {
    const native = path.join(root, 'ios-native');
    await cp(path.join(ROOT, 'ios-native'), native, {
      recursive: true,
      filter: filename => !EXCLUDED_DIRS.has(path.basename(filename)) && !filename.endsWith('.gguf'),
    });
    // Generation does not resolve or build local package dependencies.
    await mkdir(path.join(native, '_llama_cpp_local'));
    const generated = spawnSync('xcodegen', ['generate', '--no-env', '--spec', path.join(native, 'project.yml')], {
      cwd: native, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, USER: process.env.USER, LOGNAME: process.env.LOGNAME },
    });
    assert.equal(generated.status, 0, generated.stdout + generated.stderr);
    const projectPath = path.join(native, 'PrismAAC.xcodeproj');
    const { objects } = plistJson(path.join(projectPath, 'project.pbxproj'));
    const watch = Object.values(objects).find(object => object.isa === 'PBXNativeTarget' && object.name === 'PrismAACWatch');
    assert.ok(watch, 'The independently running Watch app must remain a target.');
    const phase = watch.buildPhases.map(id => objects[id]).find(object => object.name === 'Install generated pictures');
    assert.ok(phase, 'The generated Watch bundle must install its pictures before signing.');
    assert.equal(phase.alwaysOutOfDate, '1', 'Every build must revalidate immutable input hashes.');
    assert.match(phase.shellScript, /install-native-picture-pack\.sh/);
    for (const output of BUNDLE_OUTPUTS) assert.ok(phase.outputPaths.some(value => value.endsWith('/' + output)), output);
    for (let index = 0; index < 5; index++) assert.ok(phase.inputPaths.some(value => value.endsWith(`/pictures-${String(index).padStart(4, '0')}.aacpack`)));
    assert.ok(phase.inputPaths.some(value => value.endsWith('/install-native-picture-pack.sh')));
    assert.ok(Object.values(objects).some(object => object.isa === 'PBXNativeTarget' && object.name === 'PrismAACWatchUITests'));
    const scheme = await readFile(path.join(projectPath, 'xcshareddata/xcschemes/PrismAACWatch.xcscheme'), 'utf8');
    assert.match(scheme, /<TestAction[\s\S]*BlueprintName = "PrismAACWatchUITests"/);
    assert.deepEqual(plistJson(path.join(native, 'PrismAAC/Info.plist')).WKAppBoundDomains, EXPECTED_DOMAINS,
      'The generated iOS wrapper must retain trusted origins for its offline service worker.');
    const watchResources = watch.buildPhases.map(id => objects[id]).find(object => object.isa === 'PBXResourcesBuildPhase');
    const resourceNames = watchResources.files.map(id => objects[objects[id].fileRef].path);
    assert.ok(resourceNames.includes('aacTranslations.json'), 'Watch translations must ship with the regenerated app.');
    assert.ok(resourceNames.includes('Assets.xcassets'), 'Watch app icons must survive regeneration.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
