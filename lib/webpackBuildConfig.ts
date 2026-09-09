/**
 * The webpack customisation for this app's builds.
 *
 * It lives here rather than inline in next.config.ts so it can be unit tested:
 * importing next.config pulls @serwist/next into the test worker, which killed
 * the worker and silently dropped 204 unrelated tests from the run.
 */
export function customizeWebpack(
  config: { cache?: unknown; resolve?: Record<string, unknown>; plugins?: unknown[] },
  { webpack, isServer, dev }: {
    // Only the piece this hook uses; `webpack` is bundled inside next and has
    // no types of its own here.
    webpack: { NormalModuleReplacementPlugin: new (
      test: RegExp, handler: (resource: { request: string }) => void) => unknown };
    isServer: boolean;
    dev: boolean;
  },
) {
  // Production builds must not use webpack's filesystem cache.
  //
  // Reusing a `.next/cache` written by a different source tree crashes the
  // build in webpack's own snapshot machinery:
  //
  //   TypeError: Cannot read properties of undefined (reading 'length')
  //     at WasmHash._updateWithBuffer (next/dist/compiled/webpack/bundle5.js)
  //
  // FileSystemInfo collects child entry hashes with `P.push(q.hash)` and then
  // feeds each one to `hash.update()`. A persisted entry whose `hash` is
  // undefined is passed straight through, and the hasher reads `.length` off
  // it. Reproduced deterministically (3/3): build one commit, drop a second
  // commit's files into the same tree, build again.
  //
  // On Vercel this made every production build fail from 2026-09-09, because
  // production deployments restore the cache from the previous production
  // deployment. Preview builds were unaffected. Each failure needed a manual
  // "Redeploy without build cache" to ship.
  //
  // Cost of turning it off: none measured — 22s vs 23s on a cold build, and
  // it stops writing a 1.0 GB cache that no build was ever able to reuse.
  // `next dev` keeps its cache; only production builds are affected.
  if (!dev) config.cache = false;

  // Only patch the client/worker bundles — on the server, `node:path`
  // resolves natively. The `import('pyodide')` in python-worker.ts
  // pulls pyodide.mjs which has top-level `node:fs`/`node:path`
  // imports for its Node entry path; the browser entry path never
  // executes them but webpack still tries to resolve at compile time.
  // The plugin strips the `node:` scheme to a bare specifier and the
  // fallback then stubs it to an empty module (safe — Pyodide only
  // touches those imports on the Node code path).
  if (!isServer) {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      url: false,
      crypto: false,
      vm: false,
      child_process: false,
      module: false,
      tty: false,
      os: false,
      stream: false,
      buffer: false,
      util: false,
      zlib: false,
    };
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^node:/,
        (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, '');
        },
      ),
    );
  }
  return config;
}
