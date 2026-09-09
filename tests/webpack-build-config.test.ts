import { describe, expect, it } from 'vitest';
import { customizeWebpack } from '@/lib/webpackBuildConfig';

type Config = { cache?: unknown; resolve?: Record<string, unknown>; plugins?: unknown[] };
const webpack = { NormalModuleReplacementPlugin: class {} } as never;
const run = (dev: boolean, isServer = false): Config =>
  customizeWebpack({}, { webpack, isServer, dev });

// Reusing a .next/cache written by a different source tree crashes webpack's own
// snapshot hashing (WasmHash._updateWithBuffer reads .length off an undefined
// entry hash), which broke every Vercel production build on 2026-09-09. Turning
// the cache back on is the regression, so it is asserted, not left to a comment.
describe('production webpack build cache', () => {
  it('is disabled for production builds', () => {
    expect(run(false).cache).toBe(false);
  });

  it('is left untouched for dev, which was never affected', () => {
    expect(run(true).cache).toBeUndefined();
  });

  it('is disabled on the server build too, not just the client', () => {
    expect(run(false, true).cache).toBe(false);
  });

  // The hook's original job must survive the change.
  it('still stubs node: builtins for pyodide in the client bundle only', () => {
    const client = run(false, false);
    expect(client.resolve!.fallback).toMatchObject({ fs: false, path: false, url: false });
    expect(client.plugins).toHaveLength(1);
    expect(run(false, true).plugins).toBeUndefined();
  });
});
