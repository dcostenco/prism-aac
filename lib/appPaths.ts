export const PRISM_AAC_BASE_PATH = '/prism-aac';
export const PRISM_AAC_TERMS_ROUTE = '/terms';
export const PRISM_AAC_TERMS_PATH = `${PRISM_AAC_BASE_PATH}${PRISM_AAC_TERMS_ROUTE}`;
export const APPLE_STANDARD_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const PRISM_AAC_MANIFEST_PATH = `${PRISM_AAC_BASE_PATH}/manifest.json`;
export const PRISM_AAC_STATIC_PATH = `${PRISM_AAC_BASE_PATH}/_next/static/`;
export const PRISM_AAC_SERVICE_WORKER_PATH = `${PRISM_AAC_BASE_PATH}/sw.js`;
// No trailing slash: the canonical app document is /prism-aac, so the
// worker must cover that document as well as child routes.
export const PRISM_AAC_SERVICE_WORKER_SCOPE = PRISM_AAC_BASE_PATH;
export const PRISM_AAC_OFFLINE_NAVIGATION_HEADER = 'x-prism-aac-cache-navigation';
// Keep optional MediaPipe models out of the eager PWA install. The worker's
// runtime cache stores them on first use without charging every AAC user the
// 46 MB camera/tracking download.
export const PRISM_AAC_PUBLIC_PRECACHE_PATTERNS = ['*', '!(models)/**/*'];
