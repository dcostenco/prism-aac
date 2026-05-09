import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
});

// basePath: '/prism-aac' makes Next.js emit asset URLs and route links
// prefixed with /prism-aac (e.g. /prism-aac/_next/static/...). When this
// app is proxied at synalux.ai/prism-aac, the browser resolves those
// asset URLs against synalux.ai — and the portal's `beforeFiles` rewrite
// catches /prism-aac/_next/* and proxies it back here. Without basePath
// the standalone emits /_next/* which the portal serves from its own
// (different) chunks → 404 storm → white screen.
//
// Direct access at prism-aac.vercel.app is at
// prism-aac.vercel.app/prism-aac (the basePath also applies there).
const nextConfig: NextConfig = {
  basePath: '/prism-aac',
  env: {
    // Expose basePath to client code so mediapipeRuntime can construct
    // correct self-hosted model URLs (public/ assets are at <basePath>/models/...).
    NEXT_PUBLIC_BASE_PATH: '/prism-aac',
  },
  serverExternalPackages: ['@huggingface/transformers', 'pyodide'],
  turbopack: {},
  // Webpack-only fix: Pyodide's `import('pyodide')` (in
  // services/python-worker.ts) pulls in pyodide.mjs which has top-level
  // imports for `node:path`/`node:fs`/`node:url`. Those run only on the
  // Node entry path of the package, but webpack still tries to resolve
  // them at build time and fails with `UnhandledSchemeError`. Aliasing
  // them to `false` makes webpack emit empty stubs — Pyodide's browser
  // code path never executes those imports at runtime.
  // (Build runs with --webpack so Serwist's webpack plugin can generate
  // public/sw.js; Turbopack production builds silently skip the SW.)
  webpack: (config, { webpack, isServer }) => {
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
  },
};

export default withSerwist(nextConfig);
