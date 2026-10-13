// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/dist/experimental/testing/server/middleware-testing-utils';
import { config, middleware } from '@/middleware';

describe('Prism AAC Content Security Policy', () => {
  it('allows only the read-only Terms route inside its same-origin reader', () => {
    const response = middleware(new NextRequest('https://synalux.ai/prism-aac/terms'));
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
    expect(response.headers.get('content-security-policy')).toContain("frame-src 'self' https:");
    for (const path of ['/prism-aac', '/prism-aac/docs', '/prism-aac/terms-other', '/prism-aac/terms/other']) {
      const other = middleware(new NextRequest('https://synalux.ai' + path));
      expect(other.headers.get('x-frame-options')).toBe('DENY');
      expect(other.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    }
  });
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

describe('CSP — generated prediction pictures', () => {
  // The portal answers a picture request with a 302 to Supabase storage, and
  // the browser checks the redirect target against connect-src.
  it('lets a picture request follow the portal redirect to Supabase storage', () => {
    const csp = middleware(new NextRequest('https://prism-aac.vercel.app/prism-aac'))
      .headers.get('content-security-policy') || '';
    expect(/connect-src ([^;]+)/.exec(csp)?.[1].split(/\s+/)).toContain('https://*.supabase.co');
  });
});

describe('CSP — retired third-party pictograms', () => {
  // The app no longer shows third-party pictograms; the browser must refuse to
  // load them for any page served after this ships, even one running older
  // cached scripts.
  it('does not allow any arasaac.org host for images or requests', () => {
    const csp = middleware(new NextRequest('https://prism-aac.vercel.app/prism-aac'))
      .headers.get('content-security-policy') || '';
    expect(csp).not.toMatch(/arasaac/i);
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

describe('CSP — local Ollama (Settings → Local AI Models)', () => {
  // Regression: connect-src omitted http://localhost:11434, so the browser refused
  // every Ollama request and the panel read "Ollama is not running" while Ollama
  // was up. Production masked it (the portal proxy sends its own CSP, which lists
  // localhost:11434); the direct Vercel host and the localhost dev server the iOS
  // DEBUG build loads use this header.
  const connectSrc = () =>
    (middleware(new NextRequest('https://prism-aac.vercel.app/prism-aac')).headers.get('content-security-policy') || '')
      .split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src')) || '';

  it('lets the page reach Ollama on this computer, by name and by loopback address', () => {
    expect(connectSrc()).toContain('http://localhost:11434');
    expect(connectSrc()).toContain('http://127.0.0.1:11434');
  });

  it('does not open every local port or the local network', () => {
    expect(connectSrc()).not.toContain('http://localhost:*');
    expect(connectSrc()).not.toMatch(/http:\/\/(192\.168|10\.)/);
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

describe('CSP — picture symbols', () => {
  // Built-in phrases use symbols bundled in public/symbols ('self'). The
  // third-party symbol service the app used to search is gone, and the policy
  // must not keep a door open to it.
  const directive = (name: string) =>
    (middleware(new NextRequest('https://prism-aac.vercel.app/prism-aac')).headers.get('content-security-policy') || '')
      .split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) || '';

  it('serves symbols from this origin', () => {
    expect(directive('img-src')).toContain("'self'");
  });

  it('no longer allows the third-party symbol hosts', () => {
    expect(directive('connect-src')).not.toMatch(/arasaac/i);
    expect(directive('img-src')).not.toMatch(/arasaac/i);
  });

  it('lets cached cloud PNG redirects load and their local blob bytes be reused', () => {
    expect(directive('connect-src')).toContain('https://*.supabase.co');
    expect(directive('connect-src').split(/\s+/)).toContain('blob:');
    expect(directive('img-src')).toContain('https://*.supabase.co');
    expect(directive('connect-src').split(/\s+/)).not.toContain('https:');
    expect(directive('img-src').split(/\s+/)).not.toContain('https:');
  });
});
