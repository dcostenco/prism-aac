import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Use Web Crypto API — Edge Runtime does not have Node.js `crypto`
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  // Forward nonce on the REQUEST headers so Next.js RSC `headers()` can read it.
  // The response headers are NOT readable by Server Components — only request headers are.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  // Also set on response for debugging / edge caching layers
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
