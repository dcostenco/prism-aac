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
  turbopack: {},
};

export default withSerwist(nextConfig);
