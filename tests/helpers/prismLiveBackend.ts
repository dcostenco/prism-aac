import { execFileSync } from 'node:child_process';

export interface LiveOllamaConfig {
  enabled: boolean;
  reason: string;
  url: string;
  model: string;
  models: string[];
}

interface Options {
  enabled?: boolean;
  env?: NodeJS.ProcessEnv;
  readStatus?: () => string;
}

const DISABLED: LiveOllamaConfig = {
  enabled: false, reason: '', url: '', model: '', models: [],
};
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;

/** Live tests share Prism's explicit backend and role assignments. */
export function configuredOllamaTests(options: Options = {}): LiveOllamaConfig {
  const env = options.env ?? process.env;
  if (!(options.enabled ?? env.PRISM_LIVE_LOCAL_TESTS === '1')) {
    return { ...DISABLED, reason: 'Set PRISM_LIVE_LOCAL_TESTS=1 to opt in to live local inference.' };
  }
  let settings;
  try {
    const output = options.readStatus ? options.readStatus() : execFileSync(
      env.PRISM_CLI || 'prism', ['local', 'status'],
      { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    settings = JSON.parse(output).settings;
  } catch {
    throw new Error('Cannot read Prism configuration. Check `prism local status`; no backend was started.');
  }
  if (!settings || !['auto', 'omlx', 'ollama'].includes(settings.backend)) {
    throw new Error('Prism returned an invalid local backend configuration.');
  }
  if (settings.backend !== 'ollama') {
    return { ...DISABLED, reason: `Prism backend is ${settings.backend}; Ollama live tests are disabled.` };
  }
  const roles = settings.models?.ollama;
  if (!roles || typeof roles.coder !== 'string' || !MODEL_ID.test(roles.coder)
    || (roles.reviewer !== undefined && (typeof roles.reviewer !== 'string' || !MODEL_ID.test(roles.reviewer)))) {
    throw new Error('Assign an Ollama coder in Prism before running live Ollama tests.');
  }
  const endpoint = new URL(env.OLLAMA_URL || 'http://localhost:11434');
  if (!['http:', 'https:'].includes(endpoint.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Live local tests require a loopback Ollama endpoint without credentials.');
  }
  return {
    enabled: true, reason: '', url: endpoint.href.replace(/\/$/, ''), model: roles.coder,
    models: [...new Set<string>([roles.coder, ...(roles.reviewer ? [roles.reviewer] : [])])],
  };
}
