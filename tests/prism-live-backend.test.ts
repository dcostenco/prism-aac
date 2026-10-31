// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { configuredOllamaTests } from './helpers/prismLiveBackend';

const CODER = 'fixture/coder:test';
const REVIEWER = 'fixture/reviewer:test';
const status = (backend: string, roles?: Record<string, unknown>) => JSON.stringify({
  settings: { backend, source: 'existing', models: { ollama: roles } },
});

describe('live local tests honor the current Prism configuration', () => {
  it('ordinary Vitest does not read configuration or contact a backend', () => {
    const readStatus = vi.fn();
    expect(configuredOllamaTests({ env: {}, readStatus }).enabled).toBe(false);
    expect(readStatus).not.toHaveBeenCalled();
  });

  it.each(['omlx', 'auto'])('does not substitute Ollama when Prism selects %s', backend => {
    const config = configuredOllamaTests({ enabled: true, env: {}, readStatus: () => status(backend, { coder: CODER }) });
    expect(config.enabled).toBe(false);
    expect(config.url).toBe('');
    expect(config.models).toEqual([]);
    expect(config.reason).toContain(backend);
  });

  it('an explicitly disabled suite stays disabled when the common live flag is set', () => {
    const readStatus = vi.fn();
    expect(configuredOllamaTests({ enabled: false, env: { PRISM_LIVE_LOCAL_TESTS: '1' }, readStatus }).enabled).toBe(false);
    expect(readStatus).not.toHaveBeenCalled();
  });

  it('does not borrow a model assignment from the other backend', () => {
    const output = JSON.stringify({ settings: { backend: 'ollama', models: { omlx: { coder: CODER } } } });
    expect(() => configuredOllamaTests({ enabled: true, env: {}, readStatus: () => output })).toThrow(/Assign an Ollama coder/);
  });

  it('uses the assigned coder and reviewer instead of a fixed model tag', () => {
    expect(configuredOllamaTests({ enabled: true, env: {}, readStatus: () => status('ollama', { coder: CODER, reviewer: REVIEWER }) }))
      .toMatchObject({ enabled: true, model: CODER, models: [CODER, REVIEWER], url: 'http://localhost:11434' });
  });

  it('allows one model assigned to both roles without inventing another tier', () => {
    expect(configuredOllamaTests({ enabled: true, env: {}, readStatus: () => status('ollama', { coder: CODER, reviewer: CODER }) }).models)
      .toEqual([CODER]);
  });

  it.each([undefined, {}, { reviewer: REVIEWER }, { coder: '' }, { coder: '../bad model' }])('refuses an absent or invalid coder assignment: %j', roles => {
    expect(() => configuredOllamaTests({ enabled: true, env: {}, readStatus: () => status('ollama', roles) })).toThrow(/Assign an Ollama coder/);
  });

  it.each(['not JSON', '{}', status('unknown')])('does not fall back when configuration is invalid: %s', output => {
    expect(() => configuredOllamaTests({ enabled: true, env: {}, readStatus: () => output })).toThrow();
  });

  it('surfaces unavailable configuration instead of probing Ollama', () => {
    expect(() => configuredOllamaTests({ enabled: true, env: {}, readStatus: () => { throw new Error('unavailable'); } })).toThrow(/Cannot read Prism configuration/);
  });

  it.each(['https://example.com', `http://fixture:${randomUUID()}@localhost:11434`, 'http://localhost:11434/?unexpected=query'])('refuses an unsafe live endpoint: %s', url => {
    expect(() => configuredOllamaTests({ enabled: true, env: { OLLAMA_URL: url }, readStatus: () => status('ollama', { coder: CODER }) })).toThrow(/loopback/);
  });
});
