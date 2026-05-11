import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';

export function middleware(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64');
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });
  response.headers.set('x-nonce', nonce);
  // Update CSP header with nonce — eliminates 'unsafe-inline' for scripts.
  // 'strict-dynamic' propagates trust to scripts loaded by nonced scripts,
  // so third-party loaders (e.g. Pyodide via cdn.jsdelivr.net) work without
  // needing their own allowlist entry once they're loaded by a nonced script.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://synalux.ai https://*.synalux.ai https://api.arasaac.org https://static.arasaac.org https://nominatim.openstreetmap.org wss://synalux.ai wss://*.synalux.ai",
    "media-src 'self' blob: https://synalux.ai https://*.synalux.ai",
    "img-src 'self' blob: data: https://static.arasaac.org https://api.arasaac.org",
    "worker-src blob:",
    "font-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
