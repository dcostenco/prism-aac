#!/usr/bin/env node
import { access, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';
import { flattenCorpus, runBenchmark } from './lib/ttsBenchmark.mjs';

function usage() {
  return `Usage:
  npm run benchmark:tts -- --provider <name> --endpoint <http-url> [options]

Options:
  --corpus <path>       Corpus JSON (default: benchmarks/tts/corpus.json)
  --locales <csv>       App codes or BCP-47 locales to include
  --cases <csv>         Case ids or kinds to include
  --runs <n>            Repetitions per case (default: 1)
  --concurrency <n>     Simultaneous requests (default: 1)
  --timeout-ms <n>      Per-request timeout (default: 30000)
  --text-field <name>   Provider JSON text field (default: text)
  --locale-field <name> Provider JSON locale field (default: locale)
  --bearer-env <name>   Read bearer token from this environment variable
  --output <path>       Result JSON (default: /tmp/prism-tts-benchmark-<time>.json)
  --overwrite           Allow replacing an existing output file
`;
}

function parseArgs(argv) {
  const options = {
    corpus: 'benchmarks/tts/corpus.json',
    runs: 1,
    concurrency: 1,
    timeoutMs: 30_000,
    textField: 'text',
    localeField: 'locale',
    overwrite: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--overwrite') {
      options.overwrite = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    i += 1;
    if (arg === '--provider') options.provider = value;
    else if (arg === '--endpoint') options.endpoint = value;
    else if (arg === '--corpus') options.corpus = value;
    else if (arg === '--locales') options.locales = value.split(',').filter(Boolean);
    else if (arg === '--cases') options.cases = value.split(',').filter(Boolean);
    else if (arg === '--runs') options.runs = Number(value);
    else if (arg === '--concurrency') options.concurrency = Number(value);
    else if (arg === '--timeout-ms') options.timeoutMs = Number(value);
    else if (arg === '--text-field') options.textField = value;
    else if (arg === '--locale-field') options.localeField = value;
    else if (arg === '--bearer-env') options.bearerEnv = value;
    else if (arg === '--output') options.output = value;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(usage());
  process.exit(0);
}
if (!options.provider) throw new Error('--provider is required');
if (!options.endpoint) throw new Error('--endpoint is required');
const endpoint = new URL(options.endpoint);
if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('--endpoint must use http or https');
positiveInteger(options.runs, '--runs');
positiveInteger(options.concurrency, '--concurrency');
positiveInteger(options.timeoutMs, '--timeout-ms');

const corpusPath = resolve(options.corpus);
const corpus = JSON.parse(await readFile(corpusPath, 'utf8'));
const cases = flattenCorpus(corpus, { locales: options.locales, cases: options.cases });
if (cases.length === 0) throw new Error('No corpus cases matched the selected filters');

const headers = {};
if (options.bearerEnv) {
  const token = process.env[options.bearerEnv];
  if (!token) throw new Error(`Environment variable ${options.bearerEnv} is empty`);
  headers.authorization = `Bearer ${token}`;
}

const startedAt = new Date().toISOString();
const benchmark = await runBenchmark({
  endpoint: endpoint.toString(),
  provider: options.provider,
  cases,
  runs: options.runs,
  concurrency: options.concurrency,
  headers,
  timeoutMs: options.timeoutMs,
  textField: options.textField,
  localeField: options.localeField,
});
const finishedAt = new Date().toISOString();

const outputPath = resolve(options.output ?? `/tmp/prism-tts-benchmark-${Date.now()}.json`);
if (!options.overwrite) {
  try {
    await access(outputPath, fsConstants.F_OK);
    throw new Error(`Output already exists: ${outputPath}; pass --overwrite to replace it`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const artifact = {
  schemaVersion: 1,
  provider: options.provider,
  endpoint: `${endpoint.origin}${endpoint.pathname}`,
  startedAt,
  finishedAt,
  corpus: corpusPath,
  configuration: {
    runs: options.runs,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
    textField: options.textField,
    localeField: options.localeField,
    selectedLocales: options.locales ?? null,
    selectedCases: options.cases ?? null,
  },
  ...benchmark,
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, {
  encoding: 'utf8',
  flag: options.overwrite ? 'w' : 'wx',
});
console.log(JSON.stringify({ output: outputPath, summary: artifact.summary }, null, 2));
if (artifact.summary.errors > 0) process.exitCode = 1;
