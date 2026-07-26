// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Prism AAC Content Security Policy', () => {
  it('allows the generated same-origin service worker and blob workers', () => {
    const response = middleware(
      new NextRequest('https://prism-aac.vercel.app/prism-aac'),
    );
    const csp = response.headers.get('content-security-policy');

    expect(csp).toContain("worker-src 'self' blob:");
  });
});
