import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative } from 'node:path';

const DIR = 'public/models/mediapipe';
const HEAD_MODEL = 'blaze_face_full_range.tflite';
const manifest: { files: Array<{ file: string; sha256: string; bytes: number; source: string }> } =
  JSON.parse(readFileSync('scripts/mediapipe-model-manifest.json', 'utf8'));
const committed = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? committed(path) : [relative(DIR, path)];
});

describe('redistributed MediaPipe files', () => {
  it('record an exact source and digest for every committed file, and only those', () => {
    expect(manifest.files.map(f => f.file).sort()).toEqual(committed(DIR).sort());
    for (const record of manifest.files) {
      const bytes = readFileSync(join(DIR, record.file));
      expect({ file: record.file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length })
        .toEqual({ file: record.file, sha256: record.sha256, bytes: record.bytes });
      expect(record.source).toMatch(/^(https:\/\/storage\.googleapis\.com\/mediapipe-models\/|npm:@mediapipe\/tasks-vision@)/);
    }
  });

  it('cover every model the runtime loads, including head presence', () => {
    const runtime = readFileSync('services/mediapipeRuntime.ts', 'utf8');
    const loaded = [...runtime.matchAll(/\$\{MEDIAPIPE_BASE\}\/([\w.]+\.(?:task|tflite))/g)].map(match => match[1]);
    expect(loaded).toContain(HEAD_MODEL);
    for (const model of loaded) expect(manifest.files.map(f => f.file)).toContain(model);
  });
});

let server: Server | undefined;
afterEach(() => new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()));

/** Serve the committed files as the deployment does, optionally replacing the head-presence model. */
async function serve(headModel: 'committed' | 'altered' | 'missing') {
  server = createServer((request, response) => {
    const file = decodeURIComponent(new URL(request.url!, 'http://local').pathname).replace('/prism-aac/models/mediapipe/', '');
    if (file === HEAD_MODEL && headModel === 'missing') return response.writeHead(404).end();
    let body: Buffer;
    try { body = readFileSync(join(DIR, file)); } catch { return response.writeHead(404).end(); }
    if (file === HEAD_MODEL && headModel === 'altered') body = Buffer.concat([body.subarray(0, body.length - 1), Buffer.from([body[body.length - 1] ^ 1])]);
    response.writeHead(200, { 'content-type': file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable', etag: `"${file}"` }).end(body);
  });
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/prism-aac`;
}
const verify = (url: string) => new Promise<{ code: number; output: string }>(resolve =>
  execFile(process.execPath, ['scripts/mediapipe-cdn-test.mjs'], { env: { ...process.env, URL: url } },
    (error, stdout, stderr) => resolve({ code: error ? (error.code as number) ?? 1 : 0, output: stdout + stderr })));

describe('publication verification of the head-presence model', () => {
  it('passes when the served bytes match their recorded source', async () => {
    const result = await verify(await serve('committed'));
    expect(result.output).toContain('HeadPresence');
    expect(result.code).toBe(0);
  });
  it.each(['altered', 'missing'] as const)('fails when the served full-range model is %s', async mode => {
    const result = await verify(await serve(mode));
    expect(result.code).toBe(1);
    expect(result.output).toMatch(mode === 'altered' ? /HeadPresence: SHA-256 \w+ does not match/ : /HeadPresence: HTTP 404/);
  });
});
