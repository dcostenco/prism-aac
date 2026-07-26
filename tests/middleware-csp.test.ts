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
