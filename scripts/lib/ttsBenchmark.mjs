import { performance } from 'node:perf_hooks';

const DEFAULT_MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_ERROR_BYTES = 8 * 1024;

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

async function readCappedError(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let detail = '';
  let bytesRead = 0;

  while (bytesRead < MAX_ERROR_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;

    const remaining = MAX_ERROR_BYTES - bytesRead;
    const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
    bytesRead += chunk.byteLength;
    detail += decoder.decode(chunk, { stream: bytesRead < MAX_ERROR_BYTES });

    if (value.byteLength > remaining || bytesRead === MAX_ERROR_BYTES) {
      await reader.cancel('error response exceeded benchmark cap');
      break;
    }
  }

  detail += decoder.decode();
  return detail.trim().slice(0, 200);
}

export function flattenCorpus(corpus, filters = {}) {
  const localeFilter = new Set(filters.locales ?? []);
  const caseFilter = new Set(filters.cases ?? []);
  const rows = [];

  for (const locale of corpus.locales ?? []) {
    if (localeFilter.size > 0 && !localeFilter.has(locale.locale) && !localeFilter.has(locale.appCode)) {
      continue;
    }
    for (const benchmarkCase of locale.cases ?? []) {
      if (caseFilter.size > 0 && !caseFilter.has(benchmarkCase.id) && !caseFilter.has(benchmarkCase.kind)) {
        continue;
      }
      rows.push({
        appCode: locale.appCode,
        locale: locale.locale,
        language: locale.language,
        reviewStatus: locale.reviewStatus ?? 'unknown',
        caseId: benchmarkCase.id,
        kind: benchmarkCase.kind,
        text: benchmarkCase.text,
      });
    }
  }

  return rows;
}

export async function benchmarkSynthesis({
  endpoint,
  provider,
  benchmarkCase,
  run,
  headers = {},
  timeoutMs = 30_000,
  maxAudioBytes = DEFAULT_MAX_AUDIO_BYTES,
  textField = 'text',
  localeField = 'locale',
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({
        [textField]: benchmarkCase.text,
        [localeField]: benchmarkCase.locale,
      }),
      signal: controller.signal,
    });
    const headersAt = performance.now();

    if (!response.ok) {
      const detail = await readCappedError(response);
      return {
        provider,
        ...benchmarkCase,
        run,
        ok: false,
        status: response.status,
        error: detail || response.statusText || `HTTP ${response.status}`,
        responseHeadersMs: roundMs(headersAt - startedAt),
        ttfaMs: null,
        totalMs: roundMs(performance.now() - startedAt),
        audioBytes: 0,
        contentType: response.headers.get('content-type') ?? '',
      };
    }

    if (!response.body) throw new Error('response has no audio body');
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
    if (!contentType.startsWith('audio/') && contentType !== 'application/octet-stream') {
      await response.body.cancel('response was not raw audio');
      throw new Error(`response content-type is not raw audio: ${contentType || '(missing)'}`);
    }

    const reader = response.body.getReader();
    let firstAudioAt = null;
    let audioBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      if (firstAudioAt === null) firstAudioAt = performance.now();
      audioBytes += value.byteLength;
      if (audioBytes > maxAudioBytes) {
        await reader.cancel('audio response exceeded benchmark cap');
        throw new Error(`audio response exceeds ${maxAudioBytes} bytes`);
      }
    }

    if (firstAudioAt === null || audioBytes === 0) throw new Error('response contained no audio bytes');

    return {
      provider,
      ...benchmarkCase,
      run,
      ok: true,
      status: response.status,
      error: null,
      responseHeadersMs: roundMs(headersAt - startedAt),
      ttfaMs: roundMs(firstAudioAt - startedAt),
      totalMs: roundMs(performance.now() - startedAt),
      audioBytes,
      contentType: response.headers.get('content-type') ?? '',
    };
  } catch (error) {
    return {
      provider,
      ...benchmarkCase,
      run,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
      responseHeadersMs: null,
      ttfaMs: null,
      totalMs: roundMs(performance.now() - startedAt),
      audioBytes: 0,
      contentType: '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function summarizeBenchmark(results) {
  const successful = results.filter((result) => result.ok);
  const ttfa = successful.map((result) => result.ttfaMs);
  const total = successful.map((result) => result.totalMs);
  const byLocale = {};

  for (const locale of new Set(results.map((result) => result.locale))) {
    const localeResults = results.filter((result) => result.locale === locale);
    const localeSuccesses = localeResults.filter((result) => result.ok);
    byLocale[locale] = {
      attempts: localeResults.length,
      successes: localeSuccesses.length,
      errors: localeResults.length - localeSuccesses.length,
      ttfaP95Ms: percentile(localeSuccesses.map((result) => result.ttfaMs), 0.95),
      totalP95Ms: percentile(localeSuccesses.map((result) => result.totalMs), 0.95),
    };
  }

  return {
    attempts: results.length,
    successes: successful.length,
    errors: results.length - successful.length,
    errorRate: results.length === 0 ? null : (results.length - successful.length) / results.length,
    ttfaP50Ms: percentile(ttfa, 0.5),
    ttfaP95Ms: percentile(ttfa, 0.95),
    totalP50Ms: percentile(total, 0.5),
    totalP95Ms: percentile(total, 0.95),
    byLocale,
  };
}

export async function runBenchmark({
  endpoint,
  provider,
  cases,
  runs = 1,
  concurrency = 1,
  headers = {},
  timeoutMs = 30_000,
  maxAudioBytes = DEFAULT_MAX_AUDIO_BYTES,
  textField = 'text',
  localeField = 'locale',
}) {
  const jobs = [];
  for (const benchmarkCase of cases) {
    for (let run = 1; run <= runs; run += 1) jobs.push({ benchmarkCase, run });
  }

  const results = new Array(jobs.length);
  let nextJob = 0;
  const workerCount = Math.max(1, Math.min(concurrency, jobs.length || 1));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextJob < jobs.length) {
      const index = nextJob;
      nextJob += 1;
      results[index] = await benchmarkSynthesis({
        endpoint,
        provider,
        ...jobs[index],
        headers,
        timeoutMs,
        maxAudioBytes,
        textField,
        localeField,
      });
    }
  }));

  return { results, summary: summarizeBenchmark(results) };
}
