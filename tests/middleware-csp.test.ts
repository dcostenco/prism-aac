// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/dist/experimental/testing/server/middleware-testing-utils';
import { config, middleware } from '@/middleware';

describe('Prism AAC Content Security Policy', () => {
  it('allows the generated same-origin service worker and blob workers', () => {
    const response = middleware(
      new NextRequest('https://prism-aac.vercel.app/prism-aac'),
    );
    const csp = response.headers.get('content-security-policy');

    expect(csp).toContain("worker-src 'self' blob:");
  });

  it('matches the base-path document but excludes static assets', () => {
    const nextConfig = { basePath: '/prism-aac' };
    const matches = (url: string) =>
      unstable_doesMiddlewareMatch({ config, nextConfig, url });

    expect(matches('https://prism-aac.vercel.app/prism-aac')).toBe(true);
    expect(matches('https://prism-aac.vercel.app/prism-aac/settings')).toBe(true);
    expect(
      matches(
        'https://prism-aac.vercel.app/prism-aac/_next/static/chunks/app.js',
      ),
    ).toBe(false);
  });
});

describe('Permissions-Policy — camera', () => {
  // Regression: this header shipped `camera=()`. An empty allowlist is not
  // "unset" — it switches the camera off for self, so getUserMedia rejects
  // before any native/OS permission is consulted, and head tracking plus
  // custom picture symbols cannot start. Production masked it because the
  // portal proxy replaced the header; the direct Vercel host and the localhost
  // dev server the iOS DEBUG build loads did not get that override.
  const policy = () =>
    middleware(new NextRequest('https://prism-aac.vercel.app/prism-aac'))
      .headers.get('permissions-policy') || '';

  it('lets this origin use the camera', () => {
    expect(policy()).toContain('camera=(self)');
    expect(policy()).not.toContain('camera=()');
  });

  it('still keeps microphone and geolocation same-origin only', () => {
    expect(policy()).toContain('microphone=(self)');
    expect(policy()).toContain('geolocation=(self)');
  });
});

describe('CSP — WebAssembly', () => {
  // speechService's Tier 3 fallback and panicService both compile WASM. Without
  // this directive every instantiate() is refused and the last-resort speech
  // tier cannot run at all.
  it("allows 'wasm-unsafe-eval' without re-enabling script eval", async () => {
    const res = await middleware(new NextRequest('https://prism-aac.test/prism-aac'));
    const csp = res.headers.get('content-security-policy') || '';
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) || '';
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-eval'; ");
    expect(scriptSrc.replace("'wasm-unsafe-eval'", '')).not.toContain("'unsafe-eval'");
  });
});
