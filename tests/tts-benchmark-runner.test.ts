// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { runBenchmark, summarizeBenchmark } from '../scripts/lib/ttsBenchmark.mjs';

const servers: Server[] = [];

async function listen(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock server has no TCP address');
  return `http://127.0.0.1:${address.port}/synthesize`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, 'close');
  }));
});

describe('TTS benchmark runner', () => {
  it('measures streamed first-audio and total latency without retaining audio', async () => {
    const requests: Array<{ text: string; locale: string }> = [];
    const endpoint = await listen((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        requests.push(JSON.parse(body));
        response.writeHead(200, { 'content-type': 'audio/wav' });
        response.write(Buffer.alloc(64, 1));
        setTimeout(() => response.end(Buffer.alloc(32, 2)), 5);
      });
    });

    const benchmark = await runBenchmark({
      endpoint,
      provider: 'mock-natural',
      cases: [{
        appCode: 'es',
        locale: 'es-ES',
        language: 'Spanish',
        caseId: 'aac-help',
        kind: 'aac_sentence',
        text: 'Necesito ayuda',
      }],
      runs: 2,
      concurrency: 2,
    });

    expect(requests).toEqual([
      { text: 'Necesito ayuda', locale: 'es-ES' },
      { text: 'Necesito ayuda', locale: 'es-ES' },
    ]);
    expect(benchmark.summary).toMatchObject({ attempts: 2, successes: 2, errors: 0, errorRate: 0 });
    expect(benchmark.results.every((result) => result.audioBytes === 96)).toBe(true);
    expect(benchmark.results.every((result) => result.ttfaMs !== null && result.ttfaMs <= result.totalMs)).toBe(true);
    expect(JSON.stringify(benchmark)).not.toContain(Buffer.alloc(64, 1).toString('base64'));
  });

  it('records provider failures in the summary', async () => {
    const endpoint = await listen((_request, response) => {
      response.writeHead(503, { 'content-type': 'text/plain' });
      response.end('candidate unavailable');
    });

    const benchmark = await runBenchmark({
      endpoint,
      provider: 'mock-failure',
      cases: [{
        appCode: 'en',
        locale: 'en-US',
        language: 'English',
        caseId: 'aac-word',
        kind: 'aac_word',
        text: 'Yes',
      }],
    });

    expect(benchmark.summary).toMatchObject({ attempts: 1, successes: 0, errors: 1, errorRate: 1 });
    expect(benchmark.results[0]).toMatchObject({
      ok: false,
      status: 503,
      error: 'candidate unavailable',
      audioBytes: 0,
    });
  });

  it('rejects a successful JSON response instead of counting it as synthesized audio', async () => {
    const endpoint = await listen((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'model unavailable' }));
    });

    const benchmark = await runBenchmark({
      endpoint,
      provider: 'mock-json-error',
      cases: [{
        appCode: 'en',
        locale: 'en-US',
        language: 'English',
        caseId: 'aac-word',
        kind: 'aac_word',
        text: 'Yes',
      }],
    });

    expect(benchmark.summary).toMatchObject({ attempts: 1, successes: 0, errors: 1 });
    expect(benchmark.results[0]).toMatchObject({
      ok: false,
      error: 'response content-type is not raw audio: application/json',
      audioBytes: 0,
    });
  });

  it('caps large provider error bodies in the result artifact', async () => {
    const endpoint = await listen((_request, response) => {
      response.writeHead(503, { 'content-type': 'text/plain' });
      response.end('x'.repeat(64 * 1024));
    });

    const benchmark = await runBenchmark({
      endpoint,
      provider: 'mock-large-error',
      cases: [{
        appCode: 'en',
        locale: 'en-US',
        language: 'English',
        caseId: 'aac-word',
        kind: 'aac_word',
        text: 'Yes',
      }],
    });

    expect(benchmark.results[0].error).toHaveLength(200);
  });

  it('returns null percentiles for an empty result set', () => {
    expect(summarizeBenchmark([])).toMatchObject({
      attempts: 0,
      errorRate: null,
      ttfaP95Ms: null,
      totalP95Ms: null,
    });
  });
});
