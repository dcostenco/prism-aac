import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';
import { customizeWebpack } from './lib/webpackBuildConfig';
import {
  PRISM_AAC_BASE_PATH,
  PRISM_AAC_PUBLIC_PRECACHE_PATTERNS,
  PRISM_AAC_SERVICE_WORKER_SCOPE,
} from './lib/appPaths';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
  // Serwist's generated path guard treats the canonical `/prism-aac`
  // document as outside its default `/prism-aac/` scope. Registration is
  // owned by ServiceWorkerRegistrar so one broader registration controls
  // both the canonical document and its child routes.
  register: false,
  globPublicPatterns: PRISM_AAC_PUBLIC_PRECACHE_PATTERNS,
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
// Auto-bump SW killswitch on every deploy.
// Vercel sets VERCEL_GIT_COMMIT_SHA automatically; local builds fall back to
// a timestamp so dev reloads still bust the cache.
const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8) || `local-${Date.now()}`;
const proxyApiUrl = process.env.PROXY_API_URL || 'https://synalux.ai/api/v1';
const proxyPortalOrigin = new URL(proxyApiUrl).origin;

const nextConfig: NextConfig = {
  basePath: PRISM_AAC_BASE_PATH,
  env: {
    // Expose basePath to client code so mediapipeRuntime can construct
    // correct self-hosted model URLs (public/ assets are at <basePath>/models/...).
    NEXT_PUBLIC_BASE_PATH: PRISM_AAC_BASE_PATH,
    // Unique per-deploy build ID — consumed by the SW killswitch in layout.tsx
    // so every Vercel deploy automatically invalidates stale SW caches.
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_DD_CLIENT_TOKEN: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN || '',
    NEXT_PUBLIC_DD_APPLICATION_ID: process.env.NEXT_PUBLIC_DD_APPLICATION_ID || '',
    NEXT_PUBLIC_DD_SITE: process.env.NEXT_PUBLIC_DD_SITE || 'datadoghq.com',
  },
  serverExternalPackages: ['@huggingface/transformers', 'pyodide'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${proxyApiUrl}/:path*`,
      },
      {
        source: '/api/auth/session',
        destination: `${proxyPortalOrigin}/api/auth/session`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: PRISM_AAC_SERVICE_WORKER_SCOPE,
          },
        ],
      },
    ];
  },
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
  webpack: customizeWebpack,
};

export default withSerwist(nextConfig);
